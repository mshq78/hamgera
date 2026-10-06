import surveyHandler from '../api/survey.js';
import reactionHandler from '../api/reaction.js';
import { db } from '../api/_lib/db.js';
import {
  DIMENSIONS, FAST_SECONDS, MIN_GROUP, RxResponse, bySegment, dimensionScore, itemStats, mean, median, nps, normalizeWord, reactionIndex, reactionStatus,
  responseScores, round1, roundNps, sd, summarize, top2Status, wordFrequency,
} from '../shared/reaction/metrics.js';
import { ALL_QUESTION_IDS, LIKERT_IDS, OPEN_IDS, WORDS_ID } from '../shared/reaction/questions.js';
import { cleanSubmission, eventAccepts, eventStatus, sanitizeText } from '../shared/reaction/validate.js';
import { call, createChecker, useMemoryDatabase } from './harness.js';

const ADMIN = { 'x-admin-password': 'test-admin' };

/** A response with every Likert item at `likert`, overall/NPS as given. */
const response = (over: Partial<RxResponse> & { likert?: number; q21?: number; q22?: number } = {}): RxResponse => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  eventId: 'e1', segment: over.segment ?? null, startedAt: '2026-10-10T08:00:00Z', submittedAt: '2026-10-10T08:10:00Z', durationSeconds: over.durationSeconds ?? 300,
  answers: { ...Object.fromEntries(LIKERT_IDS.map((id) => [id, over.likert ?? 4])), Q21: over.q21 ?? 8, Q22: over.q22 ?? 9, ...(over.answers ?? {}) },
  words: over.words ?? ['جذاب'],
});

function payload(over: Record<string, unknown> = {}) {
  return {
    responseId: 'resp-0000000000000001', startedAt: new Date(Date.now() - 400_000).toISOString(), clientVersion: '1.0', words: ['جذاب', 'عملی', 'پرانرژی'],
    answers: { ...Object.fromEntries(LIKERT_IDS.map((id, i) => [id, 3 + (i % 3)])), Q21: 9, Q22: 10, Q23: 'بازی تیمی', Q24: '', Q25: '<b>زمان</b> بیشتر', Q26: 'پیشنهاد' },
    ...over,
  };
}

export async function runReaction() {
  const { results, check, equal } = createChecker();

  // ---- formulas (spec appendix A/B) ---------------------------------------------------------------
  const exampleMeans = [4.2, 3.8, 4.4, 4.0].map(dimensionScore);
  equal('appendix B: dimension scores 80 / 70 / 85 / 75', exampleMeans.map(round1), [80, 70, 85, 75]);
  equal('appendix B: Reaction Index 77.5', reactionIndex(exampleMeans), 77.5);
  equal('dimension score range', [dimensionScore(1), dimensionScore(5), dimensionScore(3)], [0, 100, 50]);

  const tenScores = [10, 9, 9, 10, 8, 7, 8, 5, 6, 0]; // 4 promoters, 3 passives, 3 detractors
  const n10 = nps(tenScores);
  equal('NPS: 4 promoters, 3 passives, 3 detractors → +10', [roundNps(n10.score), n10.promoters, n10.passives, n10.detractors], [10, 40, 30, 30]);
  equal('NPS: passives count in the denominator only', roundNps(nps([9, 7]).score), 50);
  equal('NPS: all detractors → −100, all promoters → +100', [nps([0, 6]).score, nps([9, 10]).score], [-100, 100]);
  equal('NPS: boundaries 6 / 7 / 8 / 9', [nps([6]).detractors, nps([7]).passives, nps([8]).passives, nps([9]).promoters], [100, 100, 100, 100]);

  const st = itemStats('Q01', [5, 4, 4, 3, 2, 1]);
  equal('item stats: top-2 / neutral / bottom-2 / mean / median', [round1(st.top2), round1(st.neutral), round1(st.bottom2), st.mean, st.median, st.n], [50, 16.7, 33.3, 3.1666666666666665, 3.5, 6]);
  check('item stats: SD is the sample deviation', Math.abs(sd([1, 2, 3, 4, 5]) - 1.5811388) < 1e-6 && sd([4]) === 0);
  equal('mean / median basics', [mean([1, 2, 3]), median([4, 1, 3, 2]), median([5])], [2, 2.5, 5]);
  equal('rounding: one decimal, NPS whole', [round1(77.54), roundNps(10.5), roundNps(-10.5)], [77.5, 11, -10]);

  equal('thresholds: Reaction Index', [85, 84.9, 75, 74.9, 65, 64.9].map((x) => reactionStatus(x)), ['excellent', 'good', 'good', 'attention', 'attention', 'improve']);
  equal('thresholds: Top-2 Box', [80, 79, 70, 69, 60, 59].map((x) => top2Status(x)), ['excellent', 'good', 'good', 'attention', 'attention', 'improve']);

  const s = summarize([response({ likert: 5 }), response({ likert: 3 })]);
  equal('summary: dimensions from the respondents\' means', DIMENSIONS.map((d) => s.dimensions[d.key]), [75, 75, 75, 75]);
  equal('summary: Q21 distribution counts', [s.overall.distribution[8], s.overall.mean, s.overall.n], [2, 8, 2]);
  check('summary: an empty set does not crash', Number.isNaN(summarize([]).reactionIndex) && summarize([]).n === 0);
  equal('per-response scores match the export columns', round1(responseScores(response({ likert: 4 })).reaction_index), 75);
  equal('fast responses (< 60 s) are counted, not removed', summarize([response({ durationSeconds: FAST_SECONDS - 1 }), response({ durationSeconds: FAST_SECONDS })]).fast, 1);
  const q = summarize([response({ likert: 4 })]);
  check('summary reverses nothing: no item is reverse-scored (Q10 high = good)', q.items.every((i) => i.mean === 4));

  // ---- privacy: small groups ---------------------------------------------------------------------
  const groups = bySegment([...Array.from({ length: MIN_GROUP }, () => response({ segment: 'مدیران' })), ...Array.from({ length: MIN_GROUP - 1 }, () => response({ segment: 'کارشناسان' }))]);
  check(`groups below ${MIN_GROUP} responses are hidden and carry no numbers`, groups.find((g) => g.segment === 'کارشناسان')!.hidden && groups.find((g) => g.segment === 'کارشناسان')!.summary === null);
  check('groups of exactly 5 are shown', !groups.find((g) => g.segment === 'مدیران')!.hidden && groups.find((g) => g.segment === 'مدیران')!.summary!.n === 5);

  // ---- word cloud ---------------------------------------------------------------------------------
  equal('word cloud: normalises yeh/kaf and drops stop-words', wordFrequency([{ words: ['كاربردي', 'کاربردی', 'و', 'عملی'] }, { words: ['عملی!'] }]), [{ word: 'عملی', count: 2 }, { word: 'کاربردی', count: 2 }]);
  equal('normalizeWord', normalizeWord(' «خوب» ي '), 'خوب ی');

  // ---- validation -----------------------------------------------------------------------------------
  const ok = cleanSubmission(payload(), ['الف']);
  check('valid submission accepted; blank open answers are dropped; tags stripped', !('error' in ok) && !('Q24' in ok.answers) && ok.answers.Q25 === 'زمان بیشتر' && ok.words.length === 3);
  const err = (body: unknown, segs: string[] = []) => ('error' in (cleanSubmission(body, segs) as object) ? (cleanSubmission(body, segs) as { error: string }).error : 'ok');
  const base = payload();
  equal('rejects Likert 0 and 6, decimals, strings', [0, 6, 3.5, '4'].map((v) => err({ ...base, answers: { ...base.answers, Q05: v } })), Array(4).fill('invalid_answers'));
  equal('rejects Q21/Q22 outside 0–10', [-1, 11].map((v) => err({ ...base, answers: { ...base.answers, Q22: v } })), ['invalid_answers', 'invalid_answers']);
  equal('accepts Q21/Q22 of 0 and 10', [0, 10].map((v) => err({ ...base, answers: { ...base.answers, Q21: v } })), ['ok', 'ok']);
  const missing = { ...base.answers } as Record<string, unknown>;
  delete missing.Q13;
  equal('rejects a missing required answer', err({ ...base, answers: missing }), 'invalid_answers');
  equal('Q27 and the open questions are optional: no words, blank words, no field at all', [err({ ...base, words: [] }), err({ ...base, words: ['  ', ''] }), err({ ...base, words: undefined })], ['ok', 'ok', 'ok']);
  const bare = cleanSubmission({ ...base, words: [], answers: Object.fromEntries(Object.entries(base.answers).filter(([k]) => !['Q23', 'Q24', 'Q25', 'Q26'].includes(k))) }, []) as any;
  check('a submission with only the ratings is complete (no words, no text)', !bare.error && bare.words.length === 0 && Object.keys(bare.answers).length === 22);
  equal('the ratings stay mandatory even when the text is left out', err({ ...base, answers: { ...base.answers, Q01: undefined } }), 'invalid_answers');
  equal('Q27 one word is enough; 30 chars max; max three words', [err({ ...base, words: ['یک'] }), (cleanSubmission({ ...base, words: ['x'.repeat(50), 'b', 'c', 'd'] }, []) as any).words.map((w: string) => w.length)], ['ok', [30, 1, 1]]);
  check('open answers are cut at 500 characters', ((cleanSubmission({ ...base, answers: { ...base.answers, Q23: 'ب'.repeat(900) } }, []) as any).answers.Q23 as string).length === 500);
  equal('segment must come from the event list', [err({ ...base, segment: 'ناشناس' }, ['الف']), err({ ...base, segment: 'الف' }, ['الف']), err({ ...base, segment: '' }, ['الف'])], ['invalid_segment', 'ok', 'ok']);
  equal('markup and control characters are removed', sanitizeText('<script>alert(1)</script>سلام\u0000', 50), 'alert(1)سلام');
  equal('rejects garbage', [err(null), err('x'), err({})], ['invalid_answers', 'invalid_answers', 'invalid_answers']);
  equal('rejects a missing start time', err({ ...base, startedAt: 'x' }), 'invalid_time');
  check('the form defines Q01–Q27', ALL_QUESTION_IDS.length === 27 && OPEN_IDS.join() === 'Q23,Q24,Q25,Q26' && WORDS_ID === 'Q27');

  // ---- event availability ---------------------------------------------------------------------------
  const T = (x: string) => Date.parse(x);
  const win = { isActive: true, opensAt: '2026-10-10T08:00:00Z', closesAt: '2026-10-10T10:00:00Z' };
  equal('event status', [eventStatus(win, T('2026-10-10T07:00:00Z')), eventStatus(win, T('2026-10-10T09:00:00Z')), eventStatus(win, T('2026-10-10T11:00:00Z')), eventStatus({ ...win, isActive: false }, T('2026-10-10T09:00:00Z'))], ['upcoming', 'open', 'ended', 'closed']);
  equal('event without times is open while active', eventStatus({ isActive: true, opensAt: null, closesAt: null }, T('2030-01-01T00:00:00Z')), 'open');
  check('grace after the end for someone who started earlier', eventAccepts(win, '2026-10-10T09:50:00Z', T('2026-10-10T10:10:00Z')) && !eventAccepts(win, '2026-10-10T10:05:00Z', T('2026-10-10T10:10:00Z')) && !eventAccepts({ ...win, isActive: false }, '2026-10-10T09:50:00Z', T('2026-10-10T09:55:00Z')));

  // ---- API: anonymous submission, idempotency, admin management --------------------------------------
  process.env.ADMIN_PASSWORD = 'test-admin';
  await useMemoryDatabase();

  equal('admin API needs the admin password', (await call(reactionHandler, { query: { resource: 'events' } })).status, 401);
  const created = await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', title: 'بوت‌کمپ ۳ت', eventDate: '2026-10-10', cohort: 'دورهٔ ۱', location: 'تهران', segments: ['مدیران', 'کارشناسان'], isActive: true } });
  check('event created with a short public code (6 characters)', created.status === 200 && /^[a-z0-9]{6}$/.test(created.body.code), JSON.stringify(created.body));
  const { id: eventId, code } = created.body as { id: string; code: string };
  equal('event title is required', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', title: '  ' } })).body.error, 'invalid_title');
  equal('end must be after start', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', title: 'x', opensAt: '2026-10-10T10:00:00Z', closesAt: '2026-10-10T09:00:00Z' } })).body.error, 'closes_before_opens');

  const info = await call(surveyHandler, { query: { code } });
  equal('public: event info only (title, date, groups, status)', [info.body.title, info.body.eventDate, info.body.segments, info.body.status], ['بوت‌کمپ ۳ت', '2026-10-10', ['مدیران', 'کارشناسان'], 'open']);
  check('public: nothing about responses or the code table leaks', !JSON.stringify(info.body).includes('responses') && !('id' in info.body));
  equal('public: unknown code → 404', (await call(surveyHandler, { query: { code: 'zzzzzz' } })).status, 404);
  const longCode = 'oldcode123';
  await (await db())`INSERT INTO hamgera_rx_events (id, code, title, segments, survey_version) VALUES ('legacy-1', ${longCode}, 'قدیمی', '[]'::jsonb, '1.0')`;
  equal('public: links made with the earlier 10-character codes still work', (await call(surveyHandler, { query: { code: longCode } })).body.title, 'قدیمی');
  equal('public: malformed code → 404', (await call(surveyHandler, { query: { code: "x'; DROP" } })).status, 404);

  const submit = (over: Record<string, unknown> = {}) => call(surveyHandler, { method: 'POST', body: { code, ...payload(), ...over } });
  equal('submit: ok without any login', (await submit({ segment: 'مدیران' })).body, { ok: true });
  equal('submit: the same response again creates no second one', (await submit({ segment: 'مدیران' })).body, { ok: true });
  equal('submit: still exactly one response', (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.length, 1);
  equal('submit: invalid answers → 400', (await submit({ responseId: 'resp-0000000000000002', answers: { Q01: 9 } })).body.error, 'invalid_answers');
  equal('submit: a bad response id → 400', (await submit({ responseId: 'x' })).body.error, 'invalid_response');
  equal('submit: unknown group → 400', (await submit({ responseId: 'resp-0000000000000003', segment: 'ناشناس' })).body.error, 'invalid_segment');
  equal('submit: a response id from another event conflicts', await (async () => {
    const other = await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', title: 'دیگر' } });
    return (await call(surveyHandler, { method: 'POST', body: { code: other.body.code, ...payload() } })).body.error;
  })(), 'response_conflict');

  const stored = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses[0];
  check('admin sees the raw answers', stored.answers.Q22 === 10 && stored.answers.Q23 === 'بازی تیمی' && stored.answers.Q25 === 'زمان بیشتر' && stored.words.join() === 'جذاب,عملی,پرانرژی' && stored.segment === 'مدیران');
  check('the response holds no identifying field at all', Object.keys(stored).sort().join() === 'answers,clientVersion,deleted,durationSeconds,eventId,id,segment,startedAt,submittedAt,tags,words', Object.keys(stored).join());
  check('duration is measured by the server', stored.durationSeconds >= 399 && stored.durationSeconds <= 420);
  const sql = await db();
  const columns = (await sql`SELECT column_name FROM information_schema.columns WHERE table_name IN ('hamgera_rx_responses','hamgera_rx_answers')`).map((r) => r.column_name).join(' ');
  check('schema: no ip, token, name, phone or e-mail column exists', !/ip|token|name|phone|mobile|email|user/i.test(columns), columns);

  // schedule enforcement
  const future = new Date(Date.now() + 3600_000).toISOString();
  await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'updateEvent', id: eventId, title: 'بوت‌کمپ ۳ت', segments: ['مدیران', 'کارشناسان'], isActive: true, opensAt: future } });
  equal('upcoming: info says so', (await call(surveyHandler, { query: { code } })).body.status, 'upcoming');
  equal('upcoming: submit refused', (await submit({ responseId: 'resp-0000000000000004' })).body.error, 'closed');
  await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'updateEvent', id: eventId, title: 'بوت‌کمپ ۳ت', segments: ['مدیران', 'کارشناسان'], isActive: false } });
  equal('switched off: info says closed, submit refused', [(await call(surveyHandler, { query: { code } })).body.status, (await submit({ responseId: 'resp-0000000000000005' })).body.error], ['closed', 'closed']);
  equal('a retry of an already stored response still succeeds after closing', (await submit({ segment: 'مدیران' })).body, { ok: true });
  await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'updateEvent', id: eventId, title: 'بوت‌کمپ ۳ت', segments: ['مدیران', 'کارشناسان'], isActive: true } });
  equal('reopened: submissions work again', (await submit({ responseId: 'resp-0000000000000006', segment: 'کارشناسان' })).body, { ok: true });

  // edit / delete / tags with audit
  const rid = 'resp-0000000000000001';
  const edit = (changes: object) => call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'editResponse', responseId: rid, changes } });
  equal('edit: invalid value rejected, nothing applied', [(await edit({ Q03: 9 })).body.error, (await edit({ Q03: 1, Q04: 0 })).body.error], ['invalid_changes', 'invalid_changes']);
  const unchanged = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.find((r: any) => r.id === rid);
  check('edit: a rejected batch changes nothing', unchanged.answers.Q03 === 5);
  equal('edit: valid changes applied', (await edit({ Q03: 2, Q23: 'متن تازه', Q27: ['الف', 'ب'], segment: 'کارشناسان' })).body, { ok: true });
  const edited = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.find((r: any) => r.id === rid);
  check('edit: values, words and group are updated', edited.answers.Q03 === 2 && edited.answers.Q23 === 'متن تازه' && edited.words.join() === 'الف,ب' && edited.segment === 'کارشناسان');
  equal('tags: set on an open answer', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'setTags', responseId: rid, questionId: 'Q23', tags: ['مثبت', 'مثبت', 'تیمی'] } })).body, { ok: true });
  equal('tags: not allowed on a rating', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'setTags', responseId: rid, questionId: 'Q01', tags: ['x'] } })).body.error, 'invalid_tags');
  const tagged = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.find((r: any) => r.id === rid);
  equal('tags: stored without duplicates', tagged.tags.Q23, ['مثبت', 'تیمی']);

  equal('delete: soft delete', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'deleteResponse', responseId: rid } })).body, { ok: true });
  const live = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses;
  const all = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId, includeDeleted: '1' } })).body.responses;
  equal('delete: excluded from analysis, still stored', [live.some((r: any) => r.id === rid), all.some((r: any) => r.id === rid && r.deleted)], [false, true]);
  await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'restoreResponse', responseId: rid } });
  equal('restore: back in the analysis', (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.some((r: any) => r.id === rid), true);

  const audit = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'audit', eventId } })).body.audit;
  const actions = audit.map((a: any) => a.action);
  check('audit: edit, tags, delete, restore and event changes are logged', ['edit_response', 'set_tags', 'delete_response', 'restore_response', 'update_event', 'create_event'].every((a) => actions.includes(a)), actions.join());
  const editLog = audit.find((a: any) => a.action === 'edit_response');
  check('audit: keeps before and after values', editLog.before.Q03 === 5 && editLog.after.Q03 === 2 && editLog.responseId === rid);
  equal('unknown response → 404', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'deleteResponse', responseId: 'nope' } })).status, 404);

  // optional text: only the ratings are mandatory
  const ratingsOnly = Object.fromEntries(LIKERT_IDS.map((id) => [id, 4]).concat([['Q21', 7], ['Q22', 8]]));
  equal('submit: ratings only (no words, no text) is accepted', (await submit({ responseId: 'resp-0000000000000007', answers: ratingsOnly, words: [] })).body, { ok: true });
  const bareStored = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.find((r: any) => r.id === 'resp-0000000000000007');
  check('a ratings-only response is stored and counted', bareStored && bareStored.words.length === 0 && bareStored.answers.Q23 === undefined && bareStored.answers.Q22 === 8);
  equal('submit: a missing rating is still refused', (await submit({ responseId: 'resp-0000000000000008', answers: { ...ratingsOnly, Q09: undefined }, words: [] })).body.error, 'invalid_answers');
  equal('edit: the three words can be cleared', (await edit({ Q27: [] })).body, { ok: true });
  check('edit: cleared words stay cleared', (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.find((r: any) => r.id === rid).words.length === 0);

  const list = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'events' } })).body.events;
  equal('events list: counts only live responses, shows link status', [list.find((e: any) => e.id === eventId).responses, list.find((e: any) => e.id === eventId).status], [3, 'open']);

  return results;
}

// ---- exports: CSV and Excel layouts (spec §9) -----------------------------------------------------------
import { RAW_COLUMNS, buildCsv, buildSheets, csvCell, rawRows } from '../src/survey/admin/exports.js';
import type { RxEvent } from '../src/survey/admin/rxApi.js';

export async function runReactionExports() {
  const { results, check, equal } = createChecker();
  const event = { id: 'e1', code: 'abc', title: 'بوت‌کمپ ۳ت', eventDate: '2026-10-10', cohort: 'دوره ۱', location: null, segments: [], isActive: true, opensAt: null, closesAt: null, surveyVersion: '1.0', createdAt: '', status: 'open', responses: 2 } as RxEvent;
  const rs: RxResponse[] = [
    response({ id: 'r1', likert: 4, q21: 8, q22: 9, segment: 'مدیران', words: ['الف', 'ب', 'ج'], answers: { Q23: '=HYPERLINK("x")', Q25: 'متن، با ویرگول و "نقل‌قول"' } }),
    response({ id: 'r2', likert: 5, q21: 10, q22: 10, words: ['تنها'] }),
  ];

  const expected = [
    'response_id', 'event_id', 'event_title', 'event_date', 'cohort', 'segment', 'started_at', 'submitted_at', 'duration_seconds',
    ...Array.from({ length: 20 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`), 'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26',
    'Q27_word1', 'Q27_word2', 'Q27_word3', 'design_relevance_score', 'engagement_score', 'facilitation_delivery_score', 'overall_satisfaction_score', 'reaction_index',
  ];
  equal('columns follow the spec exactly', RAW_COLUMNS, expected);
  equal('column count: 9 + 20 + 2 + 4 + 3 + 5', RAW_COLUMNS.length, 43);
  check('column names are unique and ASCII', new Set(RAW_COLUMNS).size === RAW_COLUMNS.length && RAW_COLUMNS.every((c) => /^[A-Za-z0-9_]+$/.test(c)));

  const rows = rawRows([event], rs);
  equal('one row per final response, Q27 in three columns', [rows.length, rows[0][RAW_COLUMNS.indexOf('Q27_word1')], rows[0][RAW_COLUMNS.indexOf('Q27_word3')], rows[1][RAW_COLUMNS.indexOf('Q27_word2')]], [2, 'الف', 'ج', null]);
  equal('scores in the row', [rows[0][RAW_COLUMNS.indexOf('design_relevance_score')], rows[0][RAW_COLUMNS.indexOf('reaction_index')], rows[1][RAW_COLUMNS.indexOf('reaction_index')]], [75, 75, 100]);

  const csv = buildCsv([event], rs);
  check('CSV: UTF-8 BOM, header, one line per response', csv.startsWith('﻿"response_id"') && csv.split('\n').length === 3);
  check('CSV: spreadsheet formulas are neutralised', csvCell('=HYPERLINK("x")') === `"'=HYPERLINK(""x"")"` && !csv.includes(',"=HYPERLINK'));
  check('CSV: commas and quotes survive quoting', csv.includes('"متن، با ویرگول و ""نقل‌قول"""'));
  check('CSV: no response of another event leaks in', buildCsv([{ ...event, id: 'other' }], rs).split('\n').length === 1);

  const sheets = buildSheets([event], rs, 'بدون فیلتر');
  equal('Excel: summary carries n, Reaction Index and NPS', [sheets.summary.find((r) => r[0] === 'Final responses')![1], sheets.summary.find((r) => r[0] === 'Reaction Index')![1], sheets.summary.find((r) => r[0] === 'NPS')![1]], [2, 87.5, 100]);
  equal('Excel: item analysis has Q01–Q20 with Top-2', [sheets.items.length, sheets.items[1][0], sheets.items[1][6]], [21, 'Q01', 100]);

  // Write a real .xlsx with the same library and read it back.
  const { default: writeExcelFile } = await import('write-excel-file/node');
  const { readSheet } = await import('read-excel-file/node');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(os.tmpdir(), `rx-${Date.now()}.xlsx`);
  await writeExcelFile([
    { data: sheets.raw as any, sheet: 'Raw Responses', rightToLeft: true },
    { data: sheets.summary as any, sheet: 'Summary' },
    { data: sheets.items as any, sheet: 'Item Analysis' },
  ]).toFile(file);
  const raw = (await readSheet(file, 'Raw Responses')) as any[][];
  const items = (await readSheet(file, 'Item Analysis')) as any[][];
  equal('Excel file: sheets round-trip (rows, columns, first response id, Persian text)', [raw.length, raw[0].length, raw[1][0], raw[1][RAW_COLUMNS.indexOf('Q23')], items.length], [3, 43, 'r1', '=HYPERLINK("x")', 21]);
  return results;
}
