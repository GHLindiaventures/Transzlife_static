// Staff sign-in for the admin dashboard. Separate from customer sign-in.
//   - email + password (scrypt), then a 6-digit code from an authenticator app (TOTP)
//   - 5 wrong passwords or codes -> account locked for 15 minutes
//   - new accounts get a temporary password: they must set their own password and turn on
//     2FA before anything else works (enforced on the server, not just in the page)
//   - sessions: httpOnly cookie scoped to /api/admin, SameSite=Strict, 12 hours
import { createHash, randomBytes } from 'node:crypto';
import { isHosted } from '../db/index.js';
import { verifyPassword, verifyTotp } from './crypto.js';

export const ADMIN_COOKIE = 'tl_admin';
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export const ROLES = ['owner', 'manager', 'support'];
// what each role may do; every admin route declares the permission it needs
const PERMS = {
  owner:   ['view', 'orders.edit', 'orders.note', 'products.edit', 'stock.edit', 'refunds', 'customers.edit', 'staff', 'settings'],
  manager: ['view', 'orders.edit', 'orders.note', 'products.edit', 'stock.edit', 'refunds', 'customers.edit'],
  support: ['view', 'orders.note'],
};
export const can = (staff, perm) => !!staff && (PERMS[staff.role] || []).includes(perm);
export const permsOf = (role) => PERMS[role] || [];

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const fail = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

export function createAdminAuth({ db, env }) {
  const hosted = isHosted(env);

  /** Step 1+2 of sign-in. Returns { staff } or { needsCode: true }. Throws on failure. */
  async function login({ email, password, code }, req) {
    const s = (await db.query('SELECT * FROM staff_users WHERE email = $1', [email])).rows[0];
    // same message for unknown email and wrong password, so emails can't be discovered
    const bad = 'Email or password is not right.';
    if (!s || !s.active) { await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(88)).catch(() => {}); throw fail(bad, 401); }
    if (s.locked_until && new Date(s.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(s.locked_until) - Date.now()) / 60000);
      throw fail(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 429);
    }
    const recordFail = async () => {
      const r = (await db.query(
        `UPDATE staff_users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
         WHERE id = $1 RETURNING failed_logins`, [s.id, MAX_FAILS, LOCK_MINUTES])).rows[0];
      if (r.failed_logins >= MAX_FAILS) {
        await db.query('UPDATE staff_users SET failed_logins = 0 WHERE id = $1', [s.id]);
        throw fail(`Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`, 429);
      }
    };
    if (!(await verifyPassword(password, s.password_hash))) { await recordFail(); throw fail(bad, 401); }

    if (s.totp_enabled) {
      if (!code) return { needsCode: true };
      const step = verifyTotp(s.totp_secret, code, s.totp_last_step);
      if (step == null) { await recordFail(); throw fail('That code is not right. Check the time on your phone and try again.', 401, { code: 'bad_code' }); }
      await db.query('UPDATE staff_users SET totp_last_step = $2 WHERE id = $1', [s.id, step]);
    }
    await db.query('UPDATE staff_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [s.id]);
    return { staff: s };
  }

  async function startSession(reply, staffId, req) {
    const token = randomBytes(32).toString('base64url');
    await db.query(
      `INSERT INTO staff_sessions (token_hash, staff_id, user_agent, ip, expires_at)
       VALUES ($1,$2,$3,$4, now() + make_interval(hours => $5))`,
      [sha256(token), staffId, String(req.headers['user-agent'] || '').slice(0, 300), req.ip, SESSION_HOURS]);
    reply.setCookie(ADMIN_COOKIE, token, { path: '/api/admin', httpOnly: true, sameSite: 'strict', secure: hosted, maxAge: SESSION_HOURS * 3600 });
  }

  async function endSession(req, reply) {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (token) await db.query('DELETE FROM staff_sessions WHERE token_hash = $1', [sha256(token)]);
    reply.clearCookie(ADMIN_COOKIE, { path: '/api/admin' });
  }

  /** Ends every session of a staff member (password reset, deactivation). */
  const endAllSessions = (staffId, exceptToken) => exceptToken
    ? db.query('DELETE FROM staff_sessions WHERE staff_id = $1 AND token_hash <> $2', [staffId, sha256(exceptToken)])
    : db.query('DELETE FROM staff_sessions WHERE staff_id = $1', [staffId]);

  async function loadStaff(req) {
    req.staff = null;
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token || token.length > 100) return;
    req.staff = (await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.must_change_password, u.totp_enabled
         FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`, [sha256(token)])).rows[0] || null;
  }

  /**
   * Route guard. `perm` is a permission name; `setup: true` allows the route before the
   * account is fully set up (password changed + 2FA on).
   */
  const guard = (perm, { setup = false } = {}) => async (req, reply) => {
    await loadStaff(req);
    if (!req.staff) return reply.code(401).send({ error: 'Please sign in.', code: 'admin_auth' });
    if (!setup && (req.staff.must_change_password || !req.staff.totp_enabled)) {
      return reply.code(403).send({ error: 'Finish setting up your account first.', code: 'setup_required' });
    }
    if (perm && !can(req.staff, perm)) return reply.code(403).send({ error: 'Your role does not allow this.', code: 'forbidden' });
  };

  return { login, startSession, endSession, endAllSessions, guard };
}
