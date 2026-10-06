import { allow, endpoint, HttpError, queryString } from './_lib/http.js';
import { db } from './_lib/db.js';
import { isAdminRequest, requireAdmin, requireUser } from './_lib/auth.js';
import { loadConfig } from './_lib/testConfig.js';
import { HANDLERS } from './_lib/tests/index.js';
import { isTestId } from '../shared/tests.js';
import { canSubmit } from '../shared/schedule.js';

/**
 * POST /api/sessions  participant (Bearer) → { testId, sessionId, startedAt, payload }
 *     Stores a finished session. The server decides whether the test is open, validates the payload and computes
 *     the result. Idempotent by sessionId; one submission per person unless the admin allowed retakes.
 *     → { ok, result }   (`result` only when the admin lets participants see results of this test)
 * GET  /api/sessions?testId=…  participant → { session: { sessionId, submittedAt, result } | null } (their latest)
 * GET  /api/sessions?testId=…  admin       → { sessions: [{ sessionId, mobile, firstName, lastName, createdAt, data, result }] }
 */

const SESSION_ID = /^[A-Za-z0-9_-]{3,80}$/;
const LIST_LIMIT = 5000;

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'POST');
  const sql = await db();

  if (req.method === 'POST') {
    const user = await requireUser(req);
    const { testId, sessionId, startedAt, payload } = req.body ?? {};
    if (!isTestId(testId) || typeof sessionId !== 'string' || !SESSION_ID.test(sessionId) || typeof startedAt !== 'string' || !payload) {
      throw new HttpError(400, 'invalid_session');
    }
    const cfg = await loadConfig(testId);

    // A retry of a submission that already went through: answer with what was stored.
    const same = await sql`SELECT phone, result FROM hamgera_sessions WHERE session_id = ${sessionId}`;
    if (same.length > 0) {
      if (same[0].phone !== user.phone) throw new HttpError(409, 'session_conflict');
      return { ok: true, result: cfg.showResult ? same[0].result : null };
    }

    const handler = HANDLERS[testId];
    if (!handler.ready) throw new HttpError(503, 'test_not_ready');
    if (!canSubmit(cfg, startedAt, Date.now())) throw new HttpError(403, 'test_closed');

    const { data, result } = handler.process(payload);
    const inserted = await sql`
      INSERT INTO hamgera_sessions (session_id, test_id, phone, started_at, data, result)
      SELECT ${sessionId}, ${testId}, ${user.phone}, ${startedAt}::timestamptz, ${JSON.stringify(data)}::jsonb, ${result ? JSON.stringify(result) : null}::jsonb
      WHERE ${cfg.allowRetake}::boolean
         OR NOT EXISTS (SELECT 1 FROM hamgera_sessions WHERE test_id = ${testId} AND phone = ${user.phone})
      RETURNING session_id
    `;
    if (inserted.length === 0) throw new HttpError(409, 'already_submitted');
    return { ok: true, result: cfg.showResult ? result : null };
  }

  const testId = queryString(req, 'testId');
  if (!isTestId(testId)) throw new HttpError(400, 'invalid_test');

  if (isAdminRequest(req) || req.headers['x-admin-password']) {
    requireAdmin(req);
    const rows = await sql`
      SELECT s.session_id, s.phone, s.created_at, s.data, s.result, u.first_name, u.last_name
      FROM hamgera_sessions s LEFT JOIN hamgera_users u ON u.phone = s.phone
      WHERE s.test_id = ${testId}
      ORDER BY s.created_at DESC
      LIMIT ${LIST_LIMIT}
    `;
    return {
      sessions: rows.map((r) => ({
        sessionId: r.session_id,
        mobile: r.phone,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        createdAt: new Date(r.created_at).toISOString(),
        data: r.data,
        result: r.result,
      })),
    };
  }

  const user = await requireUser(req);
  const cfg = await loadConfig(testId);
  const rows = await sql`
    SELECT session_id, created_at, result FROM hamgera_sessions
    WHERE test_id = ${testId} AND phone = ${user.phone} ORDER BY created_at DESC LIMIT 1
  `;
  if (rows.length === 0) return { session: null };
  return {
    session: {
      sessionId: rows[0].session_id,
      submittedAt: new Date(rows[0].created_at).toISOString(),
      result: cfg.showResult ? rows[0].result : null,
    },
  };
});
