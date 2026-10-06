/**
 * Test availability. The server is the only authority: the browser only displays what /api/tests returns,
 * so changing the device clock cannot open a closed test.
 *
 *  closed    – never open (default)
 *  open      – open now, until the admin closes it (times are ignored)
 *  scheduled – opens at `opensAt`, closes at `closesAt` (optional; no end = stays open)
 */
export type TestMode = 'closed' | 'open' | 'scheduled';
export type TestStatus = 'closed' | 'upcoming' | 'open' | 'ended';

export const TEST_MODES: readonly TestMode[] = ['closed', 'open', 'scheduled'];

export interface ScheduleConfig {
  mode: TestMode;
  /** ISO-8601 instants (UTC); the admin UI converts from/to Tehran time. */
  opensAt: string | null;
  closesAt: string | null;
  /** Minutes after `closesAt` during which a participant who started before it may still submit. */
  graceMinutes: number;
}

export const DEFAULT_GRACE_MINUTES = 15;
export const MAX_GRACE_MINUTES = 240;

const ms = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

export function effectiveStatus(cfg: ScheduleConfig, now: number): TestStatus {
  if (cfg.mode === 'closed') return 'closed';
  if (cfg.mode === 'open') return 'open';
  const opens = ms(cfg.opensAt);
  if (opens === null) return 'closed'; // misconfigured schedule never opens by accident
  if (now < opens) return 'upcoming';
  const closes = ms(cfg.closesAt);
  if (closes !== null && now >= closes) return 'ended';
  return 'open';
}

/**
 * May a session be stored right now? Yes while the test is open; after a scheduled end only for someone who
 * started before the end and submits within the grace period.
 */
export function canSubmit(cfg: ScheduleConfig, startedAt: string, now: number): boolean {
  const status = effectiveStatus(cfg, now);
  if (status === 'open') return true;
  if (status !== 'ended') return false;
  const closes = ms(cfg.closesAt);
  const started = ms(startedAt);
  if (closes === null || started === null) return false;
  return started < closes && now < closes + cfg.graceMinutes * 60_000;
}

/** Validates what the admin sends. Returns an error code or null. */
export function validateSchedule(cfg: ScheduleConfig): string | null {
  if (!TEST_MODES.includes(cfg.mode)) return 'invalid_mode';
  if (!Number.isInteger(cfg.graceMinutes) || cfg.graceMinutes < 0 || cfg.graceMinutes > MAX_GRACE_MINUTES) return 'invalid_grace';
  if (cfg.opensAt !== null && ms(cfg.opensAt) === null) return 'invalid_opens_at';
  if (cfg.closesAt !== null && ms(cfg.closesAt) === null) return 'invalid_closes_at';
  if (cfg.mode === 'scheduled') {
    const o = ms(cfg.opensAt);
    const c = ms(cfg.closesAt);
    if (o === null) return 'opens_at_required';
    if (c !== null && c <= o) return 'closes_before_opens';
  }
  return null;
}
