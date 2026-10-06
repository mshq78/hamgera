const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** Converts Persian/Arabic-Indic digits to ASCII digits. */
export const toEnglishDigits = (s: string): string => s.replace(/[۰-۹٠-٩]/g, (c) => DIGIT_MAP[c] ?? c);

/** Normalises an Iranian mobile number to `09xxxxxxxxx`, or null. */
export function normalizeIranMobile(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let s = toEnglishDigits(String(input)).replace(/[\s-]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (/^9\d{9}$/.test(s)) s = '0' + s;
  return /^09\d{9}$/.test(s) ? s : null;
}

/** Normalises an Iranian national ID (10 digits, leading zeros kept) and verifies its check digit. */
export function normalizeNationalId(input: unknown, padShort = false): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let s = toEnglishDigits(String(input)).replace(/[\s-]/g, '');
  if (padShort && /^\d{8,9}$/.test(s)) s = s.padStart(10, '0'); // Excel drops leading zeros
  if (!/^\d{10}$/.test(s) || /^(\d)\1{9}$/.test(s)) return null;
  const sum = s.slice(0, 9).split('').reduce((acc, d, i) => acc + Number(d) * (10 - i), 0) % 11;
  const check = Number(s[9]);
  return (sum < 2 ? check === sum : check === 11 - sum) ? s : null;
}

/** Persian-izes Arabic yeh/kaf and collapses whitespace. */
export const cleanPersianText = (v: string): string => v.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
