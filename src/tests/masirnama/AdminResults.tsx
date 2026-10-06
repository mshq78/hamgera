import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileJson, FileSpreadsheet, Search } from 'lucide-react';
import type { AdminResultsProps } from '../types';
import type { StoredSession } from '@/core/services/api';
import { analysisApi } from './analysisApi';
import { AnalysisResult, AnalysisSummary, ManualFormSpec, SessionData } from './types';
import { AnalysisReport } from './features/AnalysisReport';
import { ManualRating } from './features/ManualRating';
import { QUESTIONS } from './questions';
import { UI_STRINGS } from './content/ui.fa';
import { toPersianDigits, toEnglishDigits, formatSeconds } from '@/core/utils/number';
import { formatTehran } from '@/core/utils/jalali';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';

const t = UI_STRINGS.admin;

type Session = StoredSession<SessionData>;

const totalActiveMs = (s: Session) => s.data.answers.reduce((sum, a) => sum + (a.clientMeta?.activeTimeMs ?? 0), 0);
const totalPastes = (s: Session) => s.data.answers.reduce((sum, a) => sum + (a.clientMeta?.pasteEvents ?? 0), 0);
const fullName = (s: Session) => `${s.firstName} ${s.lastName}`.trim();

/** Neutralises spreadsheet formula injection and quotes the value for CSV. */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function download(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Method = 'ai' | 'rules' | 'manual';

export default function AdminResults({ adminPassword, sessions: rawSessions }: AdminResultsProps) {
  const sessions = rawSessions as Session[];
  const [analyses, setAnalyses] = useState<Record<string, AnalysisSummary>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [analysisMsg, setAnalysisMsg] = useState('');
  const [chooser, setChooser] = useState<Session | null>(null);
  const [manual, setManual] = useState<{ session: Session; form: ManualFormSpec } | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState('');
  const [bulkMethod, setBulkMethod] = useState<'ai' | 'rules'>('rules');
  const [report, setReport] = useState<{ session: Session; result: AnalysisResult; versions: number } | null>(null);
  const [selected, setSelected] = useState<Session | null>(null);
  const [search, setSearch] = useState('');

  const loadAnalyses = async () => {
    const res = await analysisApi.list(adminPassword);
    if (res.ok) setAnalyses(Object.fromEntries(res.data.analyses.map((a) => [a.sessionId, a])));
  };
  useEffect(() => {
    loadAnalyses();
  }, [adminPassword]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyzeOne = async (s: Session, method: 'ai' | 'rules'): Promise<boolean> => {
    setAnalyzing((prev) => new Set(prev).add(s.sessionId));
    setAnalysisMsg('');
    const res = await analysisApi.run(adminPassword, s.sessionId, method);
    setAnalyzing((prev) => {
      const next = new Set(prev);
      next.delete(s.sessionId);
      return next;
    });
    if (!res.ok) {
      setAnalysisMsg(res.status === 503 ? t.analyzeNotConfigured : t.analyzeFailed);
      return false;
    }
    await loadAnalyses();
    return true;
  };

  const openReport = async (s: Session) => {
    const res = await analysisApi.get(adminPassword, s.sessionId);
    if (res.ok) setReport({ session: s, ...res.data });
  };

  const startAnalysis = async (s: Session, method: Method) => {
    setChooser(null);
    if (method === 'manual') {
      setManualError('');
      const res = await analysisApi.form(adminPassword, s.sessionId);
      if (res.ok) setManual({ session: s, form: res.data });
      else setAnalysisMsg(t.analyzeFailed);
      return;
    }
    if (await analyzeOne(s, method)) {
      setReport(null);
      await openReport(s);
    }
  };

  const submitManual = async (ratings: Parameters<typeof analysisApi.manual>[2], note: string) => {
    if (!manual) return;
    setManualBusy(true);
    setManualError('');
    const res = await analysisApi.manual(adminPassword, manual.session.sessionId, ratings, note);
    setManualBusy(false);
    if (!res.ok) return setManualError(t.manualFailed);
    const s = manual.session;
    setManual(null);
    setReport(null);
    await loadAnalyses();
    await openReport(s);
  };

  const analyzeAllPending = async () => {
    for (const s of sessions.filter((x) => !analyses[x.sessionId])) {
      if (!(await analyzeOne(s, bulkMethod))) break;
    }
  };

  const exportReport = async () => {
    if (!report) return;
    await analysisApi.auditExport(adminPassword, report.session.sessionId);
    download(JSON.stringify(report.result, null, 2), 'application/json', `masirnama_report_${report.session.sessionId}.json`);
  };

  const day = () => new Date().toISOString().slice(0, 10);
  const handleExportJSON = () => download(JSON.stringify(sessions, null, 2), 'application/json', `masirnama_sessions_${day()}.json`);

  const handleExportCSV = () => {
    const headers = [
      'SessionID', 'Name', 'Mobile', 'StartedAt', 'FinishedAt', 'QuestionSetVersion', 'ConsentVersion',
      ...QUESTIONS.flatMap((q) => [`${q.id}_Text`, `${q.id}_ActiveSec`, `${q.id}_PasteEvents`, `${q.id}_PastedChars`, `${q.id}_Edits`]),
    ];
    const rows = sessions.map((s) => {
      const byId = new Map(s.data.answers.map((a) => [a.questionId, a]));
      return [
        s.sessionId, fullName(s), s.mobile, s.data.startedAt, s.data.finishedAt, s.data.questionSetVersion, s.data.consentVersion,
        ...QUESTIONS.flatMap((q) => {
          const a = byId.get(q.id);
          return [a?.text ?? '', a ? Math.round(a.clientMeta.activeTimeMs / 1000) : '', a?.clientMeta.pasteEvents ?? '', a?.clientMeta.pastedChars ?? '', a?.clientMeta.editCount ?? ''];
        }),
      ].map(csvCell).join(',');
    });
    download('﻿' + [headers.map(csvCell).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;', `masirnama_sessions_${day()}.csv`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sessions.filter((s) => s.sessionId.toLowerCase().includes(q) || s.mobile.includes(toEnglishDigits(q)) || fullName(s).toLowerCase().includes(q)) : sessions;
  }, [sessions, search]);

  const avgActiveMs = sessions.length ? sessions.reduce((sum, s) => sum + totalActiveMs(s), 0) / sessions.length : 0;
  const pasteSessions = sessions.filter((s) => totalPastes(s) > 0).length;

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 dark:text-slate-400">{t.privacyNote}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExportJSON} leftIcon={<FileJson className="w-3.5 h-3.5" />}>{t.exportJson}</Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}>{UI_STRINGS.admin.exportCsvLabel}</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.totalSessions, value: toPersianDigits(sessions.length) },
          { label: t.avgActiveTime, value: formatSeconds(avgActiveMs) },
          { label: t.pasteSessions, value: toPersianDigits(pasteSessions) },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
            <div className="text-lg font-extrabold text-slate-900 dark:text-amber-100">{card.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={analyzeAllPending} disabled={analyzing.size > 0 || sessions.every((x) => analyses[x.sessionId])} isLoading={analyzing.size > 0}>
          {analyzing.size > 0 ? t.analyzeProgress : t.analyzeAll}
        </Button>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          {t.bulkMethod}
          <select value={bulkMethod} onChange={(e) => setBulkMethod(e.target.value as 'ai' | 'rules')} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1">
            <option value="rules">{t.methodRules}</option>
            <option value="ai">{t.methodAi}</option>
          </select>
        </label>
        {analysisMsg && <span role="alert" className="text-xs text-rose-500 font-medium">{analysisMsg}</span>}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">{t.colFinished}</th>
              <th className="px-3 py-2 font-medium">{t.colName}</th>
              <th className="px-3 py-2 font-medium">{t.colMobile}</th>
              <th className="px-3 py-2 font-medium">{t.colTime}</th>
              <th className="px-3 py-2 font-medium">{t.colPaste}</th>
              <th className="px-3 py-2 font-medium">{t.colAnalysis}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.sessionId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap">{formatTehran(s.data.finishedAt, false)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fullName(s) || '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{s.mobile}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatSeconds(totalActiveMs(s))}</td>
                <td className="px-3 py-2">{toPersianDigits(totalPastes(s))}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {analyses[s.sessionId] ? (
                    <Button variant="secondary" size="sm" onClick={() => openReport(s)}>
                      {t.openReport}
                      {analyses[s.sessionId].level ? ` · ${analyses[s.sessionId].level}` : ''}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" isLoading={analyzing.has(s.sessionId)} onClick={() => setChooser(s)}>{t.analyze}</Button>
                  )}
                </td>
                <td className="px-3 py-2 text-left">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(s)} leftIcon={<Eye className="w-3.5 h-3.5" />}>{t.view}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!chooser} onClose={() => setChooser(null)} title={t.chooseMethodTitle} maxWidth="sm">
        <div className="space-y-3">
          {([['ai', t.methodAi, t.methodAiHint], ['rules', t.methodRules, t.methodRulesHint], ['manual', t.methodManual, t.methodManualHint]] as const).map(([m, label, hint]) => (
            <button key={m} type="button" onClick={() => chooser && startAnalysis(chooser, m)} className="w-full text-right rounded-2xl border border-slate-200 dark:border-slate-800 p-3 hover:border-amber-400 transition cursor-pointer">
              <div className="text-sm font-bold text-slate-900 dark:text-amber-100">{label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{hint}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={!!manual} onClose={() => !manualBusy && setManual(null)} title={t.manualTitle} maxWidth="xl">
        {manual && <ManualRating session={manual.session} form={manual.form} busy={manualBusy} error={manualError} onSubmit={submitManual} />}
      </Modal>

      <Modal isOpen={!!report} onClose={() => setReport(null)} title={t.reportTitle} maxWidth="xl">
        {report && <AnalysisReport result={report.result} versions={report.versions} busy={analyzing.has(report.session.sessionId)} onRerun={() => setChooser(report.session)} onExport={exportReport} />}
      </Modal>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={t.detailTitle} maxWidth="xl">
        {selected && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">{fullName(selected)} {selected.mobile} · {selected.sessionId}</p>
            {QUESTIONS.map((q) => {
              const a = selected.data.answers.find((x) => x.questionId === q.id);
              return (
                <article key={q.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{toPersianDigits(q.order)}. {q.text}</h3>
                  <p className="text-sm whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{a?.text ?? '—'}</p>
                  {a && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.activeTime}: {formatSeconds(a.clientMeta.activeTimeMs)} · {t.pasteEvents}: {toPersianDigits(a.clientMeta.pasteEvents)} · {t.pastedChars}: {toPersianDigits(a.clientMeta.pastedChars)} · {t.edits}: {toPersianDigits(a.clientMeta.editCount)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
