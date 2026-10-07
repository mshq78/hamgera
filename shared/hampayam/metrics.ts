import { HP_DIMENSIONS, HP_FUTURE_ID, HP_JOURNEY, HP_JOURNEY_IDS, HP_LIKERT, HP_NA, HP_NPS_ID, HP_OVERALL_ID, HpDimKey } from './questions.js';
import { MIN_GROUP, FAST_SECONDS, itemStats, ItemStats, mean, median, nps, RxResponse } from '../reaction/metrics.js';

export { MIN_GROUP, FAST_SECONDS };

/** HamPayam formulas (spec §9–10). Pure functions over final responses; N/A never enters a mean. */

/** (Likert − 1) × 25 → 0, 25, 50, 75, 100. */
export const normalize = (likert: number): number => (likert - 1) * 25;

export const dimIds = (key: HpDimKey): string[] => HP_LIKERT.filter((q) => q.dim === key).map((q) => q.id);

/** One respondent's six index scores (0–100) and the Experience Index (simple mean of the six). */
export function hpScores(r: Pick<RxResponse, 'answers'>): Record<HpDimKey, number> & { experience_index: number } {
  const out = {} as Record<HpDimKey, number> & { experience_index: number };
  for (const d of HP_DIMENSIONS) out[d.key] = mean(dimIds(d.key).map((id) => normalize(Number(r.answers[id]))));
  out.experience_index = mean(HP_DIMENSIONS.map((d) => out[d.key]));
  return out;
}

export interface HpItem extends ItemStats {
  /** 0–100 */
  score: number;
}

export interface JourneyStat {
  id: string;
  text: string;
  /** rated 1–5 (N/A excluded) */
  n: number;
  /** answered "N/A" */
  na: number;
  mean: number;
  top2: number;
  bottom2: number;
  neutral: number;
}

export interface HpSummary {
  n: number;
  fast: number;
  dimensions: Record<HpDimKey, { score: number; top2: number; n: number }>;
  experienceIndex: number;
  overall: { n: number; mean: number; median: number };
  future: { n: number; mean: number };
  nps: ReturnType<typeof nps>;
  items: HpItem[];
  journey: JourneyStat[];
  peak: JourneyStat | null;
  friction: JourneyStat | null;
}

export function summarizeHp(responses: RxResponse[], totalInvited?: number): HpSummary & { responseRate: number | null } {
  const nums = (id: string) => responses.map((r) => r.answers[id]).filter((v): v is number => typeof v === 'number');
  const items = HP_LIKERT.map((q) => {
    const st = itemStats(q.id, nums(q.id));
    return { ...st, score: normalize(st.mean) };
  });
  const per = responses.map(hpScores);
  const dimensions = {} as HpSummary['dimensions'];
  for (const d of HP_DIMENSIONS) {
    const own = items.filter((i) => HP_LIKERT.find((q) => q.id === i.id)!.dim === d.key);
    const all = responses.flatMap((r) => dimIds(d.key).map((id) => r.answers[id] as number));
    dimensions[d.key] = { score: mean(per.map((p) => p[d.key])), top2: all.length ? (100 * all.filter((v) => v >= 4).length) / all.length : NaN, n: own[0]?.n ?? 0 };
  }
  const journey: JourneyStat[] = HP_JOURNEY.map((j) => {
    const rated = nums(j.id);
    const n = rated.length;
    const pct = (f: (v: number) => boolean) => (n ? (100 * rated.filter(f).length) / n : NaN);
    return {
      id: j.id, text: j.text, n, na: responses.filter((r) => r.answers[j.id] === HP_NA).length, mean: mean(rated),
      top2: pct((v) => v >= 4), neutral: pct((v) => v === 3), bottom2: pct((v) => v <= 2),
    };
  });
  const valid = journey.filter((j) => j.n > 0);
  const peak = valid.length ? valid.reduce((a, b) => (b.mean > a.mean ? b : a)) : null;
  const friction = valid.length ? valid.reduce((a, b) => (b.mean < a.mean ? b : a)) : null;
  return {
    n: responses.length,
    fast: responses.filter((r) => r.durationSeconds < 30).length,
    dimensions,
    experienceIndex: mean(HP_DIMENSIONS.map((d) => dimensions[d.key].score)),
    overall: { n: nums(HP_OVERALL_ID).length, mean: mean(nums(HP_OVERALL_ID)), median: median(nums(HP_OVERALL_ID)) },
    future: { n: nums(HP_FUTURE_ID).length, mean: mean(nums(HP_FUTURE_ID)) },
    nps: nps(nums(HP_NPS_ID)),
    items,
    journey,
    peak,
    friction,
    responseRate: totalInvited && totalInvited > 0 ? (100 * responses.length) / totalInvited : null,
  };
}

/** Spec §19: the five highest-scoring items are «perceived strengths», the five lowest «areas to review». */
export function strengthsAndOpportunities(items: HpItem[]): { strengths: HpItem[]; opportunities: HpItem[] } {
  const byTop2 = [...items].filter((i) => i.n > 0).sort((a, b) => b.top2 - a.top2 || b.mean - a.mean);
  return { strengths: byTop2.slice(0, 5), opportunities: [...byTop2].reverse().slice(0, 5) };
}

/** Management colouring only (configurable thresholds, not a scientific standard): the same bands as the 3T report. */
export const HP_FAST_SECONDS = 30;

// ---- optional filters: a value is offered only when its group has at least MIN_GROUP final responses ----
export type ProfileKey = 'P01' | 'P02' | 'P03';
export function profileGroups(responses: RxResponse[], key: ProfileKey): { value: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const v = r.answers[key];
    if (typeof v === 'string') counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= MIN_GROUP).map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n);
}

export const JOURNEY_IDS = HP_JOURNEY_IDS;
