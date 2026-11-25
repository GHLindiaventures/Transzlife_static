// End-to-end tests for the shop API on an in-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';
import { installTestTwilio, TEST_TWILIO_ENV } from './test-twilio.js';

const ORIGIN = 'http://localhost:3000';
const env = { ...TEST_TWILIO_ENV, RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'rzp_secret', RAZORPAY_WEBHOOK_SECRET: 'wh_secret' };
let app, db, cookie = '';

// Razorpay's order API is faked; everything else is real
const realFetch = globalThis.fetch;
let rpCounter = 0;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.razorpay.com/v1/orders')) {
    const body = JSON.parse(opts.body);
    return new Response(JSON.stringify({ id: `order_TEST${++rpCounter}`, amount: body.amount, currency: 'INR' }), { status: 200 });
  }
  return realFetch(url, opts);
};

const call = async (method, url, payload, headers = {}) => {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, ...headers } });
  const set = res.headers['set-cookie'];
  if (set) cookie = [].concat(set).map((c) => c.split(';')[0]).join('; ');
  return { status: res.statusCode, body: res.json() };
};

const ITEM = { id: 'liver-booster', pack: 1, qty: 2 };
const ADDRESS = { name: 'Test Customer', phone: '9876543210', line1: '12 Gandhi Street', line2: '', city: 'Chennai', state: 'Tamil Nadu', pin: '600008' };

before(async () => {
  db = await createDb(env, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env, db, logger: false });
});
const sms = installTestTwilio();
after(async () => { await app.close(); sms.restore(); globalThis.fetch = realFetch; });

test('signed-out visitors cannot place orders', async () => {
  const r = await call('POST', '/api/checkout/place', { items: [ITEM], paymentMethod: 'cod', address: ADDRESS, idempotencyKey: 'k-000001' });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'auth_required');
});

test('cross-site POSTs are blocked', async () => {
  const r = await call('POST', '/api/auth/otp/request', { phone: '9876543210' }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('invalid phone numbers are rejected', async () => {
  const r = await call('POST', '/api/auth/otp/request', { phone: '12345' });
  assert.equal(r.status, 400);
});

test('OTP sign-in: wrong code counts down, right code signs in and creates the account', async () => {
  const req = await call('POST', '/api/auth/otp/request', { phone: '9876543210' });
  assert.equal(req.status, 200);
  assert.equal(req.body.devCode, undefined, 'the code is never sent to the browser');
  const code = sms.codeFor('9876543210');
  assert.match(code, /^\d{6}$/);
  assert.equal(sms.sent.at(-1).From, '+15005550006');
  const again = await call('POST', '/api/auth/otp/request', { phone: '9876543210' });
  assert.equal(again.status, 429, 'resend is throttled');

  const wrong = code === '000000' ? '111111' : '000000';
  const bad = await call('POST', '/api/auth/otp/verify', { phone: '9876543210', code: wrong });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /4 tries left/);

  const ok = await call('POST', '/api/auth/otp/verify', { phone: '9876543210', code });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.isNew, true);
  assert.ok(cookie.includes('tl_session='));

  const reuse = await call('POST', '/api/auth/otp/verify', { phone: '9876543210', code });
  assert.equal(reuse.status, 400, 'a code works only once');

  const me = await call('GET', '/api/auth/me');
  assert.equal(me.body.customer.phone, '9876543210');
  const named = await call('PATCH', '/api/account', { name: 'Test Customer', email: 'test@example.com' });
  assert.equal(named.body.customer.name, 'Test Customer');
});

test('quote is calculated on the server (packs, prepaid discount, shipping)', async () => {
  const r = await call('POST', '/api/checkout/quote', { items: [ITEM, { id: 'liver-booster', pack: 3, qty: 1 }], paymentMethod: 'upi' });
  assert.equal(r.status, 200);
  const p = (await db.query(`SELECT price FROM products WHERE id = 'liver-booster'`)).rows[0].price / 100;
  const subtotal = (p * 2 + Math.round(p * 3 * 0.9)) * 100;
  assert.equal(r.body.subtotal, subtotal);
  assert.equal(r.body.discount, Math.round(subtotal / 100 * 0.05) * 100);
  assert.equal(r.body.total, r.body.subtotal - r.body.discount + r.body.shipping);
});

test('COD order: confirmed, stock deducted, double submit returns the same order', async () => {
  const before = (await db.query(`SELECT on_hand, reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0];
  const body = { items: [ITEM], paymentMethod: 'cod', address: ADDRESS, idempotencyKey: 'cod-key-1' };
  const r = await call('POST', '/api/checkout/place', body);
  assert.equal(r.status, 200);
  assert.equal(r.body.order.status, 'confirmed');
  assert.equal(r.body.payment, null);
  const twice = await call('POST', '/api/checkout/place', body);
  assert.equal(twice.body.order.number, r.body.order.number);
  const afterInv = (await db.query(`SELECT on_hand, reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0];
  assert.equal(afterInv.on_hand, before.on_hand - 2);
  assert.equal(afterInv.reserved, before.reserved);
  const addr = await call('GET', '/api/account/addresses');
  assert.equal(addr.body.addresses.length, 1, 'address saved for next time');
});

test('online order: pending, then confirmed by verified Razorpay signature; forged signature rejected', async () => {
  const r = await call('POST', '/api/checkout/place', { items: [ITEM], paymentMethod: 'upi', address: ADDRESS, idempotencyKey: 'upi-key-1' });
  assert.equal(r.body.order.status, 'pending_payment');
  const { orderId } = r.body.payment;
  const inv = (await db.query(`SELECT reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0];
  assert.equal(inv.reserved, 2, 'stock reserved while paying');

  const forged = await call('POST', '/api/checkout/verify', { orderNumber: r.body.order.number, razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'nope' });
  assert.equal(forged.status, 400);

  const signature = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|pay_1`).digest('hex');
  const ok = await call('POST', '/api/checkout/verify', { orderNumber: r.body.order.number, razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: signature });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.order.status, 'confirmed');
  assert.equal(ok.body.order.paymentStatus, 'paid');
  const inv2 = (await db.query(`SELECT reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0];
  assert.equal(inv2.reserved, 0);
});

test('webhook: signed event confirms payment once; unsigned rejected', async () => {
  const r = await call('POST', '/api/checkout/place', { items: [ITEM], paymentMethod: 'card', address: ADDRESS, idempotencyKey: 'card-key-1' });
  const event = { event: 'payment.captured', created_at: 1, payload: { payment: { entity: { id: 'pay_W1', order_id: r.body.payment.orderId, method: 'card' } } } };
  const raw = JSON.stringify(event);
  const sig = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const hook = (s) => app.inject({ method: 'POST', url: '/api/webhooks/razorpay', payload: raw,
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': s, 'x-razorpay-event-id': 'evt_1' } });
  assert.equal((await hook('bad')).statusCode, 400);
  assert.equal((await hook(sig)).statusCode, 200);
  assert.equal((await hook(sig)).json().duplicate, true);
  const o = await call('GET', `/api/orders/${r.body.order.number}`);
  assert.equal(o.body.order.paymentStatus, 'paid');
  assert.equal(o.body.order.timeline.at(-1).status, 'confirmed');
});

test('abandoned online payments release their stock', async () => {
  const r = await call('POST', '/api/checkout/place', { items: [ITEM], paymentMethod: 'upi', address: ADDRESS, idempotencyKey: 'upi-key-abandon' });
  await db.query(`UPDATE orders SET created_at = now() - interval '2 hours' WHERE order_number = $1`, [r.body.order.number]);
  await app.shop.orders.releaseExpired();
  const o = await call('GET', `/api/orders/${r.body.order.number}`);
  assert.equal(o.body.order.status, 'cancelled');
  assert.equal((await db.query(`SELECT reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0].reserved, 0);
});

test('cannot oversell', async () => {
  await db.query(`UPDATE inventory SET on_hand = reserved + 3 WHERE product_id = 'reviva-roll-on'`);
  const r = await call('POST', '/api/checkout/place', { items: [{ id: 'reviva-roll-on', pack: 2, qty: 2 }], paymentMethod: 'cod', address: ADDRESS, idempotencyKey: 'oversell-1' });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'out_of_stock');
});

test('customers only see their own orders; logout ends the session', async () => {
  const mine = await call('GET', '/api/orders');
  assert.ok(mine.body.orders.length >= 3);
  const number = mine.body.orders[0].number;
  await call('POST', '/api/auth/logout', {});
  cookie = '';
  const req = await call('POST', '/api/auth/otp/request', { phone: '9123456789' });
  await call('POST', '/api/auth/otp/verify', { phone: '9123456789', code: sms.codeFor('9123456789') });
  const other = await call('GET', `/api/orders/${number}`);
  assert.equal(other.status, 404);
});
