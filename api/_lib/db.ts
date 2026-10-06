import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';

export type Row = Record<string, any>;
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let client: Sql | null = connectionString ? (neon(connectionString) as unknown as Sql) : null;
let schemaReady: Promise<void> | null = null;

/** Tests swap in a different Postgres client. */
export function setSqlForTests(fn: Sql | null) {
  client = fn;
  schemaReady = null;
}

/** The database client, with the schema created on first use. */
export async function db(): Promise<Sql> {
  if (!client) throw new HttpError(503, 'database_not_configured');
  const sql = client;
  if (!schemaReady) {
    schemaReady = createSchema(sql).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return sql;
}

async function createSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_users (
      phone            TEXT PRIMARY KEY,
      nid_hash         TEXT NOT NULL,
      first_name       TEXT NOT NULL DEFAULT '',
      last_name        TEXT NOT NULL DEFAULT '',
      failed_attempts  INTEGER NOT NULL DEFAULT 0,
      locked_until     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at    TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_tests (
      test_id        TEXT PRIMARY KEY,
      mode           TEXT NOT NULL DEFAULT 'closed',
      opens_at       TIMESTAMPTZ,
      closes_at      TIMESTAMPTZ,
      grace_minutes  INTEGER NOT NULL DEFAULT 15,
      allow_retake   BOOLEAN NOT NULL DEFAULT false,
      show_result    BOOLEAN,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_sessions (
      session_id  TEXT PRIMARY KEY,
      test_id     TEXT NOT NULL,
      phone       TEXT NOT NULL,
      started_at  TIMESTAMPTZ,
      data        JSONB NOT NULL,
      result      JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS hamgera_sessions_test_phone_idx ON hamgera_sessions (test_id, phone, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_analyses (
      id          BIGSERIAL PRIMARY KEY,
      session_id  TEXT NOT NULL,
      version     TEXT NOT NULL,
      model       TEXT NOT NULL,
      status      TEXT NOT NULL,
      result      JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS hamgera_analyses_session_idx ON hamgera_analyses (session_id, id DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_audit (
      id          BIGSERIAL PRIMARY KEY,
      action      TEXT NOT NULL,
      test_id     TEXT,
      ref         TEXT,
      ip          TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}
