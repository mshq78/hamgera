import { CHARACTER_CODES, CharacterCode } from '../../../src/tests/tasmimnama/content/characters.codes.js';
import { QUESTIONS, TIEBREAK_QUESTION } from '../../../src/tests/tasmimnama/content/questions.js';

/**
 * تصمیم‌نما scoring engine (server only).
 *
 * Each answer option points at the character(s) whose decision style it expresses; the character with the most
 * points wins. If two or more characters share the top score, one extra question breaks the tie: its option
 * names a character, and the choice only counts when that character is among the tied ones.
 */

export interface ScoringTable {
  /** option id (e.g. "q1-a") → the characters that option gives a point to */
  options: Record<string, CharacterCode[]>;
  /** tie-break option id (e.g. "tb-a") → the character it stands for */
  tiebreak: Record<string, CharacterCode>;
}

const allOptionIds = () => QUESTIONS.flatMap((q) => q.options.map((o) => o.id));
const tiebreakOptionIds = () => TIEBREAK_QUESTION.options.map((o) => o.id);

/** What is still missing from a table. An empty list means it can be used. */
export function tableProblems(table: ScoringTable): string[] {
  const problems: string[] = [];
  for (const id of allOptionIds()) {
    const targets = table.options[id];
    if (!Array.isArray(targets) || targets.length === 0) problems.push(`option ${id} has no character`);
    else if (!targets.every((c) => (CHARACTER_CODES as readonly string[]).includes(c))) problems.push(`option ${id} names an unknown character`);
  }
  for (const id of tiebreakOptionIds()) {
    if (!(CHARACTER_CODES as readonly string[]).includes(table.tiebreak[id])) problems.push(`tie-break option ${id} has no character`);
  }
  return problems;
}

export type ScoreOutcome =
  | { outcome: 'completed'; characterCode: CharacterCode; tally: Record<CharacterCode, number>; usedTiebreak: boolean }
  | { outcome: 'tiebreak_required'; tied: CharacterCode[]; tally: Record<CharacterCode, number> };

/**
 * `answers`: question id → chosen option id (all questions answered). `tiebreakOption`: the extra answer, if given.
 * With a tie and no usable tie-break answer the outcome is 'tiebreak_required'.
 */
export function scoreAnswers(table: ScoringTable, answers: Record<string, string>, tiebreakOption: string | null): ScoreOutcome {
  const tally = Object.fromEntries(CHARACTER_CODES.map((c) => [c, 0])) as Record<CharacterCode, number>;
  for (const q of QUESTIONS) for (const c of table.options[answers[q.id]] ?? []) tally[c] += 1;

  const top = Math.max(...Object.values(tally));
  const leaders = CHARACTER_CODES.filter((c) => tally[c] === top);
  if (leaders.length === 1) return { outcome: 'completed', characterCode: leaders[0], tally, usedTiebreak: false };

  const picked = tiebreakOption ? table.tiebreak[tiebreakOption] : undefined;
  if (picked && leaders.includes(picked)) return { outcome: 'completed', characterCode: picked, tally, usedTiebreak: true };
  return { outcome: 'tiebreak_required', tied: leaders, tally };
}
