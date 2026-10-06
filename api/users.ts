import { allow, endpoint, HttpError, queryString } from './_lib/http.js';
import { db } from './_lib/db.js';
import { hashNationalId, requireAdmin } from './_lib/auth.js';
import { cleanPersianText, normalizeIranMobile, normalizeNationalId } from '../shared/validation.js';

/**
 * Admin-only roster management (header `x-admin-password`).
 *
 * GET    /api/users                  → { users: [{ mobile, firstName, lastName, createdAt, lastLoginAt, completed: TestId[] }] }
 * POST   /api/users { users: [...] } → add / update (upsert by mobile), max 100 per request
 *          each user: { firstName, lastName, mobile, nationalId }  (an existing mobile gets a new name and national ID)
 *          → { added, updated, errors: [{ index, reason }] }
 * DELETE /api/users?mobile=09…       → remove the account (submitted sessions are kept)
 */

const MAX_BATCH = 100;

export default endpoint(async (req, res) => {
  allow(req, res, 'GET', 'POST', 'DELETE');
  requireAdmin(req);
  const sql = await db();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT u.phone, u.first_name, u.last_name, u.created_at, u.last_login_at,
             COALESCE((SELECT array_agg(DISTINCT s.test_id) FROM hamgera_sessions s WHERE s.phone = u.phone), '{}') AS completed
      FROM hamgera_users u
      ORDER BY u.created_at DESC
      LIMIT 20000
    `;
    return {
      users: rows.map((r) => ({
        mobile: r.phone,
        firstName: r.first_name,
        lastName: r.last_name,
        createdAt: r.created_at,
        lastLoginAt: r.last_login_at,
        completed: r.completed ?? [],
      })),
    };
  }

  if (req.method === 'POST') {
    const input = req.body?.users;
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_BATCH) throw new HttpError(400, 'invalid_batch');

    const errors: { index: number; reason: string }[] = [];
    const seen = new Set<string>();
    const valid: { mobile: string; nid: string; firstName: string; lastName: string }[] = [];
    input.forEach((u: any, index: number) => {
      const mobile = normalizeIranMobile(u?.mobile);
      const nid = normalizeNationalId(u?.nationalId, true);
      const firstName = typeof u?.firstName === 'string' ? cleanPersianText(u.firstName).slice(0, 60) : '';
      const lastName = typeof u?.lastName === 'string' ? cleanPersianText(u.lastName).slice(0, 60) : '';
      if (!firstName || !lastName) return errors.push({ index, reason: 'name' });
      if (!mobile) return errors.push({ index, reason: 'mobile' });
      if (!nid) return errors.push({ index, reason: 'national_id' });
      if (seen.has(mobile)) return errors.push({ index, reason: 'duplicate' });
      seen.add(mobile);
      valid.push({ mobile, nid, firstName, lastName });
    });

    const hashes = await Promise.all(valid.map((v) => hashNationalId(v.nid)));
    let added = 0;
    let updated = 0;
    for (let i = 0; i < valid.length; i++) {
      const { mobile, firstName, lastName } = valid[i];
      const rows = await sql`
        INSERT INTO hamgera_users (phone, nid_hash, first_name, last_name)
        VALUES (${mobile}, ${hashes[i]}, ${firstName}, ${lastName})
        ON CONFLICT (phone) DO UPDATE
          SET nid_hash = EXCLUDED.nid_hash, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
              failed_attempts = 0, locked_until = NULL
        RETURNING (xmax = 0) AS inserted
      `;
      if (rows[0].inserted) added++;
      else updated++;
    }
    return { added, updated, errors };
  }

  const mobile = normalizeIranMobile(queryString(req, 'mobile'));
  if (!mobile) throw new HttpError(400, 'invalid_mobile');
  await sql`DELETE FROM hamgera_users WHERE phone = ${mobile}`;
  return { ok: true };
});
