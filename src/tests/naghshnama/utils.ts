import { toPersianDigits } from '@/core/utils/number';

export { toPersianDigits };

/** A short code the participant can quote when asking about their result, e.g. «۴۸۲۱-NQ3». */
export function generateTrackingCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suffix = 'NQ' + (Math.floor(Math.random() * 9) + 1);
  return `${toPersianDigits(num)}-${suffix}`;
}

/** A score with one decimal place and Persian digits. */
export function formatScore(score: number): string {
  return toPersianDigits((Math.round(score * 10) / 10).toFixed(1));
}

export function formatPercent(percent: number): string {
  return `${toPersianDigits(Math.round(percent))}٪`;
}

/** Milliseconds as seconds with one decimal, in Persian. */
export function formatSeconds(ms: number): string {
  return `${toPersianDigits((ms / 1000).toFixed(1))} ثانیه`;
}
export const toFarsiDigits = toPersianDigits;
