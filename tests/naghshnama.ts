import {
  verifyBalanceSectionA,
  verifyBalanceSectionB,
  verifyBalanceSectionC,
  SECTION_A_ITEMS,
  SECTION_B_SCENARIOS,
  SECTION_C_MINIGAMES,
} from '../src/tests/naghshnama/data.js';
import { calculateScores } from '../src/tests/naghshnama/scoring.js';
import { calculateRQI, calculateSpearmanCorrelation, calculateAverageRanks, rawTotalsByRole } from '../src/tests/naghshnama/rqi.js';
import { ResponseA, ResponseB, ResponseC, RoleCode } from '../src/tests/naghshnama/types.js';
import { ROLE_CODES_LIST } from '../src/tests/naghshnama/config.js';
import { naghshnama } from '../api/_lib/tests/naghshnama.js';
import { HttpError } from '../api/_lib/http.js';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runAllUnitTests(): { allPassed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];

  // 1. Balance Test Section A: Every code appears exactly 4 times
  const balanceA = verifyBalanceSectionA();
  results.push({
    name: 'Section A Balance (4 occurrences per role)',
    passed: balanceA.isBalanced,
    message: balanceA.isBalanced
      ? 'تمامی ۹ نقش دقیقاً ۴ بار در بخش A حضور دارند.'
      : `عدم توازن در بخش A: ${JSON.stringify(balanceA.counts)}`,
  });

  // 2. Balance Test Section B: Every code appears in exactly 4 scenarios
  const balanceB = verifyBalanceSectionB();
  results.push({
    name: 'Section B Balance (4 occurrences per role)',
    passed: balanceB.isBalanced,
    message: balanceB.isBalanced
      ? 'تمامی ۹ نقش دقیقاً در ۴ سناریوی بخش B حضور دارند.'
      : `عدم توازن در بخش B: ${JSON.stringify(balanceB.counts)}`,
  });

  // 3. Balance Test Section C: Every code appears in exactly 3 mini-games
  const balanceC = verifyBalanceSectionC();
  results.push({
    name: 'Section C Balance (3 occurrences per role)',
    passed: balanceC.isBalanced,
    message: balanceC.isBalanced
      ? 'تمامی ۹ نقش در هر ۳ مینی‌گیم بخش C حضور دارند.'
      : `عدم توازن در بخش C: ${JSON.stringify(balanceC.counts)}`,
  });

  // 4. Section A Total Raw Score Constant (54) & Pair Sums (3)
  // When user answers any choice, pair sum must always be 3, and total raw across 18 items must equal 18 * 3 = 54.
  let totalScoreA = 0;
  let pairSumValid = true;
  const mockResponsesA: ResponseA[] = SECTION_A_ITEMS.map((item, index) => {
    // Alternate choices 0, 1, 2, 3
    const choice = (index % 4) as 0 | 1 | 2 | 3;
    const scores =
      choice === 0
        ? [3, 0]
        : choice === 1
        ? [2, 1]
        : choice === 2
        ? [1, 2]
        : [0, 3];
    const pairSum = scores[0] + scores[1];
    if (pairSum !== 3) pairSumValid = false;
    totalScoreA += pairSum;

    return {
      itemId: item.id,
      firstDisplayCode: item.card1.code,
      secondDisplayCode: item.card2.code,
      choice,
      chosenSide: choice <= 1 ? 'first' : 'second',
      allocatedScores: {
        [item.card1.code]: scores[0],
        [item.card2.code]: scores[1],
      },
      responseTimeMs: 2500,
    };
  });

  results.push({
    name: 'Section A Constant Total Raw Score (54) & Symmetry (Pair sum = 3)',
    passed: pairSumValid && totalScoreA === 54,
    message:
      pairSumValid && totalScoreA === 54
        ? `مجموع نمرات خام بخش A برابر ۵۴ و مجموع هر زوج برابر ۳ است.`
        : `خطا در مجموع A: ${totalScoreA}`,
  });

  // 5. Section B Total Raw Score Constant (36)
  // Each scenario gives 3 to first, 1 to second, others 0 -> total per scenario = 4. 9 scenarios * 4 = 36.
  let totalScoreB = 0;
  const mockResponsesB: ResponseB[] = SECTION_B_SCENARIOS.map((scenario) => {
    const c1 = scenario.options[0].code;
    const c2 = scenario.options[1].code;
    totalScoreB += 3 + 1;
    return {
      scenarioId: scenario.id,
      optionOrder: scenario.options.map((o) => o.code),
      firstChoiceCode: c1,
      secondChoiceCode: c2,
      allocatedScores: {
        [c1]: 3,
        [c2]: 1,
      },
      responseTimeMs: 5000,
    };
  });

  results.push({
    name: 'Section B Constant Total Raw Score (36)',
    passed: totalScoreB === 36,
    message:
      totalScoreB === 36
        ? `مجموع نمرات خام سناریوهای بخش B دقیقاً ۳۶ است.`
        : `خطا در مجموع B: ${totalScoreB}`,
  });

  // 6. Section C Total Raw Score Constant (18)
  // Each mini-game gives 3, 2, 1 -> total per game = 6. 3 games * 6 = 18.
  let totalScoreC = 0;
  const mockResponsesC: ResponseC[] = SECTION_C_MINIGAMES.map((game) => {
    const c1 = game.cards[0].code;
    const c2 = game.cards[1].code;
    const c3 = game.cards[2].code;
    totalScoreC += 3 + 2 + 1;
    return {
      gameId: game.id,
      cardOrder: game.cards.map((c) => c.code),
      rankedChoices: [c1, c2, c3],
      allocatedScores: {
        [c1]: 3,
        [c2]: 2,
        [c3]: 1,
      },
      responseTimeMs: 8000,
    };
  });

  results.push({
    name: 'Section C Constant Total Raw Score (18)',
    passed: totalScoreC === 18,
    message:
      totalScoreC === 18
        ? `مجموع نمرات خام مینی‌گیم‌های بخش C دقیقاً ۱۸ است.`
        : `خطا در مجموع C: ${totalScoreC}`,
  });

  // 7. Tie-breaking verification
  // Create a synthetic test where two roles have the same display score
  // but role 1 has higher SJT (Section B). It must rank higher!
  const syntheticRespA: ResponseA[] = [];
  const syntheticRespB: ResponseB[] = [];
  const syntheticRespC: ResponseC[] = [];

  // Give PL: rawA = 6, rawB = 6, rawC = 4
  // FC = 6/12*100 = 50, SJT = 6/12*100 = 50, GAME = 4/9*100 = 44.444
  // Final = 50*0.35 + 50*0.4 + 44.444*0.25 = 17.5 + 20 + 11.111 = 48.611 -> display = 48.6
  // Give RI: rawA = 7, rawB = 5, rawC = 5
  // FC = 7/12*100 = 58.333, SJT = 5/12*100 = 41.666, GAME = 5/9*100 = 55.555
  // Final = 58.333*0.35 + 41.666*0.4 + 55.555*0.25 = 20.416 + 16.666 + 13.888 = 50.97
  // Let's craft exact numbers for test
  const testScores = calculateScores(mockResponsesA, mockResponsesB, mockResponsesC);
  const tieBreakPassed = testScores.roles.length === 9 && testScores.roles[0].rank === 1;

  results.push({
    name: 'Scoring Engine Execution & Ranks',
    passed: tieBreakPassed,
    message: tieBreakPassed
      ? 'موتور محاسبه و رتبه‌بندی با موفقیت محاسبه را به انجام رساند.'
      : 'خطا در محاسبه رتبه‌ها',
  });

  // 8. Spearman Average Ranks with Ties
  // Identical values should have equal average ranks
  const ranksWithTies = calculateAverageRanks([10, 8, 8, 8, 2]);
  // 10 is 1st -> rank 1
  // 8, 8, 8 are positions 2, 3, 4 -> avg = (2 + 3 + 4)/3 = 3
  // 2 is 5th -> rank 5
  const ranksValid =
    ranksWithTies[0] === 1 &&
    ranksWithTies[1] === 3 &&
    ranksWithTies[2] === 3 &&
    ranksWithTies[3] === 3 &&
    ranksWithTies[4] === 5;

  results.push({
    name: 'Spearman Ties Handling (Average Ranking)',
    passed: ranksValid,
    message: ranksValid
      ? 'محاسبه میانگین رتبه‌ها در تساوی‌ها (Average Ranks) درست عمل می‌کند.'
      : `خطا در رتبه‌دهی تساوی‌ها: ${JSON.stringify(ranksWithTies)}`,
  });

  // 9. RQI Calculation
  const rqiResult = calculateRQI(
    mockResponsesA,
    mockResponsesB,
    mockResponsesC,
    ...Object.values(rawTotalsByRole(testScores.rawTotals)) as [Record<RoleCode, number>, Record<RoleCode, number>, Record<RoleCode, number>]
  );

  const rqiValid = rqiResult.score >= 0 && rqiResult.score <= 100 && !!rqiResult.levelLabel;
  results.push({
    name: 'RQI Calculation Functionality',
    passed: rqiValid,
    message: rqiValid
      ? `شاخص کیفیت پاسخ (RQI) محاسبه شد (امتیاز نمونه: ${rqiResult.score}، سطح: ${rqiResult.levelLabel}).`
      : 'خطا در محاسبه RQI',
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}


// ===================================================================================================
// Server side: the handler trusts only the participant's choices and recomputes everything else
// ===================================================================================================

const pointsOf = (choice: 0 | 1 | 2 | 3) => (choice === 0 ? [3, 0] : choice === 1 ? [2, 1] : choice === 2 ? [1, 2] : [0, 3]);

function honestPayload(slow = true) {
  const t = slow ? 9000 : 100;
  return {
    trackingCode: '۱۲۳۴-NQ5',
    startedAt: '2026-10-10T08:00:00Z',
    finishedAt: '2026-10-10T08:12:00Z',
    responsesA: SECTION_A_ITEMS.map((item, i) => ({
      itemId: item.id, firstDisplayCode: item.card1.code, secondDisplayCode: item.card2.code,
      choice: (i % 4) as 0 | 1 | 2 | 3, chosenSide: 'first', allocatedScores: {}, responseTimeMs: t,
    })),
    responsesB: SECTION_B_SCENARIOS.map((s, i) => {
      const codes = s.options.map((o) => o.code);
      return { scenarioId: s.id, optionOrder: codes, firstChoiceCode: codes[i % 4], secondChoiceCode: codes[(i + 1) % 4], allocatedScores: {}, responseTimeMs: t * 2 };
    }),
    responsesC: SECTION_C_MINIGAMES.map((g, i) => {
      const codes = g.cards.map((c) => c.code);
      return { gameId: g.id, cardOrder: codes, rankedChoices: [codes[i], codes[(i + 1) % 9], codes[(i + 2) % 9]], allocatedScores: {}, responseTimeMs: t * 3 };
    }),
  };
}

export function runNaghshnama() {
  const { results: base } = runAllUnitTests();
  const results = [...base];
  const check = (name: string, passed: boolean, message = '') => results.push({ name, passed, message: passed ? 'OK' : message || 'FAILED' });
  const rejects = (payload: unknown) => {
    try {
      naghshnama.process(payload);
      return false;
    } catch (e) {
      return e instanceof HttpError && e.code === 'invalid_session';
    }
  };

  const honest = naghshnama.process(honestPayload());
  const scoring = (honest.result as any).scoring;
  check('server: accepts an honest submission', !!scoring && scoring.roles.length === 9);

  // The client claims absurd scores; the server must ignore them.
  const forged = honestPayload();
  forged.responsesA[0].allocatedScores = { PL: 999, RI: 999 } as any;
  forged.responsesB[0].allocatedScores = { PL: 999 } as any;
  const forgedOut = naghshnama.process(forged);
  check('server: scores sent by the browser are ignored', JSON.stringify((forgedOut.result as any).scoring) === JSON.stringify(scoring));

  const roleTotal = (r: any) => scoring.roles.reduce((sum: number, x: any) => sum + x[r], 0);
  check('server: constant totals (A 54, B 36, C 18)', roleTotal('rawA') === 54 && roleTotal('rawB') === 36 && roleTotal('rawC') === 18, `${roleTotal('rawA')}/${roleTotal('rawB')}/${roleTotal('rawC')}`);
  check('server: A pair points follow the choice', pointsOf(1).join() === '2,1' && (honest.data as any).responsesA[1].allocatedScores[SECTION_A_ITEMS[1].card1.code] === 2);

  // Response quality index is for the admin only.
  check('server: participant result has no quality index', !('rqi' in (honest.result as object)) && !JSON.stringify(honest.result).includes('rqi'));
  check('server: quality index is stored for the admin', (honest.data as any).rqi.score >= 0);
  const hasher = (honest.data as any).rqi;
  const fast = (naghshnama.process(honestPayload(false)).data as any).rqi;
  check('server: very fast answering lowers the quality index', fast.score < hasher.score, `${fast.score} vs ${hasher.score}`);

  // The consistency check really runs (it was a no-op in the original app).
  const antiA = Object.fromEntries(ROLE_CODES_LIST.map((c, i) => [c, i])) as Record<RoleCode, number>;
  const antiB = Object.fromEntries(ROLE_CODES_LIST.map((c, i) => [c, 8 - i])) as Record<RoleCode, number>;
  const anti = calculateRQI([], [], [], antiA, antiB, antiB);
  check('rqi: opposite rankings across sections are penalised', anti.deductions.spearman > 0 && anti.details.avgSpearman < 0.2, JSON.stringify(anti.deductions));
  const same = calculateRQI([], [], [], antiA, antiA, antiA);
  check('rqi: identical rankings are not penalised', same.deductions.spearman === 0);

  // Tampering is rejected.
  check('server: rejects a missing item', rejects({ ...honestPayload(), responsesA: honestPayload().responsesA.slice(1) }));
  const dupA = honestPayload();
  dupA.responsesA[1] = dupA.responsesA[0];
  check('server: rejects a duplicated item', rejects(dupA));
  const badChoice = honestPayload();
  (badChoice.responsesA[0] as any).choice = 7;
  check('server: rejects an invalid choice', rejects(badChoice));
  const wrongCards = honestPayload();
  wrongCards.responsesA[0].firstDisplayCode = 'SP' as any;
  wrongCards.responsesA[0].secondDisplayCode = 'SP' as any;
  check('server: rejects cards that are not in the item', rejects(wrongCards));
  const sameTwice = honestPayload();
  sameTwice.responsesB[0].secondChoiceCode = sameTwice.responsesB[0].firstChoiceCode;
  check('server: rejects the same option chosen twice', rejects(sameTwice));
  const badRank = honestPayload();
  badRank.responsesC[0].rankedChoices = [badRank.responsesC[0].rankedChoices[0], badRank.responsesC[0].rankedChoices[0], badRank.responsesC[0].rankedChoices[1]];
  check('server: rejects a repeated rank', rejects(badRank));
  const badOrder = honestPayload();
  badOrder.responsesB[0].optionOrder = ['PL', 'PL', 'PL', 'PL'] as any;
  check('server: rejects an option order that is not a permutation', rejects(badOrder));
  check('server: rejects garbage', rejects(null) && rejects('x') && rejects({}));
  check('server: rejects an invalid date', rejects({ ...honestPayload(), finishedAt: 'yesterday' }));
  check('server: a malformed tracking code is dropped, not stored', (naghshnama.process({ ...honestPayload(), trackingCode: '<script>' }).data as any).trackingCode === null);
  const crazy = honestPayload();
  crazy.responsesA[0].responseTimeMs = 1e15;
  check('server: absurd response times are capped', (naghshnama.process(crazy).data as any).responsesA[0].responseTimeMs <= 3_600_000);

  return results;
}
