import React from 'react';
import { toPersianDigits } from '@/core/utils/number';
import { LIKERT_LABELS } from '../../shared/reaction/questions';

/** Pieces shared by the anonymous survey forms (3T reaction and HamPayam). */

export const newResponseId = () => (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// ---- storage (per link, on this device only) ------------------------------------------------------
export const draftKey = (code: string) => `hamgera:rx:${code}`;
export const doneKey = (code: string) => `hamgera:rx:${code}:done`;
export function load<V>(key: string): V | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the draft simply lives until the tab closes */
  }
}
export function drop(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---- small pieces ---------------------------------------------------------------------------------
export const Message: React.FC<{ icon: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="w-full py-14 flex flex-col items-center text-center gap-3">
    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300">{icon}</div>
    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-amber-100">{title}</h1>
    <div className="text-base text-slate-600 dark:text-slate-300 leading-loose max-w-md">{children}</div>
  </div>
);

/** Five numbered buttons; the labels of both ends of the scale are always visible. */
export const Likert: React.FC<{ id: string; text: string; value: number | undefined; onChange: (v: number) => void; labels?: readonly string[] }> = ({ id, text, value, onChange, labels = LIKERT_LABELS }) => (
  <fieldset className="space-y-2.5">
    <legend className="text-base sm:text-[17px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{text}</legend>
    <div role="radiogroup" aria-labelledby={`${id}-legend`} className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${toPersianDigits(n)} — ${labels[n - 1]}`}
          onClick={() => onChange(n)}
          className={`min-h-[52px] rounded-2xl border text-lg font-bold transition cursor-pointer ${
            value === n
              ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400 shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'
          }`}
        >
          {toPersianDigits(n)}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400" aria-hidden="true">
      <span>{toPersianDigits(1)} · {labels[0]}</span>
      <span>{toPersianDigits(5)} · {labels[4]}</span>
    </div>
  </fieldset>
);

/** 0–10 buttons in two rows (six + five) so each stays easy to tap on a 320 px screen. */
export const Scale010: React.FC<{ text: string; ends: string[]; value: number | undefined; onChange: (v: number) => void }> = ({ text, ends, value, onChange }) => (
  <fieldset className="space-y-2.5">
    <legend className="text-base sm:text-[17px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{text}</legend>
    <div role="radiogroup" className="grid grid-cols-6 gap-2">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={toPersianDigits(n)}
          onClick={() => onChange(n)}
          className={`min-h-[52px] rounded-2xl border text-lg font-bold transition cursor-pointer ${
            value === n
              ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400 shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'
          }`}
        >
          {toPersianDigits(n)}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400" aria-hidden="true">
      <span>{ends[0]}</span>
      <span>{ends[1]}</span>
    </div>
  </fieldset>
);

