import { HttpError } from '../http.js';
import type { TestHandler } from './types.js';
import { QUESTIONS, TIEBREAK_QUESTION } from '../../../src/tests/tasmimnama/content/questions.js';
import { ScoringTable, scoreAnswers, tableProblems } from './tasmimnama.scoring.js';
import { TASMIMNAMA_TABLE } from './tasmimnama.table.js';

/**
 * تصمیم‌نما: 12 multiple-choice situations and one optional tie-break question. The browser sends only the
 * chosen option ids; the character is computed here, so the mapping from options to characters never reaches
 * the browser.
 *
 * With a tie and no tie-break answer the request is answered with 422 `tiebreak_required` and nothing is stored;
 * the browser then shows the extra question and submits again.
 */

const TRACKING = /^[0-9۰-۹]{4}-BF7K$/;

const invalid = (): never => {
  throw new HttpError(400, 'invalid_session');
};
const iso = (v: unknown): string => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : invalid());

export function createTasmimnama(table: ScoringTable): TestHandler {
  const problems = tableProblems(table);
  return {
    id: 'tasmimnama',
    ready: problems.length === 0,
    notReadyReason: problems.length === 0 ? undefined : 'scoring_table_incomplete',
    process(payload: any) {
      if (problems.length > 0) throw new HttpError(503, 'test_not_ready');
      if (!payload || typeof payload !== 'object' || !payload.answers || typeof payload.answers !== 'object') return invalid();

      const answers: Record<string, string> = {};
      for (const q of QUESTIONS) {
        const picked = payload.answers[q.id];
        if (typeof picked !== 'string' || !q.options.some((o) => o.id === picked)) return invalid();
        answers[q.id] = picked;
      }
      const tb = payload.tiebreakAnswer;
      if (tb !== undefined && tb !== null && (typeof tb !== 'string' || !TIEBREAK_QUESTION.options.some((o) => o.id === tb))) return invalid();
      const startedAt = iso(payload.startedAt);
      const finishedAt = iso(payload.finishedAt);
      const trackingCode = typeof payload.trackingCode === 'string' && TRACKING.test(payload.trackingCode) ? payload.trackingCode : null;

      const scored = scoreAnswers(table, answers, typeof tb === 'string' ? tb : null);
      if (scored.outcome === 'tiebreak_required') {
        // Only offer the tie-break options that stand for one of the tied characters.
        const options = TIEBREAK_QUESTION.options.filter((o) => scored.tied.includes(table.tiebreak[o.id])).map((o) => o.id);
        throw new HttpError(422, 'tiebreak_required', { options });
      }

      return {
        data: { startedAt, finishedAt, trackingCode, answers, tiebreakAnswer: scored.usedTiebreak ? tb : null, tally: scored.tally },
        result: { characterCode: scored.characterCode, trackingCode, finishedAt },
      };
    },
  };
}

export const tasmimnama = createTasmimnama(TASMIMNAMA_TABLE);
