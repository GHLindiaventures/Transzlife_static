// Customer sign-in with a one-time code sent to their mobile by SMS (no passwords).
//   - delivery, first one configured wins:
//       1. Twilio Verify (TWILIO_VERIFY_SERVICE_SID): Twilio generates, sends and checks the code
//       2. Twilio SMS (TWILIO_MESSAGING_SERVICE_SID / TWILIO_PHONE_NUMBER): we generate a random
//          code (crypto.randomInt), send it by SMS, and keep only its HMAC
//       3. MSG91 (MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID)
//     With none of them configured, sign-in is refused. There is no test mode: a code is never
//     shown on screen, returned to the browser, or written to the logs.
//   - codes: 6 digits, valid 5 minutes, max 5 wrong tries; resend after 30 s; max 5 per hour per number
//   - sessions: a random token in an httpOnly cookie; the database keeps only its SHA-256
//   - new numbers get an account on first sign-in (they add their name right after)
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { isHosted } from '../db/index.js';

export const SESSION_COOKIE = 'tl_session';
const SESSION_DAYS = 30;
const OTP_MINUTES = 5;
const OTP_MAX_TRIES = 5;
const RESEND_SECONDS = 30;
const MAX_CODES_PER_HOUR = 5;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const VERIFY_MARK = 'twilio-verify';    // otp_codes row whose code lives at Twilio

export function createAuth({ db, env, log, twilio }) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters.');
  const hosted = isHosted(env);
  const otpHash = (phone, code) => createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');

  // ---- SMS ---------------------------------------------------------------
  const msg91Ready = !!(env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID);
  const mode = twilio?.verifyReady ? 'twilio-verify' : twilio?.smsReady ? 'twilio-sms' : msg91Ready ? 'msg91' : 'none';
  if (mode === 'none') log.error?.('[auth] no SMS provider configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID): customers cannot sign in');
  else log.info?.(`[auth] sign-in codes via ${mode}`);

  async function sendCode(phone, code) {
    if (mode === 'twilio-verify') return twilio.startVerification(phone);
    if (mode === 'twilio-sms') {
      return twilio.sendSms(phone, `${code} is your TranzLife sign-in code. It expires in ${OTP_MINUTES} minutes. Do not share it with anyone.`);
    }
    if (mode === 'msg91') {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.set('template_id', env.MSG91_OTP_TEMPLATE_ID);
      url.searchParams.set('mobile', `91${phone}`);
      url.searchParams.set('otp', code);
      url.searchParams.set('otp_expiry', String(OTP_MINUTES));
      const r = await fetch(url, { method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || body.type === 'error') {
        log.error?.(`[auth] MSG91 ${r.status}: ${body.message || ''}`);
        throw Object.assign(new Error("We couldn't send the code right now. Please try again in a minute."), { status: 503 });
      }
      return body;
    }
    throw Object.assign(new Error('Sign-in by SMS is not available right now. Please try again later or message us on WhatsApp.'), { status: 503 });
  }

  // ---- one-time codes ----------------------------------------------------
  // SMS pumping: bots request codes for many different numbers so someone earns from each SMS we
  // pay for. The per-number limit does not stop that, so there are also hourly caps per IP and for
  // the whole site (a real shop sends far fewer codes than this; raise OTP_GLOBAL_PER_HOUR if not).
  const num = (v, d) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
  const perIpHour = num(env.OTP_PER_IP_PER_HOUR, 10);
  const globalHour = num(env.OTP_GLOBAL_PER_HOUR, 150);
  let warnedAt = 0;

  async function requestCode(phone, ip) {
    const { rows: [counts] } = await db.query(
      `SELECT count(*)::int AS site, count(*) FILTER (WHERE ip = $1)::int AS mine
         FROM otp_codes WHERE created_at > now() - interval '1 hour'`, [ip || '']);
    if (counts.mine >= perIpHour) throw Object.assign(new Error('Too many sign-in codes have been requested from your network. Please try again in an hour.'), { status: 429 });
    if (counts.site >= globalHour) {
      if (Date.now() - warnedAt > 10 * 60_000) {
        warnedAt = Date.now();
        log.error?.(`[auth] site-wide sign-in code limit reached (${globalHour}/hour, OTP_GLOBAL_PER_HOUR): possible SMS pumping, check the SMS provider logs`);
      }
      throw Object.assign(new Error('Sign-in is very busy right now. Please try again in a little while or message us on WhatsApp.'), { status: 429 });
    }
    const recent = (await db.query(
      `SELECT created_at FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour' ORDER BY created_at DESC`, [phone])).rows;
    if (recent.length >= MAX_CODES_PER_HOUR) throw Object.assign(new Error('Too many codes requested for this number. Please try again in an hour.'), { status: 429 });
    if (recent[0]) {
      const wait = RESEND_SECONDS - Math.floor((Date.now() - new Date(recent[0].created_at).getTime()) / 1000);
      if (wait > 0) throw Object.assign(new Error(`Please wait ${wait}s before requesting a new code.`), { status: 429, retryAfter: wait });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // send first: if sending fails, the earlier code stays valid and nothing counts against the limits
    await sendCode(phone, code);
    // a new code replaces any earlier unused one
    await db.query(`UPDATE otp_codes SET used_at = now() WHERE phone = $1 AND used_at IS NULL`, [phone]);
    await db.query(`INSERT INTO otp_codes (phone, code_hash, expires_at, ip) VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [phone, mode === 'twilio-verify' ? VERIFY_MARK : otpHash(phone, code), OTP_MINUTES, ip]);
    return { resendIn: RESEND_SECONDS, expiresIn: OTP_MINUTES * 60 };
  }

  async function verifyCode(phone, code) {
    const fail = (msg) => Object.assign(new Error(msg), { status: 400 });
    const row = (await db.query(
      `SELECT id, code_hash, attempts, expires_at FROM otp_codes
        WHERE phone = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`, [phone])).rows[0];
    if (!row || new Date(row.expires_at) < new Date()) throw fail('This code has expired. Please request a new one.');
    if (row.attempts >= OTP_MAX_TRIES) throw fail('Too many wrong tries. Please request a new code.');

    let right;
    if (row.code_hash === VERIFY_MARK) {
      if (!twilio?.verifyReady) throw fail('This code has expired. Please request a new one.');
      right = await twilio.checkVerification(phone, code);       // Twilio holds the code
    } else {
      const a = Buffer.from(row.code_hash, 'hex'), b = Buffer.from(otpHash(phone, code), 'hex');
      right = a.length === b.length && timingSafeEqual(a, b);
    }
    if (!right) {
      await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      const left = OTP_MAX_TRIES - row.attempts - 1;
      throw fail(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please request a new code.');
    }
    return db.tx(async (t) => {
      // only one request can use a code, even if two arrive at once
      const used = await t.query('UPDATE otp_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL', [row.id]);
      if (!(used.affectedRows ?? used.rowCount)) throw fail('This code has already been used. Please request a new one.');
      return (await t.query(
        `INSERT INTO customers (phone, last_login_at) VALUES ($1, now())
         ON CONFLICT (phone) DO UPDATE SET last_login_at = now()
         RETURNING id, phone, name, email, (xmax = 0) AS is_new`, [phone])).rows[0];
    });
  }

  // ---- sessions ----------------------------------------------------------
  const cookieOptions = () => ({
    path: '/', httpOnly: true, sameSite: 'lax', secure: hosted, maxAge: SESSION_DAYS * 86400,
  });

  async function startSession(reply, customerId, req) {
    const token = randomBytes(32).toString('base64url');
    await db.query(
      `INSERT INTO sessions (token_hash, customer_id, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
      [sha256(token), customerId, String(req.headers['user-agent'] || '').slice(0, 300), req.ip, SESSION_DAYS]);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions());
  }

  async function endSession(req, reply) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Fastify preHandler: sets req.customer (or null). */
  async function loadCustomer(req) {
    req.customer = null;
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || token.length > 100) return;
    const row = (await db.query(
      `SELECT s.id AS session_id, s.last_seen_at, c.id, c.phone, c.name, c.email, c.marketing_consent
         FROM sessions s JOIN customers c ON c.id = s.customer_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)])).rows[0];
    if (!row) return;
    const { session_id, last_seen_at, ...customer } = row;
    req.customer = customer;
    req.sessionId = session_id;          // "this device" in Manage devices
    // touch at most every 10 minutes
    if (Date.now() - new Date(last_seen_at).getTime() > 600_000) {
      db.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [session_id]).catch(() => {});
    }
  }

  async function requireCustomer(req, reply) {
    if (!req.customer) return reply.code(401).send({ error: 'Please sign in to continue.', code: 'auth_required' });
  }

  return { requestCode, verifyCode, startSession, endSession, loadCustomer, requireCustomer, mode };
}
