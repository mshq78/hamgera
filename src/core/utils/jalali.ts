/** Gregorian ⇄ Jalali (Solar Hijri) conversion and Tehran wall-clock helpers. Tests compare it with Intl. */

const G_DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  let jy = gy <= 1600 ? 0 : 979;
  const g = gy - (gy <= 1600 ? 621 : 1600);
  const g2 = gm > 2 ? g + 1 : g;
  let days =
    365 * g + Math.floor((g2 + 3) / 4) - Math.floor((g2 + 99) / 100) + Math.floor((g2 + 399) / 400) - 80 + gd + G_DAYS_BEFORE_MONTH[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600;
  const j = jy - (jy <= 979 ? 0 : 979);
  let days = 365 * j + Math.floor(j / 33) * 8 + Math.floor(((j % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthLengths = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && gd > monthLengths[gm]) gd -= monthLengths[gm++];
  return [gy, gm, gd];
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand has 30 days in a leap year: the Jalali year whose Nowruz is 1 Farvardin of jy+1 is 366 days long.
  const [gy, gm, gd] = jalaliToGregorian(jy + 1, 1, 1);
  const [py, pm, pd] = jalaliToGregorian(jy, 12, 30);
  const nextNowruz = Date.UTC(gy, gm - 1, gd);
  const esfand30 = Date.UTC(py, pm - 1, pd);
  // 30 Esfand exists iff it is the day before the next Nowruz.
  return nextNowruz - esfand30 === 86_400_000 ? 30 : 29;
}

// ---- Tehran wall-clock ⇄ instant ---------------------------------------------------------------

const TEHRAN = 'Asia/Tehran';

function tehranParts(ms: number) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute };
}

export interface JalaliDateTime {
  jy: number;
  jm: number;
  jd: number;
  hour: number;
  minute: number;
}

/** The Tehran wall-clock reading of an instant, in Jalali. */
export function instantToJalali(iso: string): JalaliDateTime {
  const t = tehranParts(Date.parse(iso));
  const [jy, jm, jd] = gregorianToJalali(t.y, t.m, t.d);
  return { jy, jm, jd, hour: t.h, minute: t.mi };
}

/** The instant (ISO, UTC) at which clocks in Tehran show the given Jalali date and time. */
export function jalaliToInstant(v: JalaliDateTime): string {
  const [gy, gm, gd] = jalaliToGregorian(v.jy, v.jm, v.jd);
  const wanted = Date.UTC(gy, gm - 1, gd, v.hour, v.minute);
  let guess = wanted - 3.5 * 3600_000; // Iran Standard Time; corrected below should the offset ever differ
  const seen = tehranParts(guess);
  guess += wanted - Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.mi);
  return new Date(guess).toISOString();
}

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // Sunday first (Date#getDay)
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fa = (n: number | string) => String(n).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);

/**
 * «سه‌شنبه ۱۵ مهر ۱۴۰۵، ساعت ۱۰:۳۰» on the Tehran clock. Built from the Jalali parts instead of Intl so the word
 * order and digits are identical in every browser.
 */
export function formatTehran(iso: string, withWeekday = true): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const t = tehranParts(ms);
  const [jy, jm, jd] = gregorianToJalali(t.y, t.m, t.d);
  const weekday = WEEKDAYS[new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()];
  const time = `${String(t.h).padStart(2, '0')}:${String(t.mi).padStart(2, '0')}`;
  return `${withWeekday ? weekday + ' ' : ''}${fa(jd)} ${JALALI_MONTHS[jm - 1]} ${fa(jy)}، ساعت ${fa(time)}`;
}
