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
  // ---- ارزیابی واکنش: anonymous event surveys. No identity of any kind is stored with a response. ----
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_rx_events (
      id              TEXT PRIMARY KEY,
      code            TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      event_date      DATE,
      cohort          TEXT,
      location        TEXT,
      segments        JSONB NOT NULL DEFAULT '[]',
      is_active       BOOLEAN NOT NULL DEFAULT true,
      opens_at        TIMESTAMPTZ,
      closes_at       TIMESTAMPTZ,
      survey_version  TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // `kind` picks the questionnaire ('tt' = the 3T reaction form, 'hampayam' = the HamPayam experience form).
  await sql`ALTER TABLE hamgera_rx_events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'tt'`;
  await sql`ALTER TABLE hamgera_rx_events ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'`;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_rx_responses (
      id                TEXT PRIMARY KEY,
      event_id          TEXT NOT NULL,
      segment           TEXT,
      status            TEXT NOT NULL DEFAULT 'submitted',
      started_at        TIMESTAMPTZ NOT NULL,
      submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      duration_seconds  INTEGER NOT NULL,
      client_version    TEXT,
      deleted_at        TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS hamgera_rx_responses_event_idx ON hamgera_rx_responses (event_id, submitted_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_rx_answers (
      id             BIGSERIAL PRIMARY KEY,
      response_id    TEXT NOT NULL,
      question_id    TEXT NOT NULL,
      numeric_value  NUMERIC,
      text_value     TEXT,
      word_index     INTEGER,
      tags           JSONB NOT NULL DEFAULT '[]',
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS hamgera_rx_answers_unique_idx ON hamgera_rx_answers (response_id, question_id, COALESCE(word_index, 0))`;
  await sql`
    CREATE TABLE IF NOT EXISTS hamgera_rx_audit (
      id           BIGSERIAL PRIMARY KEY,
      admin_user   TEXT NOT NULL,
      action       TEXT NOT NULL,
      event_id     TEXT,
      response_id  TEXT,
      before_json  JSONB,
      after_json   JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}
