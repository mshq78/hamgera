import { TEST_IDS, TESTS_META, TestId } from '../../shared/tests.js';
import { DEFAULT_GRACE_MINUTES, ScheduleConfig, TestMode } from '../../shared/schedule.js';
import { db, Row } from './db.js';

export interface TestConfig extends ScheduleConfig {
  testId: TestId;
  allowRetake: boolean;
  showResult: boolean;
}

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

export function defaultConfig(testId: TestId): TestConfig {
  return {
    testId,
    mode: 'closed',
    opensAt: null,
    closesAt: null,
    graceMinutes: DEFAULT_GRACE_MINUTES,
    allowRetake: false,
    showResult: TESTS_META[testId].showResultDefault,
  };
}

function fromRow(testId: TestId, row: Row | undefined): TestConfig {
  const base = defaultConfig(testId);
  if (!row) return base;
  return {
    testId,
    mode: row.mode as TestMode,
    opensAt: iso(row.opens_at),
    closesAt: iso(row.closes_at),
    graceMinutes: row.grace_minutes ?? base.graceMinutes,
    allowRetake: !!row.allow_retake,
    showResult: row.show_result ?? base.showResult,
  };
}

export async function loadConfig(testId: TestId): Promise<TestConfig> {
  const sql = await db();
  const rows = await sql`SELECT * FROM hamgera_tests WHERE test_id = ${testId}`;
  return fromRow(testId, rows[0]);
}

export async function loadAllConfigs(): Promise<Record<TestId, TestConfig>> {
  const sql = await db();
  const rows = await sql`SELECT * FROM hamgera_tests`;
  return Object.fromEntries(
    TEST_IDS.map((id) => [id, fromRow(id, rows.find((r) => r.test_id === id))])
  ) as Record<TestId, TestConfig>;
}

export async function saveConfig(cfg: TestConfig): Promise<void> {
  const sql = await db();
  await sql`
    INSERT INTO hamgera_tests (test_id, mode, opens_at, closes_at, grace_minutes, allow_retake, show_result, updated_at)
    VALUES (${cfg.testId}, ${cfg.mode}, ${cfg.opensAt}, ${cfg.closesAt}, ${cfg.graceMinutes}, ${cfg.allowRetake}, ${cfg.showResult}, now())
    ON CONFLICT (test_id) DO UPDATE SET
      mode = EXCLUDED.mode, opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at,
      grace_minutes = EXCLUDED.grace_minutes, allow_retake = EXCLUDED.allow_retake,
      show_result = EXCLUDED.show_result, updated_at = now()
  `;
}
