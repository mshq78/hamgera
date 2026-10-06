import React from 'react';
import { ADMIN } from '../content/admin.fa';
import { toPersianDigits } from '../utils/number';
import { JALALI_MONTHS, JalaliDateTime, formatTehran, formatTehranDate, instantToJalali, jalaliMonthLength, jalaliToInstant } from '../utils/jalali';
import { Button } from './Button';

const t = ADMIN.schedule;
const selectClass =
  'px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

interface Props {
  label: string;
  /** ISO instant, or null when no time is set. */
  value: string | null;
  onChange: (iso: string | null) => void;
  /** An optional time can be cleared. */
  optional?: boolean;
  disabled?: boolean;
  /** When no time is set yet, «تعیین زمان» starts one hour after this instant (default: now). */
  startFrom?: string | null;
  /** Only the day matters (hour and minute are hidden and fixed at noon). */
  dateOnly?: boolean;
}

/** Picks a Jalali date and a time on the Tehran clock; the value is the matching UTC instant. */
export const JalaliDateTimeInput: React.FC<Props> = ({ label, value, onChange, optional = false, disabled = false, startFrom = null, dateOnly = false }) => {
  const parts = value ? instantToJalali(value) : null;

  const commit = (next: JalaliDateTime) => {
    const day = Math.min(next.jd, jalaliMonthLength(next.jy, next.jm));
    onChange(jalaliToInstant({ ...next, jd: day, ...(dateOnly ? { hour: 12, minute: 0 } : {}) }));
  };

  if (!parts) {
    return (
      <div className="space-y-1">
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const from = startFrom ? Date.parse(startFrom) : Date.now();
            const base = instantToJalali(new Date(Math.ceil((from + 3600_000) / 3600_000) * 3600_000).toISOString());
            commit({ ...base, minute: 0 });
          }}
        >
          {t.setTime}
        </Button>
      </div>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => instantToJalali(new Date().toISOString()).jy - 1 + i);
  if (!years.includes(parts.jy)) years.push(parts.jy);
  const days = Array.from({ length: jalaliMonthLength(parts.jy, parts.jm) }, (_, i) => i + 1);

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t.day} className={selectClass} value={parts.jd} onChange={(e) => commit({ ...parts, jd: Number(e.target.value) })}>
          {days.map((d) => <option key={d} value={d}>{toPersianDigits(d)}</option>)}
        </select>
        <select aria-label={t.month} className={selectClass} value={parts.jm} onChange={(e) => commit({ ...parts, jm: Number(e.target.value) })}>
          {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select aria-label={t.year} className={selectClass} value={parts.jy} onChange={(e) => commit({ ...parts, jy: Number(e.target.value) })}>
          {[...years].sort((a, b) => a - b).map((y) => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
        </select>
        {!dateOnly && <span className="text-xs text-slate-500 dark:text-slate-400">{t.hour}</span>}
        {!dateOnly && <select aria-label={t.hour} className={selectClass} value={parts.hour} onChange={(e) => commit({ ...parts, hour: Number(e.target.value) })}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
        </select>}
        {!dateOnly && <span aria-hidden="true">:</span>}
        {!dateOnly && <select aria-label={t.minute} className={selectClass} value={parts.minute} onChange={(e) => commit({ ...parts, minute: Number(e.target.value) })}>
          {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
        </select>}
        {optional && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>{t.clearTime}</Button>
        )}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{dateOnly ? formatTehranDate(value!) : `${formatTehran(value!)} · ${t.tehranTime}`}</p>
    </fieldset>
  );
};
