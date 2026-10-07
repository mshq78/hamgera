import { randomBytes, randomUUID } from 'node:crypto';
import { db, Row } from './db.js';
import type { RxResponse } from '../../shared/reaction/metrics.js';
import { WORDS_ID } from '../../shared/reaction/questions.js';
import { EventWindow, eventStatus } from '../../shared/reaction/validate.js';
import { HpConfig, hpConfig } from '../../shared/hampayam/questions.js';

export type SurveyKind = 'tt' | 'hampayam';

/** Shared server helpers for the anonymous reaction surveys (api/survey.ts and api/reaction.ts). */

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes

/** Six characters keep the link short enough for an SMS (31^6 ≈ 887 million possible codes). */
export const EVENT_CODE_LENGTH = 6;

export function newEventCode(): string {
  const bytes = randomBytes(EVENT_CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
export const newId = () => randomUUID();

const day = (v: unknown): string | null => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

export interface EventRow {
  id: string;
  code: string;
  title: string;
  eventDate: string | null;
  cohort: string | null;
  location: string | null;
  segments: string[];
  isActive: boolean;
  opensAt: string | null;
  closesAt: string | null;
  surveyVersion: string;
  kind: SurveyKind;
  config: HpConfig;
  createdAt: string;
}

export function eventFromRow(r: Row): EventRow {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    eventDate: r.event_date instanceof Date ? r.event_date.toISOString().slice(0, 10) : day(r.event_date),
    cohort: r.cohort,
    location: r.location,
    segments: Array.isArray(r.segments) ? r.segments : [],
    isActive: !!r.is_active,
    opensAt: iso(r.opens_at),
    closesAt: iso(r.closes_at),
    surveyVersion: r.survey_version,
    kind: r.kind === 'hampayam' ? 'hampayam' : 'tt',
    config: hpConfig(r.config),
    createdAt: iso(r.created_at)!,
  };
}

export const windowOf = (e: EventRow): EventWindow => ({ isActive: e.isActive, opensAt: e.opensAt, closesAt: e.closesAt });
export const statusOf = (e: EventRow, now = Date.now()) => eventStatus(windowOf(e), now);

export async function eventByCode(code: string): Promise<EventRow | null> {
  const sql = await db();
  const rows = await sql`SELECT * FROM hamgera_rx_events WHERE code = ${code}`;
  return rows[0] ? eventFromRow(rows[0]) : null;
}

export async function eventById(id: string): Promise<EventRow | null> {
  const sql = await db();
  const rows = await sql`SELECT * FROM hamgera_rx_events WHERE id = ${id}`;
  return rows[0] ? eventFromRow(rows[0]) : null;
}

export interface StoredResponse extends RxResponse {
  deleted: boolean;
  clientVersion: string | null;
  /** manual tags per open question */
  tags: Record<string, string[]>;
}

/** Final responses of the given events with their answers folded back into one object each. */
export async function loadResponses(eventIds: string[], includeDeleted: boolean): Promise<StoredResponse[]> {
  if (eventIds.length === 0) return [];
  const sql = await db();
  const rows = await sql`
    SELECT r.id, r.event_id, r.segment, r.started_at, r.submitted_at, r.duration_seconds, r.client_version, r.deleted_at,
           a.question_id, a.numeric_value, a.text_value, a.word_index, a.tags
    FROM hamgera_rx_responses r
    JOIN hamgera_rx_answers a ON a.response_id = r.id
    WHERE r.event_id = ANY(${eventIds}::text[]) AND r.status = 'submitted'
      AND (${includeDeleted}::boolean OR r.deleted_at IS NULL)
    ORDER BY r.submitted_at, r.id
  `;
  const out = new Map<string, StoredResponse>();
  const words = new Map<string, { index: number; word: string }[]>();
  for (const r of rows) {
    let o = out.get(r.id);
    if (!o) {
      o = {
        id: r.id, eventId: r.event_id, segment: r.segment, startedAt: iso(r.started_at)!, submittedAt: iso(r.submitted_at)!,
        durationSeconds: r.duration_seconds, answers: {}, words: [], deleted: !!r.deleted_at, clientVersion: r.client_version, tags: {},
      };
      out.set(r.id, o);
    }
    if (r.question_id === WORDS_ID && r.word_index !== null && r.word_index !== undefined) {
      const list = words.get(r.id) ?? [];
      list.push({ index: r.word_index ?? 0, word: r.text_value });
      words.set(r.id, list);
    } else if (r.numeric_value !== null && r.numeric_value !== undefined) {
      o.answers[r.question_id] = Number(r.numeric_value);
    } else if (r.text_value !== null) {
      o.answers[r.question_id] = r.text_value;
    }
    if (Array.isArray(r.tags) && r.tags.length) o.tags[r.question_id] = r.tags;
  }
  for (const [id, list] of words) out.get(id)!.words = list.sort((a, b) => a.index - b.index).map((x) => x.word);
  return [...out.values()];
}

/** The rows to insert for a clean submission (Q27 becomes one row per word). */
export function answerRows(answers: Record<string, number | string>, words: string[]) {
  const rows: { q: string; n: number | null; t: string | null; w: number | null }[] = [];
  for (const [q, v] of Object.entries(answers)) rows.push(typeof v === 'number' ? { q, n: v, t: null, w: null } : { q, n: null, t: v, w: null });
  words.forEach((word, i) => rows.push({ q: WORDS_ID, n: null, t: word, w: i + 1 }));
  return rows;
}
