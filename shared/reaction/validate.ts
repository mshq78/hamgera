import { LIKERT_IDS, MAX_OPEN_CHARS, MAX_WORD_CHARS, NPS_ID, OPEN_IDS, OVERALL_ID, WORD_COUNT } from './questions.js';
import { canSubmit, effectiveStatus, TestStatus } from '../schedule.js';

/** Strips markup and control characters, collapses blanks, and cuts to `max` characters. */
export function sanitizeText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

const intIn = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

export interface CleanSubmission {
  segment: string | null;
  startedAt: string;
  answers: Record<string, number | string>;
  words: string[];
}

export type SubmissionError = 'invalid_answers' | 'invalid_words' | 'invalid_segment' | 'invalid_time';

/**
 * Validates and rebuilds a submission from known fields only (Q01–Q20: integer 1–5, Q21–Q22: integer 0–10,
 * Q23–Q26: optional text ≤ 500, Q27: one to three words ≤ 30). Returns an error code instead of throwing.
 */
export function cleanSubmission(body: any, allowedSegments: string[]): CleanSubmission | { error: SubmissionError } {
  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object') return { error: 'invalid_answers' };
  const answers: Record<string, number | string> = {};
  for (const id of LIKERT_IDS) {
    const v = intIn(body.answers[id], 1, 5);
    if (v === null) return { error: 'invalid_answers' };
    answers[id] = v;
  }
  for (const id of [OVERALL_ID, NPS_ID]) {
    const v = intIn(body.answers[id], 0, 10);
    if (v === null) return { error: 'invalid_answers' };
    answers[id] = v;
  }
  for (const id of OPEN_IDS) {
    const t = sanitizeText(body.answers[id], MAX_OPEN_CHARS);
    if (t) answers[id] = t;
  }

  const rawWords: unknown[] = Array.isArray(body.words) ? body.words.slice(0, WORD_COUNT) : [];
  const words = rawWords.map((w) => sanitizeText(w, MAX_WORD_CHARS).replace(/\s*\n\s*/g, ' ')).filter(Boolean);
  if (words.length < 1) return { error: 'invalid_words' };

  let segment: string | null = null;
  if (body.segment !== undefined && body.segment !== null && body.segment !== '') {
    if (typeof body.segment !== 'string' || !allowedSegments.includes(body.segment)) return { error: 'invalid_segment' };
    segment = body.segment;
  }

  const t = typeof body.startedAt === 'string' ? Date.parse(body.startedAt) : NaN;
  if (!Number.isFinite(t)) return { error: 'invalid_time' };
  return { segment, startedAt: new Date(t).toISOString(), answers, words };
}

// ---- event availability ----------------------------------------------------------------------

export interface EventWindow {
  isActive: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export const SURVEY_GRACE_MINUTES = 15;

/** open / upcoming / ended / closed (switched off by the admin). */
export function eventStatus(e: EventWindow, now: number): TestStatus {
  if (!e.isActive) return 'closed';
  return effectiveStatus({ mode: 'scheduled', opensAt: e.opensAt ?? '1970-01-01T00:00:00Z', closesAt: e.closesAt, graceMinutes: SURVEY_GRACE_MINUTES }, now);
}

/** May a response be stored now? Open, or within the grace period for someone who started before the end. */
export function eventAccepts(e: EventWindow, startedAt: string, now: number): boolean {
  if (!e.isActive) return false;
  return canSubmit({ mode: 'scheduled', opensAt: e.opensAt ?? '1970-01-01T00:00:00Z', closesAt: e.closesAt, graceMinutes: SURVEY_GRACE_MINUTES }, startedAt, now);
}
