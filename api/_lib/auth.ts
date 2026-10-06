import { createHash, createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError, VercelRequest } from './http.js';
import { db } from './db.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const digest = (v: string) => createHash('sha256').update(v).digest();

function secret(): string {
  const base = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!base) throw new HttpError(503, 'secret_not_configured');
  return createHash('sha256').update('hamgera:' + base).digest('hex');
}

// ---- participant token: base64url(phone.expiry).signature -------------------------------------

export function signToken(phone: string, now = Date.now()): string {
  const payload = Buffer.from(`${phone}.${now + TOKEN_TTL_MS}`).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Returns the phone number the token was issued for, or null when it is malformed, forged or expired. */
export function verifyToken(token: string, now = Date.now()): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [phone, exp] = Buffer.from(payload, 'base64url').toString().split('.');
  if (!/^09\d{9}$/.test(phone ?? '') || !(Number(exp) > now)) return null;
  return phone;
}

export interface AuthedUser {
  phone: string;
  firstName: string;
  lastName: string;
}

/** Requires `Authorization: Bearer <token>` for a user that still exists on the roster. */
export async function requireUser(req: VercelRequest): Promise<AuthedUser> {
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const phone = token ? verifyToken(token) : null;
  if (!phone) throw new HttpError(401, 'unauthorized');
  const sql = await db();
  const rows = await sql`SELECT first_name, last_name FROM hamgera_users WHERE phone = ${phone}`;
  if (rows.length === 0) throw new HttpError(401, 'unauthorized');
  return { phone, firstName: rows[0].first_name, lastName: rows[0].last_name };
}

// ---- admin: shared password in a request header ----------------------------------------------

export function isAdminRequest(req: VercelRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers['x-admin-password'];
  if (!expected || typeof given !== 'string' || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

export function requireAdmin(req: VercelRequest): void {
  if (!process.env.ADMIN_PASSWORD) throw new HttpError(503, 'admin_password_not_configured');
  if (!isAdminRequest(req)) throw new HttpError(401, 'unauthorized');
}

export async function audit(req: VercelRequest, action: string, testId: string | null, ref: string | null) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : undefined)?.trim() ?? null;
  const sql = await db();
  await sql`INSERT INTO hamgera_audit (action, test_id, ref, ip) VALUES (${action}, ${testId}, ${ref}, ${ip})`;
}

// ---- national ID: salted scrypt, never stored in clear ---------------------------------------

export function hashNationalIdSync(nid: string, saltHex = randomBytes(16).toString('hex')): string {
  return `${saltHex}:${scryptSync(nid, Buffer.from(saltHex, 'hex'), 32).toString('hex')}`;
}

export function hashNationalId(nid: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(nid, salt, 32, (err, key) => (err ? reject(err) : resolve(`${salt.toString('hex')}:${key.toString('hex')}`)))
  );
}

export function verifyNationalId(nid: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(nid, Buffer.from(salt, 'hex'), 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
