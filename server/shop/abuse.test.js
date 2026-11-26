// Abuse limits: real client IP behind a proxy, sign-in code caps (SMS pumping), chat rate limits.
//   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';
import { installTestTwilio, TEST_TWILIO_ENV } from './test-twilio.js';
import { createClientIp, createWindowLimiter } from '../client-ip.js';
import { createChatApi } from '../chat-api.js';
import { PassThrough } from 'node:stream';

const ORIGIN = 'http://localhost:3000';
const env = { ...TEST_TWILIO_ENV, OTP_PER_IP_PER_HOUR: '2', OTP_GLOBAL_PER_HOUR: '4' };
let app, db;
const sms = installTestTwilio();

let n = 0;
const nextPhone = () => `98000000${String(++n).padStart(2, '0')}`;
const otp = (phone, { from = '10.9.0.1', xff } = {}) => app.inject({
  method: 'POST', url: '/api/auth/otp/request', payload: { phone },
  headers: { origin: ORIGIN, host: 'localhost:3000', ...(xff ? { 'x-forwarded-for': xff } : {}) },
  remoteAddress: from,
}).then((r) => ({ status: r.statusCode, body: r.json() }));

before(async () => {
  db = await createDb(env, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env, db, logger: false });
});
after(async () => { await app.close(); sms.restore(); });

// ---- client IP -------------------------------------------------------------
const fakeReq = (xff, socket = '10.0.0.5', extra = {}) =>
  ({ headers: { ...(xff != null ? { 'x-forwarded-for': xff } : {}), ...extra }, socket: { remoteAddress: socket } });

test('client IP: only the entry our proxy added is trusted, not what the visitor sent', () => {
  const apply = createClientIp({});                       // default: one proxy (Render)
  const req = fakeReq('6.6.6.6, 7.7.7.7, 203.0.113.9');   // visitor-made entries first, the proxy's last
  assert.equal(apply(req), '203.0.113.9');
  assert.equal(req.clientIp, '203.0.113.9');
  assert.equal(req.headers['x-forwarded-for'], '203.0.113.9');   // Fastify sees just that address
  assert.equal(apply(fakeReq(null, '::ffff:192.0.2.1')), '192.0.2.1');  // no proxy header: the socket
});

test('client IP: hop count and edge header are configurable', () => {
  assert.equal(createClientIp({ TRUST_PROXY_HOPS: '2' })(fakeReq('6.6.6.6, 198.51.100.7, 10.1.1.1')), '198.51.100.7');
  assert.equal(createClientIp({ TRUST_PROXY_HOPS: '0' })(fakeReq('6.6.6.6')), '10.0.0.5');
  assert.equal(createClientIp({ CLIENT_IP_HEADER: 'cf-connecting-ip' })(fakeReq('6.6.6.6', '10.0.0.5', { 'cf-connecting-ip': '198.51.100.8' })), '198.51.100.8');
});

test('window limiter counts per key and resets after the window', () => {
  const hit = createWindowLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(hit('a', 0).ok, true);
  assert.equal(hit('a', 10).ok, true);
  assert.equal(hit('a', 20).ok, false);
  assert.equal(hit('b', 20).ok, true);
  assert.equal(hit('a', 1001).ok, true);
});

// ---- sign-in codes ---------------------------------------------------------
test('sign-in codes: per-IP cap holds even when the visitor makes up X-Forwarded-For entries', async () => {
  // Fastify trusts one hop: the visitor's own "x-forwarded-for: <random>, <real>" must not reset the count
  const a = await otp(nextPhone(), { from: '10.0.0.1', xff: '1.1.1.1, 10.9.1.1' });
  const b = await otp(nextPhone(), { from: '10.0.0.1', xff: '2.2.2.2, 10.9.1.1' });
  const c = await otp(nextPhone(), { from: '10.0.0.1', xff: '3.3.3.3, 10.9.1.1' });
  assert.deepEqual([a.status, b.status, c.status], [200, 200, 429]);
  assert.match(c.body.error, /your network/);
});

test('sign-in codes: site-wide hourly cap stops SMS pumping across many IPs', async () => {
  // 2 codes went out in the test above; 2 more from new addresses reach the cap of 4
  assert.equal((await otp(nextPhone(), { from: '10.9.2.1' })).status, 200);
  assert.equal((await otp(nextPhone(), { from: '10.9.2.2' })).status, 200);
  const r = await otp(nextPhone(), { from: '10.9.2.3' });
  assert.equal(r.status, 429);
  assert.match(r.body.error, /very busy/);
});

// ---- chat ------------------------------------------------------------------
test('chat: per-visitor limit answers 429 before any model is called', async () => {
  const chat = createChatApi({ CHAT_PER_IP_10MIN: '1', CHAT_GLOBAL_PER_HOUR: '100', OLLAMA_URL: 'http://127.0.0.1:9' });
  const send = (ip) => new Promise((resolve) => {
    const req = Object.assign(new PassThrough(), { method: 'POST', url: '/api/chat', headers: {}, clientIp: ip, socket: {} });
    const res = { headers: {}, setHeader() {}, on() {}, writableEnded: false,
      writeHead(status, h) { this.status = status; Object.assign(this.headers, h); },
      end(body) { this.writableEnded = true; resolve({ status: this.status, body: String(body || '') }); } };
    chat.handle(req, res);
    req.end(JSON.stringify({ messages: [] }));           // empty history: 400 if it reaches the handler
  });
  assert.equal((await send('198.51.100.1')).status, 400);  // first one gets through the limiter
  const second = await send('198.51.100.1');
  assert.equal(second.status, 429);
  assert.match(JSON.parse(second.body).error, /wait a few minutes/);
  assert.equal((await send('198.51.100.2')).status, 400);  // another visitor is unaffected
});

// ---- manage devices ----------------------------------------------------------
test('manage devices: lists signed-in devices, signs out another, keeps this one', async () => {
  const phone = '9811112222';
  const signIn = async (ua, from) => {
    await otp(phone, { from });
    const code = sms.codeFor(phone);
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code },
      headers: { origin: ORIGIN, host: 'localhost:3000', 'user-agent': ua }, remoteAddress: from });
    assert.equal(r.statusCode, 200);
    return [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  };
  await db.query('DELETE FROM otp_codes');      // the caps above were reached on purpose; start fresh
  const phoneCookie = await signIn('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', '10.7.0.1');
  await db.query(`UPDATE otp_codes SET created_at = now() - interval '2 minutes'`);   // past the 30 s resend wait
  const laptopCookie = await signIn('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36', '10.7.0.2');
  const as = (cookie, method, url) => app.inject({ method, url, payload: method === 'GET' ? undefined : {},
    headers: { origin: ORIGIN, host: 'localhost:3000', cookie } }).then((r) => ({ status: r.statusCode, body: r.json() }));

  const list = await as(laptopCookie, 'GET', '/api/account/devices');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.devices.map((d) => [d.device, d.current]).sort(), [['Chrome on Android', false], ['Chrome on Windows', true]]);
  const other = list.body.devices.find((d) => !d.current);
  const self = list.body.devices.find((d) => d.current);
  assert.equal((await as(laptopCookie, 'DELETE', `/api/account/devices/${self.id}`)).status, 400);   // use Log out for this one
  assert.equal((await as(laptopCookie, 'DELETE', `/api/account/devices/${other.id}`)).status, 200);
  assert.equal((await as(phoneCookie, 'GET', '/api/account/devices')).status, 401);                // the phone is signed out
  assert.equal((await as(laptopCookie, 'POST', '/api/account/devices/sign-out-others')).body.signedOut, 0);
  assert.equal((await as(laptopCookie, 'GET', '/api/account/devices')).body.devices.length, 1);
});

// ---- saved addresses (account page "Add a new address", checkout "Save this address") ----------
test('addresses: add, no duplicates, make default, validation, owner only', async () => {
  await db.query('DELETE FROM otp_codes');
  const phone = '9822223333';
  await otp(phone, { from: '10.8.0.1' });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: sms.codeFor(phone) },
    headers: { origin: ORIGIN, host: 'localhost:3000' }, remoteAddress: '10.8.0.1' });
  const cookie = [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  const as = (method, url, payload) => app.inject({ method, url, payload: method === 'GET' ? undefined : (payload || {}),
    headers: { origin: ORIGIN, host: 'localhost:3000', cookie } }).then((x) => ({ status: x.statusCode, body: x.json() }));

  const home = { name: 'Priya Raman', phone: '9822223333', line1: '12 Lake View Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600028' };
  const a1 = await as('POST', '/api/account/addresses', home);
  assert.equal(a1.status, 200);
  assert.equal(a1.body.address.isDefault, true, 'the first address becomes the default');
  assert.equal((await as('POST', '/api/account/addresses', home)).body.address.id, a1.body.address.id, 'same address is not saved twice');
  const a2 = await as('POST', '/api/account/addresses', { ...home, line1: '4 Office Park', pin: '600041', makeDefault: true });
  assert.equal(a2.body.address.isDefault, true);
  let list = (await as('GET', '/api/account/addresses')).body.addresses;
  assert.deepEqual(list.map((a) => [a.line1, a.isDefault]), [['4 Office Park', true], ['12 Lake View Road', false]]);
  assert.equal((await as('POST', `/api/account/addresses/${a1.body.address.id}/default`)).status, 200);
  list = (await as('GET', '/api/account/addresses')).body.addresses;
  assert.equal(list[0].id, a1.body.address.id);
  assert.equal((await as('POST', '/api/account/addresses', { ...home, pin: '12345' })).status, 400, 'bad PIN rejected');
  assert.equal((await as('POST', '/api/account/addresses/00000000-0000-0000-0000-000000000000/default')).status, 404);
  const anon = await app.inject({ method: 'POST', url: '/api/account/addresses', payload: home, headers: { origin: ORIGIN, host: 'localhost:3000' } });
  assert.equal(anon.statusCode, 401);
});
