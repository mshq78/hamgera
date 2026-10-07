import React, { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { formatTehran } from '@/core/utils/jalali';
import { toPersianDigits } from '@/core/utils/number';
import { round1 } from '../../../shared/reaction/metrics';
import { hpScores } from '../../../shared/hampayam/metrics';
import { HP_NPS_ID, HP_OVERALL_ID } from '../../../shared/hampayam/questions';
import { RxEvent, RxStoredResponse, rxApi } from './rxApi';

interface Props {
  adminPassword: string;
  events: RxEvent[];
  responses: RxStoredResponse[];
  reload: () => Promise<void>;
}

/** Raw HamPayam responses: no identity exists to show. Delete is a soft delete and always audited. */
export const HpResponsesTable: React.FC<Props> = ({ adminPassword, events, responses, reload }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const toggle = async (r: RxStoredResponse) => {
    if (!r.deleted && !window.confirm('این پاسخ از تحلیل حذف می‌شود (حذف نرم؛ در لاگ می‌ماند). ادامه می‌دهید؟')) return;
    setBusy(r.id);
    const res = r.deleted ? await rxApi.restoreResponse(adminPassword, r.id) : await rxApi.deleteResponse(adminPassword, r.id);
    setBusy(null);
    if (!res.ok) setError('انجام نشد. دوباره تلاش کنید.');
    else await reload();
  };
  if (responses.length === 0) return <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">پاسخی برای این فیلترها نیست.</p>;
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
            <tr>{['زمان ثبت', 'رویداد', 'مدت', 'Experience Index', 'Q25', 'Q26', 'وضعیت', ''].map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 dark:border-slate-800 ${r.deleted ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">{formatTehran(r.submittedAt, false)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{events.find((e) => e.id === r.eventId)?.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{toPersianDigits(r.durationSeconds)} ث{r.durationSeconds < 30 && <span className="mr-1 text-amber-600" title="کمتر از ۳۰ ثانیه">⚑</span>}</td>
                <td className="px-3 py-2 tabular-nums" dir="ltr">{toPersianDigits(round1(hpScores(r).experience_index))}</td>
                <td className="px-3 py-2 tabular-nums">{toPersianDigits(String(r.answers[HP_OVERALL_ID]))}</td>
                <td className="px-3 py-2 tabular-nums">{toPersianDigits(String(r.answers[HP_NPS_ID]))}</td>
                <td className="px-3 py-2">{r.deleted ? 'حذف‌شده' : 'نهایی'}</td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="sm" isLoading={busy === r.id} leftIcon={r.deleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />} onClick={() => toggle(r)}>{r.deleted ? 'بازگردانی' : 'حذف'}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
