import { DIMENSIONS, ItemStats, RxResponse, responseScores, round1, roundNps, summarize } from '../../../shared/reaction/metrics';
import { LIKERT_IDS, LIKERT_QUESTIONS, OPEN_IDS, WORD_COUNT, questionText } from '../../../shared/reaction/questions';
import type { RxEvent } from './rxApi';

/** CSV / Excel layouts of the reaction-evaluation export (spec §9). Pure, so they can be tested without a browser. */

type Cell = string | number | null;

export const RAW_COLUMNS = [
  'response_id', 'event_id', 'event_title', 'event_date', 'cohort', 'segment', 'started_at', 'submitted_at', 'duration_seconds',
  ...LIKERT_IDS, 'Q21', 'Q22', ...OPEN_IDS,
  ...Array.from({ length: WORD_COUNT }, (_, i) => `Q27_word${i + 1}`),
  'design_relevance_score', 'engagement_score', 'facilitation_delivery_score', 'overall_satisfaction_score', 'reaction_index',
];

export function rawRow(event: Pick<RxEvent, 'id' | 'title' | 'eventDate' | 'cohort'>, r: RxResponse): Cell[] {
  const scores = responseScores(r);
  const answer = (id: string): Cell => (r.answers[id] === undefined ? null : r.answers[id]);
  return [
    r.id, event.id, event.title, event.eventDate, event.cohort, r.segment, r.startedAt, r.submittedAt, r.durationSeconds,
    ...LIKERT_IDS.map(answer), answer('Q21'), answer('Q22'), ...OPEN_IDS.map(answer),
    ...Array.from({ length: WORD_COUNT }, (_, i) => r.words[i] ?? null),
    round1(scores.design_relevance), round1(scores.engagement), round1(scores.facilitation_delivery), round1(scores.overall_satisfaction), round1(scores.reaction_index),
  ];
}

export function rawRows(events: RxEvent[], responses: RxResponse[]): Cell[][] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return responses.filter((r) => byId.has(r.eventId)).map((r) => rawRow(byId.get(r.eventId)!, r));
}

/** Neutralises spreadsheet formula injection and quotes the value for CSV. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** UTF-8 with a BOM so Excel reads Persian text correctly. */
export function buildCsv(events: RxEvent[], responses: RxResponse[]): string {
  const lines = [RAW_COLUMNS.map(csvCell).join(','), ...rawRows(events, responses).map((row) => row.map(csvCell).join(','))];
  return '﻿' + lines.join('\n');
}

const itemRow = (s: ItemStats): Cell[] => [s.id, questionText(s.id), s.n, round1(s.mean), round1(s.sd), s.median, round1(s.top2), round1(s.neutral), round1(s.bottom2)];

export interface Sheets {
  raw: Cell[][];
  summary: Cell[][];
  items: Cell[][];
}

/** The three sheets of the Excel export: Raw Responses, Summary (KPI) and Item Analysis (Q01–Q20). */
export function buildSheets(events: RxEvent[], responses: RxResponse[], filterNote: string): Sheets {
  const s = summarize(responses);
  const dims = DIMENSIONS.map((d): Cell[] => [d.title, round1(s.dimensions[d.key])]);
  return {
    raw: [RAW_COLUMNS, ...rawRows(events, responses)],
    summary: [
      ['Metric', 'Value'],
      ['Events', events.map((e) => e.title).join('، ')],
      ['Filters', filterNote],
      ['Final responses', s.n],
      ['Completed in under 60 s (flagged)', s.fast],
      ...dims,
      ['Reaction Index', round1(s.reactionIndex)],
      ['Overall Rating (Q21) mean', round1(s.overall.mean)],
      ['Overall Rating (Q21) median', s.overall.median],
      ['NPS', roundNps(s.nps.score)],
      ['Promoters %', round1(s.nps.promoters)],
      ['Passives %', round1(s.nps.passives)],
      ['Detractors %', round1(s.nps.detractors)],
    ],
    items: [['ID', 'Question', 'N', 'Mean', 'SD', 'Median', 'Top-2 %', 'Neutral %', 'Bottom-2 %'], ...s.items.map(itemRow)],
  };
}

/** Text of every Likert question, for the item-analysis sheet header lookups. */
export const LIKERT_TEXT = Object.fromEntries(LIKERT_QUESTIONS.map((q) => [q.id, q.text]));
