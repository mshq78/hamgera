import { gregorianToJalali, jalaliToGregorian, jalaliMonthLength, jalaliToInstant, instantToJalali, formatTehran } from '../src/core/utils/jalali.js';
import { createChecker } from './harness.js';

export function runJalali() {
  const { results, check, equal } = createChecker();

  // Compare against the platform's own Persian calendar for ~1,500 days around today.
  const f = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  let mismatches = 0;
  let roundTrip = 0;
  for (let t = Date.UTC(2023, 0, 1); t < Date.UTC(2027, 2, 31); t += 86_400_000) {
    const d = new Date(t);
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, Number(x.value.replace(/\D/g, ''))]));
    const [jy, jm, jd] = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (jy !== p.relatedYear && jy !== p.year) mismatches++;
    else if (jm !== p.month || jd !== p.day) mismatches++;
    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    if (gy !== d.getUTCFullYear() || gm !== d.getUTCMonth() + 1 || gd !== d.getUTCDate()) roundTrip++;
  }
  equal('jalali: matches Intl for 4 years of dates', mismatches, 0);
  equal('jalali: round trip', roundTrip, 0);
  equal('jalali: 1 Farvardin 1405 = 21 March 2026', jalaliToGregorian(1405, 1, 1), [2026, 3, 21]);
  equal('month lengths', [jalaliMonthLength(1405, 1), jalaliMonthLength(1405, 7), jalaliMonthLength(1403, 12), jalaliMonthLength(1404, 12)], [31, 30, 30, 29]);

  const iso = jalaliToInstant({ jy: 1405, jm: 7, jd: 15, hour: 10, minute: 30 });
  equal('tehran: 10:30 Tehran is 07:00 UTC', iso, '2026-10-07T07:00:00.000Z');
  equal('tehran: round trip', instantToJalali(iso), { jy: 1405, jm: 7, jd: 15, hour: 10, minute: 30 });
  check('format: mentions the Jalali month and time', /مهر/.test(formatTehran(iso)) && /۱۰:۳۰/.test(formatTehran(iso)), formatTehran(iso));
  return results;
}
