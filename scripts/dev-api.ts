/**
 * Local API for `npm run dev:full`: runs the real /api handlers on an in-memory (or file-backed) Postgres,
 * so the whole app works without Neon or `vercel dev`.
 *
 *   npm run dev:full         → API on :3001 (data lives in memory) and Vite on :3000 (proxies /api)
 *   DEV_DB_DIR=.data npm …   → keep the data between runs
 *
 * Admin password in this mode: "admin" (override with ADMIN_PASSWORD).
 */
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { setSqlForTests, Sql } from '../api/_lib/db.js';

process.env.ADMIN_PASSWORD ??= 'admin';
process.env.SESSION_SECRET ??= 'dev-only-secret';

// Preview only: DEV_DEMO_SCORING=1 gives تصمیم‌نما a made-up scoring (option a→DAVINCI, b→EINSTEIN, c→LINCOLN,
// d→CHURCHILL; tie-break by position) so its screens can be tried before the real table exists.
// It never applies in production: this file is not deployed.
if (process.env.DEV_DEMO_SCORING === '1') {
  const { HANDLERS } = await import('../api/_lib/tests/index.js');
  const { createTasmimnama } = await import('../api/_lib/tests/tasmimnama.js');
  const { QUESTIONS, TIEBREAK_QUESTION } = await import('../src/tests/tasmimnama/content/questions.js');
  const { CHARACTER_CODES } = await import('../src/tests/tasmimnama/content/characters.codes.js');
  HANDLERS.tasmimnama = createTasmimnama({
    options: Object.fromEntries(QUESTIONS.flatMap((q) => q.options.map((o, i) => [o.id, [CHARACTER_CODES[i]]]))),
    tiebreak: Object.fromEntries(TIEBREAK_QUESTION.options.map((o, i) => [o.id, CHARACTER_CODES[i]])),
  });
  console.warn('⚠️  DEV_DEMO_SCORING: تصمیم‌نما uses a made-up scoring table (preview only).');
}

const pg = new PGlite(process.env.DEV_DB_DIR);
const sql: Sql = async (strings, ...values) => {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return (await pg.query(text, values as any[])).rows as any[];
};
setSqlForTests(sql);

const routes: Record<string, () => Promise<{ default: (req: any, res: any) => Promise<unknown> }>> = {
  auth: () => import('../api/auth.js'),
  users: () => import('../api/users.js'),
  tests: () => import('../api/tests.js'),
  sessions: () => import('../api/sessions.js'),
  analysis: () => import('../api/analysis.js'),
  survey: () => import('../api/survey.js'),
  reaction: () => import('../api/reaction.js'),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const name = url.pathname.replace(/^\/api\//, '');
  const route = routes[name];
  if (!route) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not_found"}');
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString();
  const vercelReq: any = Object.assign(req, {
    query: Object.fromEntries(url.searchParams),
    body: raw && (req.headers['content-type'] ?? '').includes('json') ? JSON.parse(raw) : undefined,
  });
  const vercelRes: any = Object.assign(res, {
    status(code: number) { res.statusCode = code; return vercelRes; },
    json(body: unknown) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); return vercelRes; },
  });
  try {
    await (await route()).default(vercelReq, vercelRes);
  } catch (e) {
    console.error(e);
    if (!res.writableEnded) res.writeHead(500).end('{"error":"server_error"}');
  }
});

const port = Number(process.env.API_PORT ?? 3001);
server.listen(port, () => console.log(`API ready on http://localhost:${port} (admin password: ${process.env.ADMIN_PASSWORD})`));
