import React, { useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { JalaliDateTimeInput } from '@/core/components/JalaliDateTimeInput';
import { dayToInstant, instantToDay } from '@/core/utils/jalali';
import { DEFAULT_EVENT_TITLE } from '../../../shared/reaction/questions';
import { HP_DEFAULT_TITLE } from '../../../shared/hampayam/questions';
import type { EventInput, RxEvent } from './rxApi';

const input = 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const errors: Record<string, string> = {
  invalid_title: 'عنوان لازم است.',
  closes_before_opens: 'زمان پایان باید بعد از زمان شروع باشد.',
  invalid_date: 'تاریخ معتبر نیست.',
};

interface Props {
  event: RxEvent | null;
  onClose: () => void;
  onSave: (e: EventInput) => Promise<string | null>;
}

/** Create or edit an event: title, date, group, place, the groups respondents may pick, schedule and on/off. */
export const EventForm: React.FC<Props> = ({ event, onClose, onSave }) => {
  const [kind, setKind] = useState<'tt' | 'hampayam'>(event?.kind ?? 'tt');
  const [p02, setP02] = useState(event?.config.profileP02 ?? true);
  const [p03, setP03] = useState(event?.config.profileP03 ?? true);
  const [title, setTitle] = useState(event?.title ?? DEFAULT_EVENT_TITLE);
  const [day, setDay] = useState<string | null>(event?.eventDate ?? null);
  const [cohort, setCohort] = useState(event?.cohort ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [segments, setSegments] = useState((event?.segments ?? []).join('\n'));
  const [isActive, setIsActive] = useState(event?.isActive ?? true);
  const [opensAt, setOpensAt] = useState<string | null>(event?.opensAt ?? null);
  const [closesAt, setClosesAt] = useState<string | null>(event?.closesAt ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await onSave({
      title, eventDate: day, cohort: cohort.trim() || null, location: location.trim() || null,
      segments: segments.split('\n').map((s) => s.trim()).filter(Boolean), isActive, opensAt, closesAt, kind, config: { profileP02: p02, profileP03: p03 },
    });
    setBusy(false);
    if (err) setError(errors[err] ?? 'ذخیره انجام نشد.');
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={event ? 'ویرایش رویداد' : 'رویداد جدید'} maxWidth="lg">
      <form onSubmit={submit} className="space-y-4">
        {!event && (
          <div role="radiogroup" aria-label="نوع ارزیابی" className="grid grid-cols-2 gap-2">
            {([['tt', 'ارزیابی واکنش ۳ت', DEFAULT_EVENT_TITLE], ['hampayam', 'تجربه هم‌پیام', HP_DEFAULT_TITLE]] as const).map(([k, label, t]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setTitle((cur) => (cur === DEFAULT_EVENT_TITLE || cur === HP_DEFAULT_TITLE ? t : cur)); }}
                className={`px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer ${kind === k ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400' : 'border-slate-300 dark:border-slate-700'}`}>{label}</button>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="ev-title" className="block text-xs font-semibold mb-1">عنوان</label>
          <input id="ev-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <JalaliDateTimeInput label="تاریخ برگزاری" value={day ? dayToInstant(day) : null} dateOnly optional onChange={(iso) => setDay(iso ? instantToDay(iso) : null)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-cohort" className="block text-xs font-semibold mb-1">گروه / دوره (اختیاری)</label>
            <input id="ev-cohort" className={input} value={cohort} onChange={(e) => setCohort(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label htmlFor="ev-loc" className="block text-xs font-semibold mb-1">محل (اختیاری)</label>
            <input id="ev-loc" className={input} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
          </div>
        </div>
        <div>
          <label htmlFor="ev-seg" className="block text-xs font-semibold mb-1">{kind === 'hampayam' ? 'شرکت/واحدهایی که شرکت‌کننده می‌تواند انتخاب کند — P01 (هر خط یکی)' : 'گروه‌هایی که شرکت‌کننده می‌تواند انتخاب کند (هر خط یکی)'}</label>
          <textarea id="ev-seg" rows={3} className={input} value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="مثلاً: مدیران&#10;کارشناسان" />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">اگر خالی بماند، این سؤال در فرم نمایش داده نمی‌شود. انتخاب گروه اختیاری است.</p>
        </div>
        {kind === 'hampayam' && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-amber-500" checked={p02} onChange={(e) => setP02(e.target.checked)} />سطح مسئولیت (P02)</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-amber-500" checked={p03} onChange={(e) => setP03(e.target.checked)} />سابقه حضور در هلدینگ (P03)</label>
          </div>
        )}
        <div className="space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
          <JalaliDateTimeInput label="شروع دریافت پاسخ (اختیاری)" value={opensAt} optional onChange={setOpensAt} />
          <JalaliDateTimeInput label="پایان دریافت پاسخ (اختیاری)" value={closesAt} optional startFrom={opensAt} onChange={setClosesAt} />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">زمان‌ها به وقت تهران است. کسی که پیش از پایان شروع کرده تا ۱۵ دقیقه بعد از پایان هم می‌تواند ارسال کند.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          فرم فعال است (با خاموش کردن، لینک فوراً بسته می‌شود)
        </label>
        {error && <p role="alert" className="text-sm text-rose-500 font-medium">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="md" disabled={busy} onClick={onClose}>انصراف</Button>
          <Button type="submit" variant="primary" size="md" isLoading={busy}>ذخیره</Button>
        </div>
      </form>
    </Modal>
  );
};
