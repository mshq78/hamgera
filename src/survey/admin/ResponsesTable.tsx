import React, { useState } from 'react';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { Modal } from '@/core/components/Modal';
import { formatTehran } from '@/core/utils/jalali';
import { toPersianDigits } from '@/core/utils/number';
import { FAST_SECONDS, responseScores, round1 } from '../../../shared/reaction/metrics';
import { LIKERT_QUESTIONS, MAX_OPEN_CHARS, MAX_WORD_CHARS, NPS_ID, OPEN_QUESTIONS, OVERALL_ID, WORD_COUNT, questionText } from '../../../shared/reaction/questions';
import { RxEvent, RxStoredResponse, rxApi } from './rxApi';

const field = 'px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm';

interface Props {
  adminPassword: string;
  events: RxEvent[];
  responses: RxStoredResponse[];
  reload: () => Promise<void>;
}

/** Raw responses: every final response with its flags; edit and (soft) delete are admin-only and always audited. */
export const ResponsesTable: React.FC<Props> = ({ adminPassword, events, responses, reload }) => {
  const [editing, setEditing] = useState<RxStoredResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const titleOf = (id: string) => events.find((e) => e.id === id)?.title ?? '';

  const toggleDelete = async (r: RxStoredResponse) => {
    if (!r.deleted && !window.confirm('این پاسخ از تحلیل حذف می‌شود (حذف نرم؛ در لاگ می‌ماند). ادامه می‌دهید؟')) return;
    setBusyId(r.id);
    const res = r.deleted ? await rxApi.restoreResponse(adminPassword, r.id) : await rxApi.deleteResponse(adminPassword, r.id);
    setBusyId(null);
    if (!res.ok) setError('انجام نشد. دوباره تلاش کنید.');
    else await reload();
  };

  if (responses.length === 0) return <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">پاسخی برای این فیلترها نیست.</p>;
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">زمان ارسال</th>
              <th className="px-3 py-2 font-medium">رویداد</th>
              <th className="px-3 py-2 font-medium">گروه</th>
              <th className="px-3 py-2 font-medium">مدت</th>
              <th className="px-3 py-2 font-medium">Reaction Index</th>
              <th className="px-3 py-2 font-medium">Q21 / Q22</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 dark:border-slate-800 ${r.deleted ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">{formatTehran(r.submittedAt, false)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{titleOf(r.eventId)}</td>
                <td className="px-3 py-2">{r.segment ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {toPersianDigits(r.durationSeconds)} ث
                  {r.durationSeconds < FAST_SECONDS && <span className="mr-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">· زیر {toPersianDigits(FAST_SECONDS)} ثانیه</span>}
                </td>
                <td className="px-3 py-2 tabular-nums" dir="ltr">{toPersianDigits(round1(responseScores(r).reaction_index))}</td>
                <td className="px-3 py-2 tabular-nums" dir="ltr">{toPersianDigits(String(r.answers[OVERALL_ID]))} / {toPersianDigits(String(r.answers[NPS_ID]))}</td>
                <td className="px-3 py-2 whitespace-nowrap text-left">
                  {r.deleted && <span className="ml-2 text-[11px] font-semibold text-rose-500">حذف‌شده</span>}
                  {!r.deleted && <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(r)}>ویرایش</Button>}
                  <Button variant="ghost" size="sm" isLoading={busyId === r.id} leftIcon={r.deleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />} onClick={() => toggleDelete(r)}>{r.deleted ? 'بازگردانی' : 'حذف'}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <EditModal response={editing} segments={events.find((e) => e.id === editing.eventId)?.segments ?? []} adminPassword={adminPassword} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}
    </div>
  );
};

const EditModal: React.FC<{ response: RxStoredResponse; segments: string[]; adminPassword: string; onClose: () => void; onSaved: () => Promise<void> }> = ({ response, segments, adminPassword, onClose, onSaved }) => {
  const [answers, setAnswers] = useState<Record<string, number | string>>({ ...response.answers });
  const [words, setWords] = useState<string[]>(Array.from({ length: WORD_COUNT }, (_, i) => response.words[i] ?? ''));
  const [segment, setSegment] = useState<string>(response.segment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const changes: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(answers)) if (v !== response.answers[id]) changes[id] = v;
    for (const q of OPEN_QUESTIONS) if (response.answers[q.id] !== undefined && answers[q.id] === undefined) changes[q.id] = '';
    const cleanWords = words.map((w) => w.trim()).filter(Boolean);
    if (cleanWords.join('|') !== response.words.join('|')) changes.Q27 = cleanWords;
    if ((segment || null) !== response.segment) changes.segment = segment || null;
    if (Object.keys(changes).length === 0) return onClose();
    setBusy(true);
    setError('');
    const res = await rxApi.editResponse(adminPassword, response.id, changes);
    setBusy(false);
    if (!res.ok) return setError(res.error === 'invalid_changes' ? 'مقدار نامعتبر است.' : 'ذخیره انجام نشد.');
    await onSaved();
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title="ویرایش پاسخ (در لاگ ثبت می‌شود)" maxWidth="xl">
      <div className="space-y-4">
        {segments.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            گروه
            <select className={field} value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="">—</option>
              {segments.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {[...LIKERT_QUESTIONS.map((q) => ({ id: q.id, max: 5, min: 1 })), { id: OVERALL_ID, max: 10, min: 0 }, { id: NPS_ID, max: 10, min: 0 }].map((q) => (
            <label key={q.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate" title={questionText(q.id)}>{toPersianDigits(q.id)} · {questionText(q.id)}</span>
              <select className={field} value={Number(answers[q.id])} onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })} aria-label={q.id}>
                {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => <option key={n} value={n}>{toPersianDigits(n)}</option>)}
              </select>
            </label>
          ))}
        </div>
        {OPEN_QUESTIONS.map((q) => (
          <label key={q.id} className="block text-xs space-y-1">
            <span>{toPersianDigits(q.id)} · {q.text}</span>
            <textarea rows={2} maxLength={MAX_OPEN_CHARS} className={`${field} w-full`} value={String(answers[q.id] ?? '')} onChange={(e) => { const next = { ...answers }; if (e.target.value) next[q.id] = e.target.value; else delete next[q.id]; setAnswers(next); }} />
          </label>
        ))}
        <div className="space-y-1">
          <span className="text-xs">Q27 · سه کلمه</span>
          <div className="grid grid-cols-3 gap-2">
            {words.map((w, i) => <input key={i} className={field} maxLength={MAX_WORD_CHARS} value={w} aria-label={`Q27 ${toPersianDigits(i + 1)}`} onChange={(e) => setWords(words.map((x, k) => (k === i ? e.target.value : x)))} />)}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="md" disabled={busy} onClick={onClose}>انصراف</Button>
          <Button variant="primary" size="md" isLoading={busy} onClick={save}>ذخیره تغییرها</Button>
        </div>
      </div>
    </Modal>
  );
};
