import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import { api, AdminTest } from '../services/api';
import { ADMIN } from '../content/admin.fa';
import { Button } from '../components/Button';
import { JalaliDateTimeInput } from '../components/JalaliDateTimeInput';
import { toPersianDigits } from '../utils/number';
import { formatTehran } from '../utils/jalali';
import { validateSchedule, MAX_GRACE_MINUTES, TestMode } from '../../../shared/schedule';
import { REGISTRY } from '@/tests/registry';

const t = ADMIN.schedule;

type Draft = Omit<AdminTest, 'status' | 'ready' | 'notReadyReason' | 'sessions' | 'people'>;
const toDraft = ({ status: _s, ready: _r, notReadyReason: _n, sessions: _x, people: _p, ...d }: AdminTest): Draft => d;

const STATUS_STYLE: Record<AdminTest['status'], string> = {
  open: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/70 dark:border-amber-800',
  upcoming: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  closed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  ended: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};
const STATUS_TEXT: Record<AdminTest['status'], string> = { open: t.statusOpen, upcoming: t.statusUpcoming, closed: t.statusClosed, ended: t.statusEnded };

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 cursor-pointer select-none">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 cursor-pointer accent-amber-500" />
    <span>
      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>
    </span>
  </label>
);

const TestScheduleCard: React.FC<{ test: AdminTest; adminPassword: string; onSaved: () => Promise<void> }> = ({ test, adminPassword, onSaved }) => {
  const meta = REGISTRY[test.testId].meta;
  const [draft, setDraft] = useState<Draft>(() => toDraft(test));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Follow the server whenever it reports something new (after a save or a refresh).
  const serverKey = JSON.stringify(toDraft(test));
  useEffect(() => setDraft(toDraft(test)), [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(draft) !== serverKey;
  const problem = validateSchedule(draft);
  const patch = (p: Partial<Draft>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const save = async (next: Draft = draft) => {
    setBusy(true);
    setMessage(null);
    const res = await api.saveSchedule(adminPassword, next);
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: 'error', text: t.errors[res.error] ?? t.saveFailed });
      return;
    }
    setMessage({ kind: 'ok', text: t.saved });
    await onSaved();
  };

  const summary =
    draft.mode === 'closed'
      ? t.summaryClosed
      : draft.mode === 'open'
      ? t.summaryOpen
      : draft.opensAt
      ? t.summaryScheduled(formatTehran(draft.opensAt), draft.closesAt ? formatTehran(draft.closesAt) : null)
      : '';

  const Icon = REGISTRY[test.testId].icon;
  const modes: { id: TestMode; label: string }[] = [
    { id: 'closed', label: t.modeClosed },
    { id: 'open', label: t.modeOpen },
    { id: 'scheduled', label: t.modeScheduled },
  ];

  return (
    <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-slate-900 text-amber-300 dark:bg-slate-800 flex items-center justify-center">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-amber-100">{meta.title}</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {toPersianDigits(test.sessions)} {t.sessions} · {toPersianDigits(test.people)} {t.people}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLE[test.status]}`}>{STATUS_TEXT[test.status]}</span>
      </header>

      {!test.ready && (
        <p role="note" className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800 rounded-xl p-3">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {t.notReady}
        </p>
      )}

      <div className="space-y-2">
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{t.mode}</span>
        <div role="radiogroup" aria-label={t.mode} className="flex flex-wrap gap-2">
          {modes.map((m) => {
            const blocked = !test.ready && m.id !== 'closed';
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={draft.mode === m.id}
                disabled={blocked}
                onClick={() => patch({ mode: m.id })}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  draft.mode === m.id
                    ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.modeHint[draft.mode]}</p>
      </div>

      {draft.mode === 'scheduled' && (
        <div className="space-y-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
          <JalaliDateTimeInput label={t.opensAt} value={draft.opensAt} onChange={(v) => patch({ opensAt: v })} />
          <JalaliDateTimeInput label={t.closesAt} value={draft.closesAt} optional onChange={(v) => patch({ closesAt: v })} />
          {!draft.closesAt && <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.closesOptional}</p>}
          {draft.closesAt && (
            <div>
              <label htmlFor={`grace-${test.testId}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t.grace}</label>
              <input
                id={`grace-${test.testId}`}
                type="number"
                min={0}
                max={MAX_GRACE_MINUTES}
                dir="ltr"
                value={draft.graceMinutes}
                onChange={(e) => patch({ graceMinutes: Math.round(Number(e.target.value)) })}
                className="w-28 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t.graceHint}</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Toggle checked={draft.allowRetake} onChange={(v) => patch({ allowRetake: v })} label={t.allowRetake} hint={t.allowRetakeHint} />
        <Toggle checked={draft.showResult} onChange={(v) => patch({ showResult: v })} label={t.showResult} hint={t.showResultHint} />
      </div>

      {summary && <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">{summary}</p>}

      {(problem || message) && (
        <p role={problem || message?.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-2 text-sm font-medium ${problem || message?.kind === 'error' ? 'text-rose-500' : 'text-slate-800 dark:text-amber-100'}`}>
          {problem || message?.kind === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {problem ? t.errors[problem] ?? problem : message!.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="md" isLoading={busy} disabled={!dirty || !!problem} onClick={() => save()}>{t.save}</Button>
        {test.ready && draft.mode !== 'open' && (
          <Button variant="secondary" size="md" disabled={busy} leftIcon={<PlayCircle className="w-4 h-4" />} onClick={() => save({ ...draft, mode: 'open' })}>
            {t.openNow}
          </Button>
        )}
        {draft.mode !== 'closed' && (
          <Button variant="outline" size="md" disabled={busy} onClick={() => save({ ...draft, mode: 'closed' })}>{t.closeNow}</Button>
        )}
      </div>
    </article>
  );
};

export const SchedulePanel: React.FC<{ tests: AdminTest[]; adminPassword: string; onChanged: () => Promise<void> }> = ({ tests, adminPassword, onChanged }) => (
  <div className="space-y-5">
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-loose">{t.intro}</p>
    {tests.map((test) => (
      <TestScheduleCard key={test.testId} test={test} adminPassword={adminPassword} onSaved={onChanged} />
    ))}
  </div>
);
