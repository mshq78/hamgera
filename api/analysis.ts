import { allow, endpoint, HttpError, queryString } from './_lib/http.js';
import { db } from './_lib/db.js';
import { audit, requireAdmin } from './_lib/auth.js';
import {
  AnalysisResult, AnswerInput, Method, RULES_VERSION,
  analyzeSession, buildResult, manualFormSpec, rulesAnalyze, validateManualRatings,
} from './_lib/tests/masirnama.analysis.js';

/**
 * Admin-only analysis of مسیرنما sessions (header `x-admin-password`).
 *
 * GET  /api/analysis                     → latest analysis summary per session
 * GET  /api/analysis?sessionId=…         → latest full report (+ number of stored versions); audited as "view"
 * GET  /api/analysis?sessionId=…&form=1 → data for the manual rating form (+ rule-based suggestions)
 * POST /api/analysis { sessionId, method?: "ai" | "rules" | "manual", ratings?, note? }
 *                                        → stores a new analysis version (older results are never deleted)
 * POST /api/analysis { sessionId, audit: "export" } → records that a report was exported
 */

const SESSION_ID = /^[A-Za-z0-9_-]{3,80}$/;

const answersOf = (data: any): AnswerInput[] =>
  (data?.answers ?? []).map((a: any) => ({ questionId: a.questionId, text: a.text, clientMeta: a.clientMeta }));

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'POST');
  requireAdmin(req);
  const sql = await db();

  const sessionRow = async (sessionId: string) => {
    const rows = await sql`SELECT data FROM hamgera_sessions WHERE session_id = ${sessionId} AND test_id = 'masirnama'`;
    if (!rows[0]) throw new HttpError(404, 'session_not_found');
    return rows[0].data;
  };

  if (req.method === 'GET') {
    const sessionId = queryString(req, 'sessionId');
    if (!sessionId) {
      const rows = await sql`
        SELECT DISTINCT ON (session_id) session_id, version, status, created_at,
               result->'composite'->>'score' AS score, result->'composite'->>'levelTitle' AS level, result->>'method' AS method
        FROM hamgera_analyses ORDER BY session_id, id DESC
      `;
      return {
        analyses: rows.map((r) => ({
          sessionId: r.session_id, version: r.version, status: r.status, createdAt: r.created_at,
          score: r.score === null ? null : Number(r.score), level: r.level, method: r.method ?? 'ai',
        })),
      };
    }
    if (!SESSION_ID.test(sessionId)) throw new HttpError(400, 'invalid_session');
    if (queryString(req, 'form') === '1') {
      const data = await sessionRow(sessionId);
      return { ...manualFormSpec(), suggested: rulesAnalyze(answersOf(data)) };
    }
    const rows = await sql`SELECT result FROM hamgera_analyses WHERE session_id = ${sessionId} ORDER BY id DESC LIMIT 1`;
    if (rows.length === 0) throw new HttpError(404, 'no_analysis');
    const count = await sql`SELECT count(*)::int AS n FROM hamgera_analyses WHERE session_id = ${sessionId}`;
    await audit(req, 'view_report', 'masirnama', sessionId);
    return { result: rows[0].result, versions: count[0].n };
  }

  const sessionId = req.body?.sessionId;
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new HttpError(400, 'invalid_session');

  if (req.body?.audit === 'export') {
    await audit(req, 'export_report', 'masirnama', sessionId);
    return { ok: true };
  }

  const method: Method = req.body?.method === 'rules' || req.body?.method === 'manual' ? req.body.method : 'ai';
  if (method === 'ai' && !process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'analysis_not_configured');
  const answers = answersOf(await sessionRow(sessionId));

  let result: AnalysisResult;
  if (method === 'ai') {
    result = await analyzeSession(answers);
  } else {
    const ratings = method === 'rules' ? rulesAnalyze(answers) : validateManualRatings(req.body?.ratings);
    if (!ratings) throw new HttpError(400, 'invalid_ratings');
    const base = buildResult(answers, ratings, {
      model: method === 'rules' ? RULES_VERSION : 'manual',
      createdAt: new Date().toISOString(),
      method,
    });
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : '';
    result = {
      ...base,
      report: note
        ? { summary: note, motivation_sources: '', meaning_source: '', main_barrier: '', growth_path: '', alignment: '', future_connection: '', conversation_topics: [] }
        : null,
    };
  }
  await sql`
    INSERT INTO hamgera_analyses (session_id, version, model, status, result)
    VALUES (${sessionId}, ${result.version}, ${result.model}, ${result.status}, ${JSON.stringify(result)}::jsonb)
  `;
  await audit(req, `run_analysis_${method}`, 'masirnama', sessionId);
  return { result };
});
