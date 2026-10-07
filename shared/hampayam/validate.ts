import { HP_JOURNEY_IDS, HP_LIKERT_IDS, HP_NA, HP_OPEN, HP_PROFILE, HP_SCALE_IDS, HpConfig } from './questions.js';
import { sanitizeText } from '../reaction/validate.js';

const intIn = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export interface CleanHp {
  startedAt: string;
  answers: Record<string, number | string>;
}
export type HpError = 'invalid_answers' | 'invalid_profile' | 'invalid_time';

/**
 * Rebuilds a HamPayam submission from known fields only: Q01–Q24 integer 1–5 and Q25–Q27 integer 0–10 (all required),
 * J01–J10 optional 1–5 or "NA", O01–O05 optional text within each limit, P01–P03 optional single choices.
 */
export function cleanHampayam(body: any, companies: string[], config: HpConfig): CleanHp | { error: HpError } {
  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object') return { error: 'invalid_answers' };
  const a = body.answers;
  const answers: Record<string, number | string> = {};
  for (const id of HP_LIKERT_IDS) {
    const v = intIn(a[id], 1, 5);
    if (v === null) return { error: 'invalid_answers' };
    answers[id] = v;
  }
  for (const id of HP_SCALE_IDS) {
    const v = intIn(a[id], 0, 10);
    if (v === null) return { error: 'invalid_answers' };
    answers[id] = v;
  }
  for (const id of HP_JOURNEY_IDS) {
    if (a[id] === undefined || a[id] === null || a[id] === '') continue;
    if (a[id] === HP_NA) answers[id] = HP_NA;
    else {
      const v = intIn(a[id], 1, 5);
      if (v === null) return { error: 'invalid_answers' };
      answers[id] = v;
    }
  }
  for (const q of HP_OPEN) {
    const t = sanitizeText(a[q.id], q.max);
    if (t) answers[q.id] = t;
  }
  for (const p of HP_PROFILE) {
    const v = a[p.id];
    if (v === undefined || v === null || v === '') continue;
    const options = p.id === 'P01' ? companies : p.options!;
    const enabled = p.id === 'P01' ? companies.length > 0 : p.id === 'P02' ? config.profileP02 : config.profileP03;
    if (!enabled || typeof v !== 'string' || !options.includes(v)) return { error: 'invalid_profile' };
    answers[p.id] = v;
  }
  const t = typeof body.startedAt === 'string' ? Date.parse(body.startedAt) : NaN;
  if (!Number.isFinite(t)) return { error: 'invalid_time' };
  return { startedAt: new Date(t).toISOString(), answers };
}
