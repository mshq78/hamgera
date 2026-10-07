import { round1, roundNps, RxResponse } from '../../../shared/reaction/metrics';
import { HP_DIMENSIONS, HP_JOURNEY, HP_JOURNEY_IDS, HP_LIKERT, HP_LIKERT_IDS, HP_NA, HP_OPEN, HP_OPEN_IDS, HP_PROFILE, HP_SCALE_010, hpQuestionText } from '../../../shared/hampayam/questions';
import { hpScores, summarizeHp } from '../../../shared/hampayam/metrics';
import { csvCell } from './exports';
import type { RxEvent } from './rxApi';

/** CSV / Excel layouts of the HamPayam export (spec §12). The response id is a random UUID; no token or identity exists. */

type Cell = string | number | null;

export const HP_RAW_COLUMNS = [
  'response_id', 'event_id', 'event_title', 'event_date', 'cohort', 'started_at', 'submitted_at', 'duration_seconds', 'suspicious_fast',
  'P01', 'P02', 'P03', ...HP_LIKERT_IDS, ...HP_SCALE_010.map((q) => q.id), ...HP_JOURNEY_IDS, ...HP_OPEN_IDS,
  ...HP_DIMENSIONS.map((d) => d.key), 'experience_index',
];

const cell = (r: RxResponse, id: string): Cell => (r.answers[id] === undefined ? null : r.answers[id]);

export function hpRawRows(events: RxEvent[], responses: RxResponse[]): Cell[][] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return responses
    .filter((r) => byId.has(r.eventId))
    .map((r) => {
      const e = byId.get(r.eventId)!;
      const sc = hpScores(r);
      return [
        r.id, e.id, e.title, e.eventDate, e.cohort, r.startedAt, r.submittedAt, r.durationSeconds, r.durationSeconds < 30 ? 1 : 0,
        ...['P01', 'P02', 'P03'].map((id) => cell(r, id)), ...HP_LIKERT_IDS.map((id) => cell(r, id)), ...HP_SCALE_010.map((q) => cell(r, q.id)),
        ...HP_JOURNEY_IDS.map((id) => cell(r, id)), ...HP_OPEN_IDS.map((id) => cell(r, id)),
        ...HP_DIMENSIONS.map((d) => round1(sc[d.key])), round1(sc.experience_index),
      ];
    });
}

/** Closed answers in one CSV (UTF-8 with BOM); open answers in a second one, so free text never sits among the numbers. */
export function hpCsv(events: RxEvent[], responses: RxResponse[]): string {
  const lines = [HP_RAW_COLUMNS.map(csvCell).join(','), ...hpRawRows(events, responses).map((r) => r.map(csvCell).join(','))];
  return '﻿' + lines.join('\n');
}

export function hpOpenCsv(events: RxEvent[], responses: RxResponse[], tags: Record<string, Record<string, string[]>>): string {
  const byId = new Map(events.map((e) => [e.id, e]));
  const rows: Cell[][] = [['response_id', 'event_title', 'question_id', 'question', 'text', 'tags']];
  for (const r of responses) {
    if (!byId.has(r.eventId)) continue;
    for (const q of HP_OPEN) if (typeof r.answers[q.id] === 'string') rows.push([r.id, byId.get(r.eventId)!.title, q.id, q.label, r.answers[q.id] as string, (tags[r.id]?.[q.id] ?? []).join('|')]);
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export interface HpSheets {
  summary: Cell[][];
  questions: Cell[][];
  journey: Cell[][];
  openFeedback: Cell[][];
  metadata: Cell[][];
  raw: Cell[][];
}

/** Sheets of the Excel export: Summary, Questions, Journey, Open Feedback, Metadata (+ Raw Responses). */
export function hpSheets(events: RxEvent[], responses: (RxResponse & { tags?: Record<string, string[]> })[], filterNote: string): HpSheets {
  const s = summarizeHp(responses);
  const byId = new Map(events.map((e) => [e.id, e]));
  return {
    summary: [
      ['Metric', 'Value'],
      ['Final responses', s.n],
      ['Experience Index', round1(s.experienceIndex)],
      ['Overall Rating (Q25) mean', round1(s.overall.mean)],
      ['NPS (Q26)', roundNps(s.nps.score)],
      ['Promoters %', round1(s.nps.promoters)],
      ['Passives %', round1(s.nps.passives)],
      ['Detractors %', round1(s.nps.detractors)],
      ['Future Value (Q27) mean', round1(s.future.mean)],
      ...HP_DIMENSIONS.map((d): Cell[] => [`${d.key} — ${d.en}`, round1(s.dimensions[d.key].score)]),
      ...HP_DIMENSIONS.map((d): Cell[] => [`${d.key} Top-2 %`, round1(s.dimensions[d.key].top2)]),
      ['Peak (journey)', s.peak ? `${s.peak.id} ${s.peak.text}` : null],
      ['Friction Point (journey)', s.friction ? `${s.friction.id} ${s.friction.text}` : null],
    ],
    questions: [
      ['ID', 'Index', 'Question', 'Valid N', 'Missing N', 'Mean (1–5)', 'Score (0–100)', 'Median', 'SD', 'Top-2 %', 'Neutral %', 'Bottom-2 %'],
      ...s.items.map((i): Cell[] => [i.id, HP_LIKERT.find((q) => q.id === i.id)!.dim, hpQuestionText(i.id), i.n, s.n - i.n, round1(i.mean), round1(i.score), i.median, round1(i.sd), round1(i.top2), round1(i.neutral), round1(i.bottom2)]),
    ],
    journey: [
      ['ID', 'Station', 'Valid N', 'N/A', 'Mean (1–5)', 'Top-2 %', 'Neutral %', 'Bottom-2 %', 'Peak / Friction'],
      ...s.journey.map((j): Cell[] => [j.id, j.text, j.n, j.na, round1(j.mean), round1(j.top2), round1(j.neutral), round1(j.bottom2), s.peak?.id === j.id ? 'Peak' : s.friction?.id === j.id ? 'Friction' : null]),
    ],
    openFeedback: [
      ['response_id', 'Question', 'Text', 'Tags'],
      ...responses.flatMap((r) => HP_OPEN.filter((q) => typeof r.answers[q.id] === 'string').map((q): Cell[] => [r.id, `${q.id} ${q.label}`, r.answers[q.id] as string, (r.tags?.[q.id] ?? []).join('|')])),
    ],
    metadata: [
      ['Key', 'Value'],
      ['Survey', 'HamPayam Reaction & Experience'],
      ['Questionnaire version', '1.0'],
      ['Events', events.map((e) => e.title).join('، ')],
      ['Filters', filterNote],
      ['Exported at (UTC)', new Date().toISOString()],
      ['Privacy', 'Anonymous: no name, phone, e-mail, token or IP is stored; response ids are random UUIDs.'],
      ['Journey N/A', `"${HP_NA}" is excluded from every mean`],
      ['Events listed', byId.size],
    ],
    raw: [HP_RAW_COLUMNS, ...hpRawRows(events, responses)],
  };
}

export const hpJourneyTitles = HP_JOURNEY.map((j) => j.text);
export const hpProfileIds = HP_PROFILE.map((p) => p.id);
