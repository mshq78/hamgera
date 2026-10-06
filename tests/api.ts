import authHandler from '../api/auth.js';
import usersHandler from '../api/users.js';
import testsHandler from '../api/tests.js';
import sessionsHandler from '../api/sessions.js';
import { MASIRNAMA_QUESTION_IDS } from '../api/_lib/tests/masirnama.js';
import { call, createChecker, useMemoryDatabase } from './harness.js';

const ADMIN = { 'x-admin-password': 'test-admin' };
const NID = '0012345679';
const MOBILE = '09123456789';

function masirnamaPayload() {
  return {
    questionSetVersion: '1.0', consentVersion: '1.0',
    consentAcceptedAt: '2026-10-10T08:00:00Z', startedAt: '2026-10-10T08:00:00Z', finishedAt: '2026-10-10T08:20:00Z',
    answers: MASIRNAMA_QUESTION_IDS.map((id) => ({
      questionId: id, text: 'پاسخ آزمایشی برای ' + id,
      clientMeta: { activeTimeMs: 60000, pasteEvents: 0, pastedChars: 0, editCount: 3, revisions: [], timestamp: '2026-10-10T08:10:00Z', questionSetVersion: '1.0' },
    })),
  };
}

export async function runApi() {
  const { results, check, equal } = createChecker();
  process.env.ADMIN_PASSWORD = 'test-admin';
  await useMemoryDatabase();

  // ---- roster --------------------------------------------------------------------------------
  equal('users: needs admin', (await call(usersHandler)).status, 401);
  const add = await call(usersHandler, {
    method: 'POST', headers: ADMIN,
    body: { users: [
      { firstName: 'سارا', lastName: 'احمدی', mobile: MOBILE, nationalId: NID },
      { firstName: 'علی', lastName: 'رضایی', mobile: '123', nationalId: NID },
      { firstName: '', lastName: 'x', mobile: '09120000000', nationalId: NID },
    ] },
  });
  equal('users: one added, two rejected', [add.body.added, add.body.errors.map((e: any) => e.reason)], [1, ['mobile', 'name']]);
  const list = await call(usersHandler, { headers: ADMIN });
  check('users: national ID never returned', !JSON.stringify(list.body).includes(NID) && !JSON.stringify(list.body).includes('nid'));

  // ---- login ---------------------------------------------------------------------------------
  const bad = await call(authHandler, { method: 'POST', body: { mobile: MOBILE, nationalId: '1111111111' } });
  equal('login: invalid national id format', bad.status, 400);
  const unknown = await call(authHandler, { method: 'POST', body: { mobile: '09350000000', nationalId: NID } });
  equal('login: unknown number', [unknown.status, unknown.body.error], [401, 'invalid_credentials']);
  const login = await call(authHandler, { method: 'POST', body: { mobile: '۰۹۱۲۳۴۵۶۷۸۹', nationalId: '۰۰۱۲۳۴۵۶۷۹' } });
  equal('login: ok with Persian digits', [login.status, login.body.firstName], [200, 'سارا']);
  const token = login.body.token as string;
  const USER = { authorization: `Bearer ${token}` };

  const other = '0013542419';
  await call(usersHandler, { method: 'POST', headers: ADMIN, body: { users: [{ firstName: 'نگین', lastName: 'کریمی', mobile: '09350000001', nationalId: other }] } });
  const wrongNid = { mobile: '09350000001', nationalId: NID };
  let last = 0;
  for (let i = 0; i < 5; i++) last = (await call(authHandler, { method: 'POST', body: wrongNid })).status;
  equal('login: 5th wrong attempt locks', last, 429);
  equal('login: locked even with the right password', (await call(authHandler, { method: 'POST', body: { mobile: '09350000001', nationalId: other } })).status, 429);

  // ---- tests are closed until the admin opens them ------------------------------------------
  equal('tests: participant needs a token', (await call(testsHandler)).status, 401);
  equal('tests: closed tests are hidden', (await call(testsHandler, { headers: USER })).body.tests, []);

  const session = (id: string, startedAt = new Date().toISOString()) => ({ testId: 'masirnama', sessionId: id, startedAt, payload: masirnamaPayload() });
  equal('submit: refused while closed', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_closed') })).body.error, 'test_closed');

  const put = (body: object) => call(testsHandler, { method: 'PUT', headers: ADMIN, body });
  const base = { testId: 'masirnama', mode: 'scheduled', graceMinutes: 15, allowRetake: false, showResult: false };
  const future = new Date(Date.now() + 3600_000).toISOString();
  const inTwoHours = new Date(Date.now() + 7200_000).toISOString();

  equal('schedule: needs admin', (await call(testsHandler, { method: 'PUT', body: base })).status, 401);
  equal('schedule: end before start', (await put({ ...base, opensAt: inTwoHours, closesAt: future })).body.error, 'closes_before_opens');
  equal('schedule: not-ready tests cannot be opened', (await put({ ...base, testId: 'tasmimnama', opensAt: future })).body.error, 'test_not_ready');

  equal('schedule: set for the future', (await put({ ...base, opensAt: future, closesAt: inTwoHours })).status, 200);
  const upcoming = (await call(testsHandler, { headers: USER })).body.tests;
  equal('tests: upcoming is listed with its time', [upcoming.length, upcoming[0].status, upcoming[0].opensAt], [1, 'upcoming', future]);
  equal('submit: refused before the start time', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_early') })).body.error, 'test_closed');

  // ---- open ----------------------------------------------------------------------------------
  const past = new Date(Date.now() - 60_000).toISOString();
  await put({ ...base, opensAt: past, closesAt: inTwoHours });
  equal('tests: open now', (await call(testsHandler, { headers: USER })).body.tests[0].status, 'open');

  equal('submit: invalid payload', (await call(sessionsHandler, { method: 'POST', headers: USER, body: { ...session('sess_bad'), payload: { answers: [] } } })).body.error, 'invalid_session');
  const ok = await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_one') });
  equal('submit: stored; no result shown for masirnama', [ok.status, ok.body], [200, { ok: true, result: null }]);
  equal('submit: retry of the same session is idempotent', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_one') })).status, 200);
  equal('submit: a second session is refused', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_two') })).body.error, 'already_submitted');
  equal('submit: needs login', (await call(sessionsHandler, { method: 'POST', body: session('sess_x') })).status, 401);
  equal('tests: completed flag', (await call(testsHandler, { headers: USER })).body.tests[0].completed, true);

  const mine = await call(sessionsHandler, { headers: USER, query: { testId: 'masirnama' } });
  equal('mine: no result exposed', [mine.body.session.sessionId, mine.body.session.result], ['sess_one', null]);

  const adminList = await call(sessionsHandler, { headers: ADMIN, query: { testId: 'masirnama' } });
  equal('admin: sees the session with the participant name', [adminList.body.sessions.length, adminList.body.sessions[0].firstName, adminList.body.sessions[0].data.answers.length], [1, 'سارا', 12]);
  equal('admin: wrong password is refused, not treated as a participant', (await call(sessionsHandler, { headers: { 'x-admin-password': 'nope' }, query: { testId: 'masirnama' } })).status, 401);

  const people = await call(usersHandler, { headers: ADMIN });
  equal('roster shows completed tests', people.body.users.find((u: any) => u.mobile === MOBILE).completed, ['masirnama']);

  // ---- retake and grace ----------------------------------------------------------------------
  await put({ ...base, opensAt: past, closesAt: inTwoHours, allowRetake: true });
  equal('retake: allowed once the admin enables it', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_three') })).status, 200);

  const justClosed = new Date(Date.now() - 5 * 60_000).toISOString();
  const opened = new Date(Date.now() - 3600_000).toISOString();
  await put({ ...base, opensAt: opened, closesAt: justClosed, allowRetake: true });
  equal('tests: ended', (await call(testsHandler, { headers: USER })).body.tests[0].status, 'ended');
  equal('grace: started before the end, submits 5 min after → accepted', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_grace', new Date(Date.now() - 20 * 60_000).toISOString()) })).status, 200);
  equal('grace: started after the end → refused', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_late', new Date().toISOString()) })).body.error, 'test_closed');

  // manual close beats everything
  await put({ ...base, mode: 'closed' });
  equal('closed manually: no grace', (await call(sessionsHandler, { method: 'POST', headers: USER, body: session('sess_manual', new Date(Date.now() - 20 * 60_000).toISOString()) })).body.error, 'test_closed');

  // admin tests overview
  const overview = await call(testsHandler, { headers: ADMIN });
  const m = overview.body.tests.find((t: any) => t.testId === 'masirnama');
  equal('admin overview: counts', [overview.body.tests.length, m.sessions, m.people, m.mode], [3, 3, 1, 'closed']);

  // deleted users lose access immediately
  await call(usersHandler, { method: 'DELETE', headers: ADMIN, query: { mobile: MOBILE } });
  equal('deleted user: token no longer works', (await call(testsHandler, { headers: USER })).status, 401);

  return results;
}
