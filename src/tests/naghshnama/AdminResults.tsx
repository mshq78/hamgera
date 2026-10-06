import React, { useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import type { AdminResultsProps } from '../types';
import type { StoredSession } from '@/core/services/api';
import { NaghshnamaResult, SessionData } from './types';
import { UI_STRINGS } from './content/ui.fa';
import { toPersianDigits, formatScore, formatSeconds } from './utils';
import { toEnglishDigits } from '@/core/utils/number';
import { formatTehran } from '@/core/utils/jalali';
import { Modal } from '@/core/components/Modal';

type Session = StoredSession<SessionData, NaghshnamaResult>;

const displayName = (s: Session) => `${s.firstName} ${s.lastName}`.trim() || s.mobile || 'ناشناس';

/** Admin results of نقش‌نما: every session with its role ranking and the response-quality audit. */
export default function AdminResults({ sessions: raw }: AdminResultsProps) {
  const sessions = raw as Session[];
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        displayName(s).toLowerCase().includes(q) ||
        s.mobile.includes(toEnglishDigits(q)) ||
        s.sessionId.toLowerCase().includes(q) ||
        (s.data.trackingCode ?? '').toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  return (
    <div className="space-y-5 select-none">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {UI_STRINGS.admin.totalSessions} <strong>{toPersianDigits(sessions.length)}</strong> جلسه ثبت‌شده
      </p>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={UI_STRINGS.admin.searchPlaceholder}
          aria-label={UI_STRINGS.admin.searchPlaceholder}
          className="w-full pr-10 pl-3 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="p-1 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5">{UI_STRINGS.admin.tableColName}</th>
                <th className="p-3.5">{UI_STRINGS.admin.tableColDate}</th>
                <th className="p-3.5">{UI_STRINGS.admin.tableColRqi}</th>
                <th className="p-3.5">{UI_STRINGS.admin.tableColLevel}</th>
                <th className="p-3.5">{UI_STRINGS.admin.tableColTop3}</th>
                <th className="p-3.5 text-center">{UI_STRINGS.admin.tableColActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">{UI_STRINGS.admin.noSessions}</td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const rqi = session.data.rqi;
                  const top3Names = session.result?.scoring?.top3?.map((r) => r.persianTitle).join('، ') || '—';
                  return (
                    <tr key={session.sessionId} className="hover:bg-amber-50/20 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{displayName(session)}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{session.data.trackingCode || session.sessionId.slice(0, 8)}</div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatTehran(session.data.finishedAt, false)}</td>
                      <td className="p-3.5 font-black text-slate-900 dark:text-slate-100 tabular-nums">{toPersianDigits(rqi?.score ?? 0)}</td>
                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20">
                          {rqi?.levelLabel || 'نامشخص'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{top3Names}</td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSession(session)}
                          aria-label={UI_STRINGS.admin.modalTitle}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-400 hover:text-slate-950 transition cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedSession} onClose={() => setSelectedSession(null)} title={UI_STRINGS.admin.modalTitle} maxWidth="lg">
        {selectedSession && (
          <div className="space-y-4 text-xs">
            {/* Participant Bio */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">
                  {displayName(selectedSession)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  کد پیگیری: {selectedSession.data.trackingCode || '—'}
                </span>
              </div>
              <div className="text-left font-mono text-[11px] text-slate-500">
                نسخه: {selectedSession.data.instrumentVersion}
              </div>
            </div>

            {/* RQI Audit Card */}
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  {UI_STRINGS.admin.modalRqiSection}
                </span>
                <span className="text-base font-black text-amber-900 dark:text-amber-200 tabular-nums">
                  {toPersianDigits(selectedSession.data.rqi.score)} / ۱۰۰ ({selectedSession.data.rqi.levelLabel})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400">سرعت بخش A (&lt;1.5s)</div>
                  <div className="font-bold mt-1">
                    {toPersianDigits(selectedSession.data.rqi.details.fastCountA)} مورد (کسر: {toPersianDigits(selectedSession.data.rqi.deductions.speedA)})
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400">سرعت بخش B (&lt;4.0s)</div>
                  <div className="font-bold mt-1">
                    {toPersianDigits(selectedSession.data.rqi.details.fastCountB)} مورد (کسر: {toPersianDigits(selectedSession.data.rqi.deductions.speedB)})
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400">سوگیری سمتی A (&gt;80%)</div>
                  <div className="font-bold mt-1">
                    {toPersianDigits(Math.round(selectedSession.data.rqi.details.maxSidePercentA))}٪ (کسر: {toPersianDigits(selectedSession.data.rqi.deductions.sideBiasA)})
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400">همبستگی اسپیرمن</div>
                  <div className="font-bold mt-1">
                    {toPersianDigits(selectedSession.data.rqi.details.avgSpearman.toFixed(2))} (کسر: {toPersianDigits(selectedSession.data.rqi.deductions.spearman)})
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 border-t border-amber-500/20 pt-1.5 leading-relaxed">
                ⚠️ {selectedSession.data.rqi.warningNote}
              </p>
            </div>

            {/* 9 Roles Vectors Table */}
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                {UI_STRINGS.admin.modalVectorsSection}
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">کد</th>
                      <th className="p-2">عنوان فارسی</th>
                      <th className="p-2">خام A</th>
                      <th className="p-2">خام B</th>
                      <th className="p-2">خام C</th>
                      <th className="p-2">FC%</th>
                      <th className="p-2">SJT%</th>
                      <th className="p-2">GAME%</th>
                      <th className="p-2 font-bold">نهایی</th>
                      <th className="p-2">رتبه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(selectedSession.result?.scoring.roles ?? []).map((r) => (
                      <tr key={r.code}>
                        <td className="p-2 font-mono font-bold">{r.code}</td>
                        <td className="p-2">{r.persianTitle}</td>
                        <td className="p-2">{toPersianDigits(r.rawA)}</td>
                        <td className="p-2">{toPersianDigits(r.rawB)}</td>
                        <td className="p-2">{toPersianDigits(r.rawC)}</td>
                        <td className="p-2 text-slate-400">{toPersianDigits(Math.round(r.fc))}</td>
                        <td className="p-2 text-slate-400">{toPersianDigits(Math.round(r.sjt))}</td>
                        <td className="p-2 text-slate-400">{toPersianDigits(Math.round(r.game))}</td>
                        <td className="p-2 font-bold text-amber-700 dark:text-amber-400">{formatScore(r.displayScore)}</td>
                        <td className="p-2 font-bold">{toPersianDigits(r.rank)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Timing Audit Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px]">میانگین زمان بخش A</span>
                <span className="font-bold">
                  {formatSeconds(
                    selectedSession.data.responsesA.reduce((a, b) => a + b.responseTimeMs, 0) /
                      Math.max(1, selectedSession.data.responsesA.length)
                  )}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px]">میانگین زمان بخش B</span>
                <span className="font-bold">
                  {formatSeconds(
                    selectedSession.data.responsesB.reduce((a, b) => a + b.responseTimeMs, 0) /
                      Math.max(1, selectedSession.data.responsesB.length)
                  )}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px]">میانگین زمان بخش C</span>
                <span className="font-bold">
                  {formatSeconds(
                    selectedSession.data.responsesC.reduce((a, b) => a + b.responseTimeMs, 0) /
                      Math.max(1, selectedSession.data.responsesC.length)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
