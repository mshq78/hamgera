import { allow, endpoint, HttpError } from './_lib/http.js';
import { db } from './_lib/db.js';
import { hashNationalIdSync, signToken, verifyNationalId } from './_lib/auth.js';
import { normalizeIranMobile, normalizeNationalId } from '../shared/validation.js';

/**
 * POST /api/auth  { mobile, nationalId }
 *  - username = mobile number, password = national ID
 *  - only people the admin has registered (/api/users) can log in; there is no self-registration
 *  - the national ID is stored only as a salted scrypt hash
 *  - 5 wrong attempts lock the account for 15 minutes
 * → { token, mobile, firstName, lastName }
 */

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// An unknown number costs the same work as a wrong password, so the two cannot be told apart by timing.
const DUMMY_HASH = hashNationalIdSync('0000000000');

export default endpoint(async (req, res) => {
  allow(req, res, 'POST');

  const mobile = normalizeIranMobile(req.body?.mobile);
  const nid = normalizeNationalId(req.body?.nationalId);
  if (!mobile || !nid) throw new HttpError(400, 'invalid_credentials');

  const sql = await db();
  const rows = await sql`
    SELECT nid_hash, first_name, last_name, failed_attempts, locked_until FROM hamgera_users WHERE phone = ${mobile}
  `;
  if (rows.length === 0) {
    verifyNationalId(nid, DUMMY_HASH);
    throw new HttpError(401, 'invalid_credentials');
  }

  const user = rows[0];
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) throw new HttpError(429, 'locked');

  if (!verifyNationalId(nid, user.nid_hash)) {
    const failed = (user.failed_attempts || 0) + 1;
    if (failed >= MAX_FAILED) {
      await sql`
        UPDATE hamgera_users SET failed_attempts = 0, locked_until = now() + make_interval(mins => ${LOCK_MINUTES})
        WHERE phone = ${mobile}
      `;
      throw new HttpError(429, 'locked');
    }
    await sql`UPDATE hamgera_users SET failed_attempts = ${failed} WHERE phone = ${mobile}`;
    throw new HttpError(401, 'invalid_credentials');
  }

  await sql`UPDATE hamgera_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE phone = ${mobile}`;
  return { token: signToken(mobile), mobile, firstName: user.first_name, lastName: user.last_name };
});
