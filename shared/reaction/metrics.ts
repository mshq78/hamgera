import { DimensionKey, LIKERT_IDS, LIKERT_QUESTIONS, NPS_ID, OVERALL_ID, SECTIONS } from './questions.js';

/** The reaction-evaluation formulas (spec appendix A). Pure functions; computed only from submitted responses. */

export interface RxResponse {
  id: string;
  eventId: string;
  segment: string | null;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  /** Q01–Q22 numbers, Q23–Q26 texts */
  answers: Record<string, number | string>;
  /** Q27, up to three words */
  words: string[];
}

export const DIMENSIONS: { key: DimensionKey; title: string; ids: string[] }[] = SECTIONS.map((s) => ({
  key: s.dimension,
  title: ({ design_relevance: 'Design & Relevance', engagement: 'Engagement', facilitation_delivery: 'Facilitation & Delivery', overall_satisfaction: 'Overall Satisfaction' } as const)[s.dimension],
  ids: LIKERT_QUESTIONS.filter((x) => x.section === s.key).map((x) => x.id),
}));

/** Responses completed faster than this are flagged (never removed automatically). */
export const FAST_SECONDS = 60;
/** A subgroup with fewer final responses than this is not shown (privacy). */
export const MIN_GROUP = 5;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Sample standard deviation (n − 1); 0 for a single value. */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** ((mean − 1) ÷ 4) × 100 — a 1–5 mean as a 0–100 score. */
export const dimensionScore = (likertMean: number): number => ((likertMean - 1) / 4) * 100;

export const reactionIndex = (scores: number[]): number => mean(scores);

export type NpsGroup = 'promoter' | 'passive' | 'detractor';
export const npsGroup = (score: number): NpsGroup => (score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor');

/** % promoters − % detractors, from −100 to +100. */
export function nps(scores: number[]): { score: number; promoters: number; passives: number; detractors: number; n: number } {
  const n = scores.length;
  if (!n) return { score: NaN, promoters: NaN, passives: NaN, detractors: NaN, n: 0 };
  const count = (g: NpsGroup) => scores.filter((s) => npsGroup(s) === g).length;
  const promoters = (100 * count('promoter')) / n;
  const passives = (100 * count('passive')) / n;
  const detractors = (100 * count('detractor')) / n;
  return { score: promoters - detractors, promoters, passives, detractors, n };
}

export interface ItemStats {
  id: string;
  n: number;
  mean: number;
  sd: number;
  median: number;
  top2: number; // % answering 4 or 5
  neutral: number; // % answering 3
  bottom2: number; // % answering 1 or 2
}

export function itemStats(id: string, values: number[]): ItemStats {
  const n = values.length;
  const pct = (f: (v: number) => boolean) => (n ? (100 * values.filter(f).length) / n : NaN);
  return { id, n, mean: mean(values), sd: sd(values), median: median(values), top2: pct((v) => v >= 4), neutral: pct((v) => v === 3), bottom2: pct((v) => v <= 2) };
}

/** One respondent's four dimension scores and the Reaction Index (as in the CSV export). */
export function responseScores(r: Pick<RxResponse, 'answers'>) {
  const scores = {} as Record<DimensionKey, number>;
  for (const d of DIMENSIONS) scores[d.key] = dimensionScore(mean(d.ids.map((id) => Number(r.answers[id]))));
  return { ...scores, reaction_index: reactionIndex(DIMENSIONS.map((d) => scores[d.key])) };
}

export type ReactionStatus = 'excellent' | 'good' | 'attention' | 'improve';
export const REACTION_STATUS: { status: ReactionStatus; label: string; behavior: string }[] = [
  { status: 'excellent', label: 'بسیار مطلوب', behavior: 'نمایش مثبت' },
  { status: 'good', label: 'مطلوب', behavior: 'عادی' },
  { status: 'attention', label: 'نیازمند توجه', behavior: 'هشدار' },
  { status: 'improve', label: 'نیازمند اصلاح', behavior: 'هشدار پررنگ' },
];

/** Dashboard thresholds (management colouring only, not a scientific standard). */
export function reactionStatus(index: number): ReactionStatus {
  return index >= 85 ? 'excellent' : index >= 75 ? 'good' : index >= 65 ? 'attention' : 'improve';
}
export function top2Status(top2: number): ReactionStatus {
  return top2 >= 80 ? 'excellent' : top2 >= 70 ? 'good' : top2 >= 60 ? 'attention' : 'improve';
}

export interface Summary {
  n: number;
  fast: number;
  dimensions: Record<DimensionKey, number>;
  reactionIndex: number;
  overall: { n: number; mean: number; median: number; distribution: number[] };
  nps: ReturnType<typeof nps>;
  items: ItemStats[];
}

/** Everything the dashboard shows for a set of final responses. */
export function summarize(responses: RxResponse[]): Summary {
  const per = responses.map(responseScores);
  const dimensions = {} as Record<DimensionKey, number>;
  for (const d of DIMENSIONS) dimensions[d.key] = mean(per.map((p) => p[d.key]));
  const overall = responses.map((r) => Number(r.answers[OVERALL_ID])).filter(Number.isFinite);
  const distribution = Array.from({ length: 11 }, (_, i) => overall.filter((v) => v === i).length);
  return {
    n: responses.length,
    fast: responses.filter((r) => r.durationSeconds < FAST_SECONDS).length,
    dimensions,
    reactionIndex: reactionIndex(DIMENSIONS.map((d) => dimensions[d.key])),
    overall: { n: overall.length, mean: mean(overall), median: median(overall), distribution },
    nps: nps(responses.map((r) => Number(r.answers[NPS_ID])).filter(Number.isFinite)),
    items: LIKERT_IDS.map((id) => itemStats(id, responses.map((r) => Number(r.answers[id])).filter(Number.isFinite))),
  };
}

/** Subgroups for comparison; groups below MIN_GROUP are reported as hidden, never with their numbers. */
export function bySegment(responses: RxResponse[]): { segment: string; n: number; hidden: boolean; summary: Summary | null }[] {
  const names = [...new Set(responses.map((r) => r.segment ?? ''))].filter(Boolean).sort();
  return names.map((segment) => {
    const group = responses.filter((r) => r.segment === segment);
    const hidden = group.length < MIN_GROUP;
    return { segment, n: group.length, hidden, summary: hidden ? null : summarize(group) };
  });
}

// ---- word cloud (Q27) ---------------------------------------------------------------------------

const STOP_WORDS = new Set(
  ['و', 'در', 'به', 'از', 'که', 'این', 'آن', 'با', 'برای', 'را', 'یک', 'هم', 'یا', 'تا', 'بود', 'است', 'می', 'شد', 'های', 'ها', 'بر', 'هر', 'بسیار', 'خیلی', 'خوب']
);

export const normalizeWord = (w: string): string =>
  w.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟـ]/g, '').replace(/[\s‌]+/g, ' ').replace(/[.,،؛:!؟?"'«»()\-_]+/g, '').trim();

export function wordFrequency(responses: Pick<RxResponse, 'words'>[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of responses)
    for (const raw of r.words) {
      const w = normalizeWord(raw);
      if (w && !STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'fa'));
}

/** Rounding rule: NPS to a whole number, every other figure to one decimal. */
export const round1 = (x: number): number => Math.round(x * 10) / 10;
export const roundNps = (x: number): number => Math.round(x);
