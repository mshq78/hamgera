import surveyHandler from '../api/survey.js';
import reactionHandler from '../api/reaction.js';
import { round1, roundNps, RxResponse } from '../shared/reaction/metrics.js';
import { cleanHampayam } from '../shared/hampayam/validate.js';
import { HP_ALL_IDS, HP_JOURNEY_IDS, HP_LIKERT_IDS, HP_OPEN_IDS, HP_SCALE_IDS, HP_DEFAULT_CONFIG } from '../shared/hampayam/questions.js';
import { MIN_GROUP, hpScores, normalize, profileGroups, strengthsAndOpportunities, summarizeHp } from '../shared/hampayam/metrics.js';
import { HP_RAW_COLUMNS, hpCsv, hpOpenCsv, hpRawRows, hpSheets } from '../src/survey/admin/hpExports.js';
import { journeySvg, kpiCardSvg, LIGHT } from '../src/survey/admin/hpSvg.js';
import type { RxEvent } from '../src/survey/admin/rxApi.js';
import { call, createChecker, useMemoryDatabase } from './harness.js';

const ADMIN = { 'x-admin-password': 'test-admin' };

const resp = (over: { id?: string; likert?: number; q25?: number; q26?: number; q27?: number; journey?: Record<string, number | string>; answers?: Record<string, number | string>; dur?: number } = {}): RxResponse => ({
  id: over.id ?? Math.random().toString(36).slice(2), eventId: 'e1', segment: null, startedAt: '2026-10-10T08:00:00Z', submittedAt: '2026-10-10T08:10:00Z', durationSeconds: over.dur ?? 400,
  answers: { ...Object.fromEntries(HP_LIKERT_IDS.map((id) => [id, over.likert ?? 4])), Q25: over.q25 ?? 8, Q26: over.q26 ?? 9, Q27: over.q27 ?? 7, ...(over.journey ?? {}), ...(over.answers ?? {}) },
  words: [],
});

const body = (over: Record<string, unknown> = {}) => ({
  responseId: 'hp-resp-00000000001', startedAt: new Date(Date.now() - 400_000).toISOString(),
  answers: { ...Object.fromEntries(HP_LIKERT_IDS.map((id, i) => [id, 3 + (i % 3)])), Q25: 9, Q26: 10, Q27: 8, J01: 5, J02: 'NA', J03: 3, O01: 'لحظه <b>اوج</b>', P02: 'مدیر' },
  ...over,
});

export async function runHampayam() {
  const { results, check, equal } = createChecker();

  // ---- formulas (spec §9–10) ----------------------------------------------------------------------
  equal('normalisation: 1→0, 2→25, 3→50, 4→75, 5→100', [1, 2, 3, 4, 5].map(normalize), [0, 25, 50, 75, 100]);
  const sc = hpScores(resp({ likert: 4 }));
  equal('six indices of all-4 answers are 75; Experience Index is their simple mean', [sc.EXP, sc.ENG, sc.CON, sc.DES, sc.FAC, sc.IDN, sc.experience_index], Array(7).fill(75));
  const mixed = resp({ answers: { Q01: 5, Q02: 5, Q03: 5, Q04: 5, Q05: 1, Q06: 1, Q07: 1, Q08: 1 } });
  equal('EXP = mean(Q01..Q04), ENG = mean(Q05..Q08), index averages all six', [hpScores(mixed).EXP, hpScores(mixed).ENG, round1(hpScores(mixed).experience_index)], [100, 0, 66.7]);
  check('the questionnaire has Q01–Q27, J01–J10, O01–O05', HP_ALL_IDS.length === 24 + 3 + 10 + 5 && HP_LIKERT_IDS[23] === 'Q24' && HP_SCALE_IDS.join() === 'Q25,Q26,Q27' && HP_JOURNEY_IDS.length === 10 && HP_OPEN_IDS.length === 5);

  const s = summarizeHp([resp({ q26: 10 }), resp({ q26: 9 }), resp({ q26: 8 }), resp({ q26: 3 })]);
  equal('NPS uses Q26: 2 promoters, 1 passive, 1 detractor → +25', [roundNps(s.nps.score), s.nps.promoters, s.nps.passives, s.nps.detractors], [25, 50, 25, 25]);
  equal('Overall (Q25) mean and Valid/Missing N per item', [s.overall.mean, s.items[0].n, s.n - s.items[0].n], [8, 4, 0]);

  const j = summarizeHp([resp({ journey: { J01: 5, J02: 1 } }), resp({ journey: { J01: 3, J02: 'NA' } }), resp({ journey: { J01: 'NA' } }), resp({})]);
  equal('journey: N/A is dropped from the mean and from the valid N (J01 mean of 5 and 3)', [j.journey[0].mean, j.journey[0].n, j.journey[0].na], [4, 2, 1]);
  equal('journey: J02 rated once and N/A once', [j.journey[1].mean, j.journey[1].n, j.journey[1].na], [1, 1, 1]);
  equal('journey: Peak is the highest mean, Friction the lowest; unrated stations are ignored', [j.peak?.id, j.friction?.id], ['J01', 'J02']);
  check('journey: nobody rated anything → no peak/friction, no crash', summarizeHp([resp()]).peak === null && summarizeHp([resp()]).friction === null);
  const sw = strengthsAndOpportunities(summarizeHp([resp({ answers: { Q03: 1 } })]).items);
  check('strengths/opportunities: five each, the weakest item first among opportunities', sw.strengths.length === 5 && sw.opportunities.length === 5 && sw.opportunities[0].id === 'Q03');
  check('empty set does not crash', Number.isNaN(summarizeHp([]).experienceIndex) && summarizeHp([]).n === 0);

  // ---- privacy: filters need n ≥ 5 ------------------------------------------------------------------
  const many = [...Array.from({ length: MIN_GROUP }, () => resp({ answers: { P02: 'مدیر' } })), ...Array.from({ length: MIN_GROUP - 1 }, () => resp({ answers: { P02: 'معاون' } }))];
  equal('profile filters list only groups of at least 5 responses', profileGroups(many, 'P02'), [{ value: 'مدیر', n: MIN_GROUP }]);

  // ---- validation -----------------------------------------------------------------------------------
  const cfg = HP_DEFAULT_CONFIG;
  const err = (b: unknown, companies: string[] = [], c = cfg) => ('error' in (cleanHampayam(b, companies, c) as object) ? (cleanHampayam(b, companies, c) as { error: string }).error : 'ok');
  equal('a valid submission is accepted', err(body()), 'ok');
  const c = cleanHampayam(body(), [], cfg) as any;
  check('markup stripped, N/A kept, journey/profile/open are optional', c.answers.O01 === 'لحظه اوج' && c.answers.J02 === 'NA' && !('J04' in c.answers) && c.answers.P02 === 'مدیر');
  const b0 = body();
  const without = (id: string) => ({ ...b0, answers: Object.fromEntries(Object.entries(b0.answers).filter(([k]) => k !== id)) });
  equal('every Likert and Q25–Q27 is mandatory', ['Q01', 'Q24', 'Q25', 'Q26', 'Q27'].map((id) => err(without(id))), Array(5).fill('invalid_answers'));
  equal('the journey, profile and open questions are optional', err({ ...b0, answers: Object.fromEntries(Object.entries(b0.answers).filter(([k]) => /^Q/.test(k))) }), 'ok');
  equal('Likert outside 1–5 and scale outside 0–10 are rejected', [0, 6, 2.5].map((v) => err({ ...b0, answers: { ...b0.answers, Q05: v } })).concat([-1, 11].map((v) => err({ ...b0, answers: { ...b0.answers, Q26: v } }))), Array(5).fill('invalid_answers'));
  equal('journey accepts 1–5 and NA, rejects 0, 6 and other strings', [1, 5, 'NA'].map((v) => err({ ...b0, answers: { ...b0.answers, J05: v } })).concat([0, 6, 'x'].map((v) => err({ ...b0, answers: { ...b0.answers, J05: v } }))), ['ok', 'ok', 'ok', 'invalid_answers', 'invalid_answers', 'invalid_answers']);
  equal('open answers are cut at their own limits (O03 300, O01 500)', [(cleanHampayam({ ...b0, answers: { ...b0.answers, O03: 'ب'.repeat(900), O01: 'ب'.repeat(900) } }, [], cfg) as any).answers].map((a) => [a.O03.length, a.O01.length])[0], [300, 500]);
  equal('profile: P02/P03 must be from the fixed lists, P01 from the event\'s companies', [err({ ...b0, answers: { ...b0.answers, P02: 'رئیس' } }), err({ ...b0, answers: { ...b0.answers, P01: 'الف' } }, ['الف']), err({ ...b0, answers: { ...b0.answers, P01: 'ب' } }, ['الف']), err({ ...b0, answers: { ...b0.answers, P01: 'الف' } }, [])], ['invalid_profile', 'ok', 'invalid_profile', 'invalid_profile']);
  equal('a disabled profile field is refused', err({ ...b0, answers: { ...b0.answers, P03: '۲ تا ۵ سال' } }, [], { ...cfg, profileP03: false }), 'invalid_profile');
  equal('garbage and a missing start time', [err(null), err({}), err({ ...b0, startedAt: 'x' })], ['invalid_answers', 'invalid_answers', 'invalid_time']);

  // ---- API ----------------------------------------------------------------------------------------------
  process.env.ADMIN_PASSWORD = 'test-admin';
  await useMemoryDatabase();
  const created = await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', kind: 'hampayam', title: 'هم‌پیام', eventDate: '2026-10-10', segments: ['الف', 'ب'], isActive: true, config: { profileP02: true, profileP03: false } } });
  check('HamPayam event created with a 6-character link', created.status === 200 && /^[a-z0-9]{6}$/.test(created.body.code), JSON.stringify(created.body));
  const { id: eventId, code } = created.body as { id: string; code: string };
  const info = await call(surveyHandler, { query: { code } });
  equal('public info says which form it is and which profile fields are on', [info.body.kind, info.body.config, info.body.segments], ['hampayam', { profileP02: true, profileP03: false }, ['الف', 'ب']]);
  const send = (o: Record<string, unknown> = {}) => call(surveyHandler, { method: 'POST', body: { code, ...body(), ...o } });
  equal('submit: ok without login', (await send()).body, { ok: true });
  equal('submit: repeating the same response id creates nothing new', (await send()).body, { ok: true });
  const got = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses as any[];
  equal('exactly one response stored, with numbers, N/A, profile and text restored', [got.length, got[0].answers.Q25, got[0].answers.J01, got[0].answers.J02, got[0].answers.P02, got[0].answers.O01, got[0].answers.Q27], [1, 9, 5, 'NA', 'مدیر', 'لحظه اوج', 8]);
  check('Q27 is a rating here, not the 3T "three words"', got[0].words.length === 0);
  equal('submit: missing rating → 400', (await send({ responseId: 'hp-resp-00000000002', answers: { Q01: 5 } })).body.error, 'invalid_answers');
  equal('submit: P03 is switched off for this event', (await send({ responseId: 'hp-resp-00000000003', answers: { ...body().answers, P03: '۲ تا ۵ سال' } })).body.error, 'invalid_profile');
  const all = await call(reactionHandler, { headers: ADMIN, query: { resource: 'events' } });
  const ev = all.body.events.find((e: any) => e.id === eventId);
  equal('admin list: kind, config and count', [ev.kind, ev.config, ev.responses], ['hampayam', { profileP02: true, profileP03: false }, 1]);

  // admin actions on a HamPayam response
  const rid = got[0].id;
  equal('tag / star an open answer', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'setTags', responseId: rid, questionId: 'O01', tags: ['ضیافت', '★ منتخب'] } })).status, 200);
  equal('tags only on O01–O05', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'setTags', responseId: rid, questionId: 'Q05', tags: ['x'] } })).body.error, 'invalid_tags');
  const tagged = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses[0];
  equal('tags come back with the response', tagged.tags.O01, ['ضیافت', '★ منتخب']);
  equal('edit: a rating, a journey value (clear and N/A) and an open answer', (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'editResponse', responseId: rid, changes: { Q05: 2, J01: null, J03: 'NA', O01: 'ویرایش' } } })).status, 200);
  const edited = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses[0];
  equal('edited values stored', [edited.answers.Q05, 'J01' in edited.answers, edited.answers.J03, edited.answers.O01], [2, false, 'NA', 'ویرایش']);
  equal('edit rejects out-of-range values and unknown questions', [(await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'editResponse', responseId: rid, changes: { Q05: 9 } } })).body.error, (await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'editResponse', responseId: rid, changes: { Z1: 1 } } })).body.error], ['invalid_changes', 'invalid_changes']);
  equal('soft delete and restore', [(await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'deleteResponse', responseId: rid } })).status, (await call(reactionHandler, { headers: ADMIN, query: { resource: 'responses', eventIds: eventId } })).body.responses.length], [200, 0]);
  await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'restoreResponse', responseId: rid } });
  const audit = (await call(reactionHandler, { headers: ADMIN, query: { resource: 'audit', eventId } })).body.audit.map((a: any) => a.action);
  check('every admin change is in the audit log', ['create_event', 'set_tags', 'edit_response', 'delete_response', 'restore_response'].every((a) => audit.includes(a)), audit.join());
  equal('updating the event keeps its kind', [(await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'updateEvent', id: eventId, title: 'هم‌پیام ۲', segments: ['الف'], config: { profileP02: false, profileP03: true } } })).status, (await call(surveyHandler, { query: { code } })).body.kind, (await call(surveyHandler, { query: { code } })).body.config], [200, 'hampayam', { profileP02: false, profileP03: true }]);

  // a 3T event still works next to it
  const tt = await call(reactionHandler, { method: 'POST', headers: ADMIN, body: { action: 'createEvent', title: '۳ت' } });
  equal('a normal event is still the 3T form', (await call(surveyHandler, { query: { code: tt.body.code } })).body.kind, 'tt');

  // ---- exports --------------------------------------------------------------------------------------------
  const event = { id: 'e1', code: 'abc', title: 'هم‌پیام', eventDate: '2026-10-10', cohort: null, location: null, segments: [], isActive: true, opensAt: null, closesAt: null, surveyVersion: '1.0', kind: 'hampayam', config: HP_DEFAULT_CONFIG, createdAt: '', status: 'open', responses: 2 } as RxEvent;
  const rs = [resp({ id: 'r1', journey: { J01: 5, J02: 'NA', J03: 2 }, answers: { O01: '=HYPERLINK("x")', O05: 'متن، با "نقل‌قول"', P02: 'مدیر' } }), resp({ id: 'r2', dur: 20 })];
  const csv = hpCsv([event], rs);
  check('CSV: UTF-8 BOM, one row per response, formula-injection neutralised', csv.startsWith('﻿') && csv.split('\n').length === 3 && csv.includes(`"'=HYPERLINK`));
  check('CSV: columns carry no name, phone, token or IP — only a random response id', !HP_RAW_COLUMNS.some((x) => /name|phone|mobile|email|token|ip$|national/i.test(x)) && HP_RAW_COLUMNS[0] === 'response_id');
  equal('raw rows: <30 s is flagged, N/A kept as NA', [hpRawRows([event], rs)[1][8], hpRawRows([event], rs)[0][HP_RAW_COLUMNS.indexOf('J02')]], [1, 'NA']);
  const open = hpOpenCsv([event], rs, { r1: { O01: ['ضیافت'] } });
  check('open-answers CSV is separate and carries the tags', open.includes('O01') && open.includes('ضیافت') && open.includes('"متن، با ""نقل‌قول"""'));
  const sheets = hpSheets([event], rs, 'بدون فیلتر');
  equal('Excel: Summary, Questions (24), Journey (10), Open Feedback, Metadata', [sheets.questions.length - 1, sheets.journey.length - 1, sheets.openFeedback.length - 1, sheets.metadata[0]], [24, 10, 2, ['Key', 'Value']]);
  const svg = journeySvg(summarizeHp(rs), LIGHT);
  check('journey SVG is generated and labels peak/friction', svg.startsWith('<svg') && svg.includes('Peak') && svg.includes('Friction'));
  check('KPI card SVG is generated', kpiCardSvg(summarizeHp(rs), 'هم‌پیام').startsWith('<svg'));

  return results;
}
