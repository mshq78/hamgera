import { HttpError } from '../http.js';
import type { TestHandler } from './types.js';
import { SECTION_A_ITEMS, SECTION_B_SCENARIOS, SECTION_C_MINIGAMES } from '../../../src/tests/naghshnama/data.js';
import { INSTRUMENT_VERSION, WEIGHTS } from '../../../src/tests/naghshnama/config.js';
import { calculateScores } from '../../../src/tests/naghshnama/scoring.js';
import { calculateRQI } from '../../../src/tests/naghshnama/rqi.js';
import { rawTotalsByRole } from '../../../src/tests/naghshnama/rqi.js';
import type { ChoiceA, ResponseA, ResponseB, ResponseC, RoleCode } from '../../../src/tests/naghshnama/types.js';

/**
 * نقش‌نما. The browser sends only what the participant chose (and the display order they saw). Everything that
 * becomes a score — points per choice, role totals, final ranking and the response-quality index — is
 * recomputed here, so a modified client cannot invent results.
 *
 *   stored `data`   : sanitised responses + the response-quality index (admin only)
 *   stored `result` : what the participant may see — the role scoring and a tracking code, never the quality index
 */

const SIDE_POINTS: Record<ChoiceA, [number, number]> = { 0: [3, 0], 1: [2, 1], 2: [1, 2], 3: [0, 3] };
const TRACKING = /^[0-9۰-۹]{4}-NQ[0-9۰-۹]$/;
const MAX_TIME_MS = 60 * 60 * 1000;

const invalid = (): never => {
  throw new HttpError(400, 'invalid_session');
};
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const ms = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), MAX_TIME_MS) : 0);
const iso = (v: unknown): string => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : invalid());
const samePermutation = (a: unknown, expected: readonly string[]): a is RoleCode[] =>
  Array.isArray(a) && a.length === expected.length && [...a].sort().join() === [...expected].sort().join();

function sanitizeA(input: unknown): ResponseA[] {
  if (!Array.isArray(input) || input.length !== SECTION_A_ITEMS.length) invalid();
  const seen = new Set<string>();
  return (input as unknown[]).map((r) => {
    if (!isObj(r)) return invalid();
    const item = SECTION_A_ITEMS.find((i) => i.id === r.itemId);
    if (!item || seen.has(item.id)) return invalid();
    seen.add(item.id);
    const codes = [item.card1.code, item.card2.code];
    if (!samePermutation([r.firstDisplayCode, r.secondDisplayCode], codes)) return invalid();
    if (![0, 1, 2, 3].includes(r.choice)) return invalid();
    const choice = r.choice as ChoiceA;
    const [p1, p2] = SIDE_POINTS[choice];
    return {
      itemId: item.id,
      firstDisplayCode: r.firstDisplayCode,
      secondDisplayCode: r.secondDisplayCode,
      choice,
      chosenSide: choice <= 1 ? 'first' : 'second',
      allocatedScores: { [r.firstDisplayCode]: p1, [r.secondDisplayCode]: p2 },
      responseTimeMs: ms(r.responseTimeMs),
    };
  });
}

function sanitizeB(input: unknown): ResponseB[] {
  if (!Array.isArray(input) || input.length !== SECTION_B_SCENARIOS.length) invalid();
  const seen = new Set<string>();
  return (input as unknown[]).map((r) => {
    if (!isObj(r)) return invalid();
    const sc = SECTION_B_SCENARIOS.find((s) => s.id === r.scenarioId);
    if (!sc || seen.has(sc.id)) return invalid();
    seen.add(sc.id);
    const codes = sc.options.map((o) => o.code);
    if (!samePermutation(r.optionOrder, codes)) return invalid();
    if (!codes.includes(r.firstChoiceCode) || !codes.includes(r.secondChoiceCode) || r.firstChoiceCode === r.secondChoiceCode) return invalid();
    return {
      scenarioId: sc.id,
      optionOrder: r.optionOrder,
      firstChoiceCode: r.firstChoiceCode,
      secondChoiceCode: r.secondChoiceCode,
      allocatedScores: { [r.firstChoiceCode]: 3, [r.secondChoiceCode]: 1 },
      responseTimeMs: ms(r.responseTimeMs),
    };
  });
}

function sanitizeC(input: unknown): ResponseC[] {
  if (!Array.isArray(input) || input.length !== SECTION_C_MINIGAMES.length) invalid();
  const seen = new Set<string>();
  return (input as unknown[]).map((r) => {
    if (!isObj(r)) return invalid();
    const game = SECTION_C_MINIGAMES.find((g) => g.id === r.gameId);
    if (!game || seen.has(game.id)) return invalid();
    seen.add(game.id);
    const codes = game.cards.map((c) => c.code);
    if (!samePermutation(r.cardOrder, codes)) return invalid();
    const ranked = r.rankedChoices;
    if (!Array.isArray(ranked) || ranked.length !== 3 || new Set(ranked).size !== 3 || !ranked.every((c) => codes.includes(c))) return invalid();
    return {
      gameId: game.id,
      cardOrder: r.cardOrder,
      rankedChoices: ranked as [RoleCode, RoleCode, RoleCode],
      allocatedScores: { [ranked[0]]: 3, [ranked[1]]: 2, [ranked[2]]: 1 },
      responseTimeMs: ms(r.responseTimeMs),
    };
  });
}

export const naghshnama: TestHandler = {
  id: 'naghshnama',
  ready: true,
  process(payload) {
    if (!isObj(payload)) return invalid();
    const responsesA = sanitizeA(payload.responsesA);
    const responsesB = sanitizeB(payload.responsesB);
    const responsesC = sanitizeC(payload.responsesC);
    const startedAt = iso(payload.startedAt);
    const finishedAt = iso(payload.finishedAt);
    const trackingCode = typeof payload.trackingCode === 'string' && TRACKING.test(payload.trackingCode) ? payload.trackingCode : null;

    const scoring = calculateScores(responsesA, responsesB, responsesC);
    const { rawA, rawB, rawC } = rawTotalsByRole(scoring.rawTotals);
    const rqi = calculateRQI(responsesA, responsesB, responsesC, rawA, rawB, rawC);

    return {
      data: { instrumentVersion: INSTRUMENT_VERSION, weights: WEIGHTS, trackingCode, startedAt, finishedAt, responsesA, responsesB, responsesC, rqi },
      result: { instrumentVersion: INSTRUMENT_VERSION, trackingCode, finishedAt, scoring },
    };
  },
};
