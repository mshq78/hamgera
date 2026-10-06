import { effectiveStatus, canSubmit, validateSchedule, ScheduleConfig } from '../shared/schedule.js';
import { normalizeIranMobile, normalizeNationalId } from '../shared/validation.js';
import { signToken, verifyToken } from '../api/_lib/auth.js';
import { createChecker } from './harness.js';

export async function runUnit() {
  const { results, check, equal } = createChecker();
  process.env.ADMIN_PASSWORD = 'test-admin';

  // ---- schedule ------------------------------------------------------------------------------
  const T = (s: string) => Date.parse(s);
  const cfg = (o: Partial<ScheduleConfig> = {}): ScheduleConfig => ({
    mode: 'scheduled', opensAt: '2026-10-10T08:00:00Z', closesAt: '2026-10-10T10:00:00Z', graceMinutes: 15, ...o,
  });
  equal('closed stays closed', effectiveStatus(cfg({ mode: 'closed' }), T('2026-10-10T09:00:00Z')), 'closed');
  equal('open ignores times', effectiveStatus(cfg({ mode: 'open' }), T('2030-01-01T00:00:00Z')), 'open');
  equal('before opening → upcoming', effectiveStatus(cfg(), T('2026-10-10T07:59:59Z')), 'upcoming');
  equal('opens exactly at opensAt', effectiveStatus(cfg(), T('2026-10-10T08:00:00Z')), 'open');
  equal('closes exactly at closesAt', effectiveStatus(cfg(), T('2026-10-10T10:00:00Z')), 'ended');
  equal('no end time → stays open', effectiveStatus(cfg({ closesAt: null }), T('2031-01-01T00:00:00Z')), 'open');
  equal('scheduled without a start never opens', effectiveStatus(cfg({ opensAt: null }), T('2026-10-10T09:00:00Z')), 'closed');

  check('submit while open', canSubmit(cfg(), '2026-10-10T08:30:00Z', T('2026-10-10T09:00:00Z')));
  check('no submit before opening', !canSubmit(cfg(), '2026-10-10T07:00:00Z', T('2026-10-10T07:30:00Z')));
  check('grace: started before the end, within grace', canSubmit(cfg(), '2026-10-10T09:50:00Z', T('2026-10-10T10:10:00Z')));
  check('grace expired', !canSubmit(cfg(), '2026-10-10T09:50:00Z', T('2026-10-10T10:16:00Z')));
  check('grace does not cover starting after the end', !canSubmit(cfg(), '2026-10-10T10:05:00Z', T('2026-10-10T10:06:00Z')));
  check('manually closed: no grace', !canSubmit(cfg({ mode: 'closed' }), '2026-10-10T09:50:00Z', T('2026-10-10T09:51:00Z')));

  equal('valid schedule', validateSchedule(cfg()), null);
  equal('end before start', validateSchedule(cfg({ closesAt: '2026-10-10T07:00:00Z' })), 'closes_before_opens');
  equal('scheduled needs a start', validateSchedule(cfg({ opensAt: null })), 'opens_at_required');
  equal('bad mode', validateSchedule(cfg({ mode: 'x' as any })), 'invalid_mode');
  equal('bad grace', validateSchedule(cfg({ graceMinutes: -1 })), 'invalid_grace');
  equal('closed needs no times', validateSchedule({ mode: 'closed', opensAt: null, closesAt: null, graceMinutes: 0 }), null);

  // ---- validation ----------------------------------------------------------------------------
  equal('mobile: Persian digits', normalizeIranMobile('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  equal('mobile: +98', normalizeIranMobile('+989123456789'), '09123456789');
  equal('mobile: without zero', normalizeIranMobile('9123456789'), '09123456789');
  equal('mobile: invalid', normalizeIranMobile('0812345678'), null);
  equal('national id: valid', normalizeNationalId('0012345679'), '0012345679');
  equal('national id: bad check digit', normalizeNationalId('0012345678'), null);
  equal('national id: repeated digits', normalizeNationalId('1111111111'), null);
  equal('national id: Excel dropped zeros', normalizeNationalId('12345679', true), '0012345679');
  equal('national id: not padded by default', normalizeNationalId('12345679'), null);

  // ---- participant token ---------------------------------------------------------------------
  const token = signToken('09123456789', 1_000_000);
  equal('token verifies', verifyToken(token, 1_000_001), '09123456789');
  check('token expires', verifyToken(token, 1_000_000 + 31 * 24 * 3600 * 1000) === null);
  const [payload, sig] = token.split('.');
  const forged = Buffer.from('09999999999.' + String(9e15)).toString('base64url') + '.' + sig;
  check('forged payload rejected', verifyToken(forged, 1_000_001) === null);
  check('garbage rejected', verifyToken('abc', 1) === null && verifyToken('', 1) === null && verifyToken(payload, 1) === null);

  return results;
}
