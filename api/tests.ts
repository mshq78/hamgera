import { allow, endpoint, HttpError } from './_lib/http.js';
import { db } from './_lib/db.js';
import { audit, isAdminRequest, requireAdmin, requireUser } from './_lib/auth.js';
import { loadAllConfigs, saveConfig, TestConfig } from './_lib/testConfig.js';
import { HANDLERS } from './_lib/tests/index.js';
import { TEST_IDS, isTestId } from '../shared/tests.js';
import { effectiveStatus, validateSchedule } from '../shared/schedule.js';

/**
 * GET /api/tests      participant (Bearer token) → the tests that are open or upcoming for them, plus whether
 *                     they already completed each. `serverNow` lets the browser show a correct countdown.
 * GET /api/tests      admin (x-admin-password)   → every test with its full configuration and counts
 * PUT /api/tests      admin → { testId, mode, opensAt, closesAt, graceMinutes, allowRetake, showResult }
 */

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'PUT');
  const now = Date.now();
  const configs = await loadAllConfigs();

  if (req.method === 'PUT') {
    requireAdmin(req);
    const b = req.body ?? {};
    if (!isTestId(b.testId)) throw new HttpError(400, 'invalid_test');
    const cfg: TestConfig = {
      testId: b.testId,
      mode: b.mode,
      opensAt: typeof b.opensAt === 'string' ? b.opensAt : null,
      closesAt: typeof b.closesAt === 'string' ? b.closesAt : null,
      graceMinutes: b.graceMinutes,
      allowRetake: b.allowRetake === true,
      showResult: b.showResult === true,
    };
    const invalid = validateSchedule(cfg);
    if (invalid) throw new HttpError(400, invalid);
    if (cfg.mode !== 'closed' && !HANDLERS[cfg.testId].ready) throw new HttpError(409, 'test_not_ready');
    await saveConfig({
      ...cfg,
      opensAt: cfg.opensAt && new Date(cfg.opensAt).toISOString(),
      closesAt: cfg.closesAt && new Date(cfg.closesAt).toISOString(),
    });
    await audit(req, `set_schedule_${cfg.mode}`, cfg.testId, null);
    return { ok: true };
  }

  const sql = await db();

  if (isAdminRequest(req)) {
    const counts = await sql`SELECT test_id, count(*)::int AS sessions, count(DISTINCT phone)::int AS people FROM hamgera_sessions GROUP BY test_id`;
    return {
      serverNow: new Date(now).toISOString(),
      tests: TEST_IDS.map((id) => {
        const c = counts.find((r) => r.test_id === id);
        return {
          ...configs[id],
          status: effectiveStatus(configs[id], now),
          ready: HANDLERS[id].ready,
          notReadyReason: HANDLERS[id].notReadyReason ?? null,
          sessions: c?.sessions ?? 0,
          people: c?.people ?? 0,
        };
      }),
    };
  }

  const user = await requireUser(req);
  const done = await sql`SELECT test_id, max(created_at) AS at FROM hamgera_sessions WHERE phone = ${user.phone} GROUP BY test_id`;
  return {
    serverNow: new Date(now).toISOString(),
    tests: TEST_IDS.map((id) => {
      const cfg = configs[id];
      const d = done.find((r) => r.test_id === id);
      return {
        id,
        status: effectiveStatus(cfg, now),
        opensAt: cfg.opensAt,
        closesAt: cfg.closesAt,
        allowRetake: cfg.allowRetake,
        showResult: cfg.showResult,
        completed: !!d,
        completedAt: d ? new Date(d.at).toISOString() : null,
      };
    }).filter((t) => t.status !== 'closed' || t.completed),
  };
});
