// Staff passwords (scrypt) and authenticator-app codes (TOTP, RFC 6238), using Node's crypto only.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(key, expected);
}

/** Readable temporary password, e.g. "tl-7kq2-m9xp-4hcz". */
export function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = () => Array.from(randomBytes(4), (b) => abc[b % abc.length]).join('');
  return `tl-${part()}-${part()}-${part()}`;
}

export function checkPasswordStrength(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Use at least 10 characters.';
  if (pw.length > 128) return 'Use at most 128 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.';
  return null;
}

// ---- TOTP (Google Authenticator, Microsoft Authenticator, Authy …) -----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const code = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export const totpStep = (now = Date.now()) => Math.floor(now / 30000);
export const totpCode = (secret, step = totpStep()) => hotp(secret, step);

/**
 * Checks a 6-digit code, allowing one 30-second step of clock drift either way.
 * Returns the matching step (store it to block reuse) or null.
 */
export function verifyTotp(secret, code, lastStep = null, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const step = totpStep(now);
  for (const s of [step, step - 1, step + 1]) {
    if (lastStep != null && s <= Number(lastStep)) continue;
    const a = Buffer.from(hotp(secret, s)), b = Buffer.from(String(code));
    if (timingSafeEqual(a, b)) return s;
  }
  return null;
}

export const totpUri = (secret, email, issuer = 'TranzLife Admin') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
