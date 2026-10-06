export { toEnglishDigits } from '../../../shared/validation';

const FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Replaces ASCII digits with Persian digits. */
export function toPersianDigits(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[0-9]/g, (w) => FA[+w]);
}

/** Milliseconds as whole seconds in Persian, e.g. «۱۲۳ ثانیه». */
export function formatSeconds(ms: number): string {
  return `${toPersianDigits(Math.round(ms / 1000))} ثانیه`;
}
