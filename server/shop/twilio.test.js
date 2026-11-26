// Twilio integration tests with Twilio's API simulated (no real messages).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';
import { hashPassword, totpCode } from '../admin/crypto.js';

const ORIGIN = 'http://localhost:3000';
const quiet = { info() {}, log() {}, warn() {}, error() {} };
const realFetch = globalThis.fetch;

// ---- fake Twilio -----------------------------------------------------------
const calls = [];
let verifyCode = '482913', failNext = null;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.includes('twilio.com')) return realFetch(url, opts);
  const form = Object.fromEntries(new URLSearchParams(opts.body || ''));
  const auth = Buffer.from(String(opts.headers?.Authorization || '').replace('Basic ', ''), 'base64').toString();
  calls.push({ url: u, form, auth });
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
  if (failNext) { const f = failNext; failNext = null; return json({ code: f.code, message: f.message }, f.status); }
  if (u.endsWith('/Verifications')) return json({ sid: 'VE1', status: 'pending', to: form.To });
  if (u.endsWith('/VerificationCheck')) return json({ status: form.Code === verifyCode ? 'approved' : 'pending' });
  if (u.endsWith('/Messages.json')) return json({ sid: `SM${calls.length}`, status: 'queued' });
  if (/\/Accounts\/AC[^/]+\.json$/.test(u)) return json({ status: 'active', type: 'Full', friendly_name: 'TranzLife' });
  if (/\/Services\/VA[^/]+$/.test(u)) return json({ friendly_name: 'TranzLife Sign-in', code_length: 6 });
  return json({ code: 20404, message: 'not found' }, 404);
};

const BASE_ENV = { SESSION_SECRET: 'test-session-secret-0123456789abcdef', TWILIO_ACCOUNT_SID: 'ACtest0000', TWILIO_AUTH_TOKEN: 'tok' };

async function makeApp(extraEnv) {
  const env = { ...BASE_ENV, ...extraEnv };
  const db = await createDb(env, { memory: true, log: quiet });
  const app = await buildShopApp({ env, db, logger: false });
  let cookie = '';
  const call = async (method, url, payload, c) => {
    const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie: c ?? cookie } });
    const set = res.headers['set-cookie'];
    if (set && c === undefined) cookie = [].concat(set).map((x) => x.split(';')[0]).join('; ');
    return { status: res.statusCode, body: res.json() };
  };
  return { app, db, call, getCookie: () => cookie };
}
const settle = () => new Promise((r) => setTimeout(r, 50));
const apps = [];
after(async () => { for (const a of apps) await a.close(); globalThis.fetch = realFetch; });

test('Twilio Verify: code is sent and checked by Twilio; wrong codes count down', async () => {
  const t = await makeApp({ TWILIO_VERIFY_SERVICE_SID: 'VAservice1' }); apps.push(t.app);
  assert.equal(t.app.shop.auth.mode, 'twilio-verify');
  calls.length = 0;
  const r = await t.call('POST', '/api/auth/otp/request', { phone: '9876543210' });
  assert.equal(r.status, 200);
  assert.equal(r.body.devCode, undefined, 'no code is ever returned to the page');
  assert.equal(calls[0].url, 'https://verify.twilio.com/v2/Services/VAservice1/Verifications');
  assert.deepEqual(calls[0].form, { To: '+919876543210', Channel: 'sms' });
  assert.equal(calls[0].auth, 'ACtest0000:tok');

  const bad = await t.call('POST', '/api/auth/otp/verify', { phone: '9876543210', code: '111111' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /4 tries left/);
  const ok = await t.call('POST', '/api/auth/otp/verify', { phone: '9876543210', code: verifyCode });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.customer.phone, '9876543210');
  assert.equal(calls.at(-1).form.Code, verifyCode);
  const again = await t.call('POST', '/api/auth/otp/verify', { phone: '9876543210', code: verifyCode });
  assert.equal(again.status, 400, 'a used code cannot sign in again');
});

test('Twilio errors become clear messages; a failed send does not use up the limits', async () => {
  const t = await makeApp({ TWILIO_VERIFY_SERVICE_SID: 'VAservice1' }); apps.push(t.app);
  failNext = { status: 400, code: 60200, message: 'Invalid parameter: To' };
  const bad = await t.call('POST', '/api/auth/otp/request', { phone: '9123412345' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /mobile number does not look right/);
  const rows = (await t.db.query(`SELECT COUNT(*) AS n FROM otp_codes WHERE phone = '9123412345'`)).rows[0].n;
  assert.equal(Number(rows), 0, 'nothing recorded when Twilio refused');
  const ok = await t.call('POST', '/api/auth/otp/request', { phone: '9123412345' });
  assert.equal(ok.status, 200, 'can retry immediately (no 30s wait after a failed send)');

  failNext = { status: 404, code: 20404, message: 'The requested resource was not found' };
  const expired = await t.call('POST', '/api/auth/otp/verify', { phone: '9123412345', code: '123456' });
  assert.equal(expired.status, 400);
  assert.match(expired.body.error, /expired/);

  failNext = { status: 401, code: 20003, message: 'Authenticate' };
  const down = await t.call('POST', '/api/auth/otp/request', { phone: '9000011111' });
  assert.equal(down.status, 503);
  assert.match(down.body.error, /temporarily unavailable/);
});

test('Twilio SMS (no Verify service): our own code is sent by SMS and checked by us', async () => {
  const t = await makeApp({ TWILIO_PHONE_NUMBER: '+15005550006' }); apps.push(t.app);
  assert.equal(t.app.shop.auth.mode, 'twilio-sms');
  calls.length = 0;
  await t.call('POST', '/api/auth/otp/request', { phone: '9876500001' });
  const sms = calls.find((c) => c.url.endsWith('/Accounts/ACtest0000/Messages.json'));
  assert.equal(sms.form.From, '+15005550006');
  assert.equal(sms.form.To, '+919876500001');
  const code = sms.form.Body.match(/^(\d{6}) is your TranzLife sign-in code/)[1];
  const ok = await t.call('POST', '/api/auth/otp/verify', { phone: '9876500001', code });
  assert.equal(ok.status, 200);
});

test('order updates by SMS: confirmed once, then shipped / delivered from the admin; failures logged', async () => {
  const t = await makeApp({ TWILIO_VERIFY_SERVICE_SID: 'VAservice1', TWILIO_MESSAGING_SERVICE_SID: 'MGsender1', ORDER_NOTIFICATIONS: 'sms', SITE_URL: 'https://shop.example' });
  apps.push(t.app);
  await t.call('POST', '/api/auth/otp/request', { phone: '9811100000' });
  await t.call('POST', '/api/auth/otp/verify', { phone: '9811100000', code: verifyCode });
  await t.call('PATCH', '/api/account', { name: 'Meera Iyer' });
  calls.length = 0;
  const placed = await t.call('POST', '/api/checkout/place', {
    items: [{ id: 'liver-booster', pack: 1, qty: 1 }], paymentMethod: 'cod', idempotencyKey: 'tw-cod-1',
    address: { name: 'Meera Iyer', phone: '9811100000', line1: '3 Beach Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600004' } });
  const n = placed.body.order.number;
  await settle();
  const confirm = calls.filter((c) => c.url.endsWith('/Messages.json'));
  assert.equal(confirm.length, 1);
  assert.equal(confirm[0].form.MessagingServiceSid, 'MGsender1');
  assert.match(confirm[0].form.Body, new RegExp(`Thank you Meera! Your order ${n} for ₹949 is confirmed \\(cash on delivery\\).*https://shop.example/track/TRK-${n}`));

  // staff moves it along
  await t.db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','O','owner',$1,false,true,'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')`, [await hashPassword('Pass-word-123')]);
  const login = await t.app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ') } });
  const admin = [].concat(login.headers['set-cookie']).map((x) => x.split(';')[0]).join('; ');
  for (const [status, note] of [['packed'], ['shipped', 'Courier: DTDC, AWB 123456'], ['delivered']]) {
    await t.call('POST', `/api/admin/orders/${n}/status`, { status, note }, admin);
  }
  await settle();
  const bodies = calls.filter((c) => c.url.endsWith('/Messages.json')).map((c) => c.form.Body);
  assert.equal(bodies.length, 3, 'confirmed + shipped + delivered (no message for "packed")');
  assert.match(bodies[1], /has shipped\. Courier: DTDC, AWB 123456/);
  assert.match(bodies[2], /has been delivered/);

  const detail = await t.call('GET', `/api/admin/orders/${n}`, undefined, admin);
  assert.deepEqual(detail.body.notifications.map((x) => `${x.event}:${x.status}`), ['confirmed:sent', 'shipped:sent', 'delivered:sent']);

  // a failed send is recorded, not thrown
  const second = await t.call('POST', '/api/checkout/place', {
    items: [{ id: 'reviva-roll-on', pack: 1, qty: 1 }], paymentMethod: 'cod', idempotencyKey: 'tw-cod-2',
    address: { name: 'Meera Iyer', phone: '9811100000', line1: '3 Beach Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600004' } });
  assert.equal(second.status, 200);
  failNext = { status: 400, code: 21408, message: 'Permission to send an SMS has not been enabled for the region' };
  await t.call('POST', `/api/admin/orders/${second.body.order.number}/status`, { status: 'cancelled', note: 'test' }, admin);
  await settle();
  const d2 = await t.call('GET', `/api/admin/orders/${second.body.order.number}`, undefined, admin);
  const failed = d2.body.notifications.find((x) => x.event === 'cancelled');
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /\[21408\]/);

  // live status check in Settings
  const integ = await t.call('GET', '/api/admin/integrations', undefined, admin);
  assert.equal(integ.body.twilio.ok, true);
  assert.equal(integ.body.twilio.verifyService.name, 'TranzLife Sign-in');
  assert.equal(integ.body.signInCodes, 'twilio-verify');
  assert.equal(integ.body.orderMessages, 'sms');
});

test('online payment confirmed twice (browser + webhook) sends one message', async () => {
  const t = await makeApp({ TWILIO_PHONE_NUMBER: '+15005550006', ORDER_NOTIFICATIONS: 'sms', RAZORPAY_KEY_ID: 'rzp_test', RAZORPAY_KEY_SECRET: 'x' });
  apps.push(t.app);
  const realF = globalThis.fetch;
  globalThis.fetch = async (url, opts) => String(url).startsWith('https://api.razorpay.com') ? new Response(JSON.stringify({ id: 'order_RZ1', amount: 1, currency: 'INR' })) : realF(url, opts);
  try {
    calls.length = 0;
    await t.call('POST', '/api/auth/otp/request', { phone: '9822200000' });
    const code = calls.find((c) => c.url.endsWith('/Messages.json')).form.Body.slice(0, 6);
    await t.call('POST', '/api/auth/otp/verify', { phone: '9822200000', code });
    await t.call('PATCH', '/api/account', { name: 'Ravi' });
    const placed = await t.call('POST', '/api/checkout/place', {
      items: [{ id: 'liver-booster', pack: 1, qty: 1 }], paymentMethod: 'upi', idempotencyKey: 'tw-upi-1',
      address: { name: 'Ravi', phone: '9822200000', line1: '9 Hill St', city: 'Madurai', state: 'Tamil Nadu', pin: '625001' } });
    calls.length = 0;
    await t.app.shop.orders.markPaid({ providerOrderId: 'order_RZ1', providerPaymentId: 'pay_1', actor: 'customer' });
    await t.app.shop.orders.markPaid({ providerOrderId: 'order_RZ1', providerPaymentId: 'pay_1', actor: 'razorpay' });
    await settle();
    const sms = calls.filter((c) => c.url.endsWith('/Messages.json'));
    assert.equal(sms.length, 1);
    assert.match(sms[0].form.Body, new RegExp(`${placed.body.order.number} for ₹904 is confirmed\\.`));
  } finally { globalThis.fetch = realF; }
});

test('without an SMS provider there is no fallback: sign-in refuses clearly (local and hosted)', async () => {
  const local = await makeApp({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' }); apps.push(local.app);
  assert.equal(local.app.shop.auth.mode, 'none');
  const l = await local.call('POST', '/api/auth/otp/request', { phone: '9876543210' });
  assert.equal(l.status, 503);
  assert.equal(l.body.devCode, undefined);
  assert.equal(Number((await local.db.query('SELECT COUNT(*) AS n FROM otp_codes')).rows[0].n), 0);
  const env = { SESSION_SECRET: 'test-session-secret-0123456789abcdef', RENDER: 'true' };
  const db = await createDb({}, { memory: true, log: quiet });
  const hosted = await buildShopApp({ env, db, logger: false }); apps.push(hosted);
  const r = await hosted.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '9876543210' }, headers: { origin: ORIGIN, host: 'localhost:3000' } });
  assert.equal(r.statusCode, 503);
  assert.match(r.json().error, /not available right now/);
});
