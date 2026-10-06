import { QUESTIONS, TIEBREAK_QUESTION } from '../src/tests/tasmimnama/content/questions.js';
import { CHARACTER_CODES, CharacterCode } from '../src/tests/tasmimnama/content/characters.codes.js';
import { ScoringTable, scoreAnswers, tableProblems } from '../api/_lib/tests/tasmimnama.scoring.js';
import { TASMIMNAMA_TABLE } from '../api/_lib/tests/tasmimnama.table.js';
import { createTasmimnama } from '../api/_lib/tests/tasmimnama.js';
import { HttpError } from '../api/_lib/http.js';
import { HANDLERS } from '../api/_lib/tests/index.js';
import { createChecker } from './harness.js';

/**
 * A synthetic table for testing the engine only: option a→DAVINCI, b→EINSTEIN, c→LINCOLN, d→CHURCHILL.
 * It is NOT the real scoring (the real table lives in api/_lib/tests/tasmimnama.table.ts).
 */
const SYNTHETIC: ScoringTable = {
  options: Object.fromEntries(QUESTIONS.flatMap((q) => q.options.map((o, i) => [o.id, [CHARACTER_CODES[i]]]))),
  tiebreak: Object.fromEntries(TIEBREAK_QUESTION.options.map((o, i) => [o.id, CHARACTER_CODES[i]])),
};

const pick = (letterIndex: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options[letterIndex].id]));
/** n questions answered with option 0 (DAVINCI) and the rest with option 1 (EINSTEIN). */
const split = (n: number) => Object.fromEntries(QUESTIONS.map((q, i) => [q.id, q.options[i < n ? 0 : 1].id]));

export function runTasmimnama() {
  const { results, check, equal } = createChecker();

  // ---- the shipped table is honest about being unfinished --------------------------------------
  const problems = tableProblems(TASMIMNAMA_TABLE);
  check('shipped table: incomplete until the owner fills it in', problems.length === QUESTIONS.length * 4 + TIEBREAK_QUESTION.options.length, `${problems.length}`);
  check('shipped handler: not ready, so the admin cannot open it', HANDLERS.tasmimnama.ready === false && HANDLERS.tasmimnama.notReadyReason === 'scoring_table_incomplete');
  check('shipped handler: refuses submissions', (() => { try { HANDLERS.tasmimnama.process({}); return false; } catch (e) { return e instanceof HttpError && e.status === 503; } })());
  check('question bank: 12 questions × 4 options, 5 tie-break options', QUESTIONS.length === 12 && QUESTIONS.every((q) => q.options.length === 4) && TIEBREAK_QUESTION.options.length === 5);

  // ---- engine ----------------------------------------------------------------------------------
  equal('synthetic table is complete', tableProblems(SYNTHETIC), []);
  check('table check: an unknown character is reported', tableProblems({ ...SYNTHETIC, options: { ...SYNTHETIC.options, 'q1-a': ['NAPOLEON' as CharacterCode] } }).length === 1);
  check('table check: an empty option is reported', tableProblems({ ...SYNTHETIC, options: { ...SYNTHETIC.options, 'q1-a': [] } }).length === 1);

  const all0 = scoreAnswers(SYNTHETIC, pick(0), null);
  check('engine: a clear winner needs no tie-break', all0.outcome === 'completed' && all0.characterCode === 'DAVINCI' && all0.tally.DAVINCI === 12);
  const seven = scoreAnswers(SYNTHETIC, split(7), null);
  check('engine: 7 vs 5 → the majority wins', seven.outcome === 'completed' && seven.characterCode === 'DAVINCI');

  const tie = scoreAnswers(SYNTHETIC, split(6), null);
  check('engine: 6 vs 6 → tie-break required, naming the tied characters', tie.outcome === 'tiebreak_required' && tie.tied.join() === 'DAVINCI,EINSTEIN', JSON.stringify(tie));
  const tbFor = (c: CharacterCode) => TIEBREAK_QUESTION.options[CHARACTER_CODES.indexOf(c)].id;
  const resolved = scoreAnswers(SYNTHETIC, split(6), tbFor('EINSTEIN'));
  check('engine: the tie-break answer decides between the tied', resolved.outcome === 'completed' && resolved.characterCode === 'EINSTEIN' && resolved.usedTiebreak);
  check('engine: a tie-break answer for someone not tied does not count', scoreAnswers(SYNTHETIC, split(6), tbFor('EDISON')).outcome === 'tiebreak_required');
  check('engine: an unknown tie-break option does not count', scoreAnswers(SYNTHETIC, split(6), 'tb-zzz').outcome === 'tiebreak_required');
  const noTbNeeded = scoreAnswers(SYNTHETIC, pick(2), tbFor('EDISON'));
  check('engine: a tie-break answer is ignored when there is no tie', noTbNeeded.outcome === 'completed' && noTbNeeded.characterCode === 'LINCOLN' && !noTbNeeded.usedTiebreak);

  const multi: ScoringTable = { ...SYNTHETIC, options: { ...SYNTHETIC.options, 'q1-a': ['DAVINCI', 'EINSTEIN'] } };
  check('engine: an option can give points to several characters', scoreAnswers(multi, pick(0), null).tally.EINSTEIN === 1 && scoreAnswers(multi, pick(0), null).tally.DAVINCI === 12);

  // ---- handler ---------------------------------------------------------------------------------
  const handler = createTasmimnama(SYNTHETIC);
  check('handler: ready with a complete table', handler.ready);
  const payload = (answers: object, tiebreakAnswer: string | null = null) => ({
    trackingCode: '۱۲۳۴-BF7K', startedAt: '2026-10-10T08:00:00Z', finishedAt: '2026-10-10T08:05:00Z', answers, tiebreakAnswer,
  });
  const ok = handler.process(payload(pick(3)));
  check('handler: stores the answers and returns only the character to the participant', (ok.result as any).characterCode === 'CHURCHILL' && !('tally' in (ok.result as object)) && (ok.data as any).tally.CHURCHILL === 12);

  let ties: HttpError | null = null;
  try { handler.process(payload(split(6))); } catch (e) { ties = e as HttpError; }
  check('handler: a tie answers 422 with the options that can break it', ties?.status === 422 && ties.code === 'tiebreak_required' && (ties.extra.options as string[] | undefined)?.join() === `${tbFor('DAVINCI')},${tbFor('EINSTEIN')}`, JSON.stringify(ties?.extra));
  const afterTb = handler.process(payload(split(6), tbFor('DAVINCI')));
  check('handler: the tie-break answer is stored with the session', (afterTb.result as any).characterCode === 'DAVINCI' && (afterTb.data as any).tiebreakAnswer === tbFor('DAVINCI'));

  const rejects = (p: unknown) => { try { handler.process(p); return false; } catch (e) { return e instanceof HttpError && e.code === 'invalid_session'; } };
  const partial = pick(0) as Record<string, string>;
  delete partial[QUESTIONS[0].id];
  check('handler: rejects a missing answer', rejects(payload(partial)));
  check('handler: rejects an option from another question', rejects(payload({ ...pick(0), [QUESTIONS[0].id]: QUESTIONS[1].options[0].id })));
  check('handler: rejects an unknown tie-break option', rejects(payload(pick(0), 'tb-zzz')));
  check('handler: rejects garbage', rejects(null) && rejects({}) && rejects({ answers: 'x' }));
  check('handler: rejects an invalid date', rejects({ ...payload(pick(0)), finishedAt: 'x' }));
  check('handler: a malformed tracking code is dropped', (handler.process({ ...payload(pick(0)), trackingCode: '<x>' }).data as any).trackingCode === null);

  return results;
}
