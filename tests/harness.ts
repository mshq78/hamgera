import { PGlite } from '@electric-sql/pglite';
import { setSqlForTests, Sql } from '../api/_lib/db.js';

export interface Result {
  name: string;
  passed: boolean;
  message: string;
}

export function createChecker() {
  const results: Result[] = [];
  const check = (name: string, passed: boolean, message = '') => {
    results.push({ name, passed, message: passed ? 'OK' : message || 'FAILED' });
  };
  const equal = (name: string, actual: unknown, expected: unknown) =>
    check(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return { results, check, equal };
}

/** An in-memory Postgres (WASM) standing in for Neon, so the real SQL runs in tests. */
export async function useMemoryDatabase() {
  const pg = new PGlite();
  const sql: Sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    const res = await pg.query(text, values as any[]);
    return res.rows as any[];
  };
  setSqlForTests(sql);
  return sql;
}

export interface FakeResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  writableEnded: boolean;
  setHeader(k: string, v: string): FakeResponse;
  status(n: number): FakeResponse;
  json(b: unknown): FakeResponse;
}

/** Calls a Vercel-style handler with a fake request and returns the status and JSON body. */
export async function call(
  handler: (req: any, res: any) => Promise<unknown>,
  opts: { method?: string; body?: unknown; query?: Record<string, string>; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: any }> {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(n) { this.statusCode = n; return this; },
    json(b) { this.body = b; this.writableEnded = true; return this; },
  };
  const req = { method: opts.method ?? 'GET', body: opts.body, query: opts.query ?? {}, headers: Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])), url: '/test' };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
}
