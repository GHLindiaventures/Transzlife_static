// Admin API tests on an in-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { hashPassword, verifyPassword, totpCode, totpStep, verifyTotp } from './crypto.js';

const ORIGIN = 'http://localhost:3000';
const env = { ...TEST_TWILIO_ENV, RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'rzp_secret', RAZORPAY_WEBHOOK_SECRET: 'wh' };
let app, db;
let sms;
const jars = {};

const realFetch = globalThis.fetch;
const razorpayCalls = [];
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('https://api.razorpay.com/v1/orders')) return new Response(JSON.stringify({ id: `order_${razorpayCalls.push(u)}`, amount: JSON.parse(opts.body).amount, currency: 'INR' }));
  if (u.includes('/refund')) { razorpayCalls.push(u); return new Response(JSON.stringify({ id: `rfnd_${razorpayCalls.length}`, status: 'processed', amount: JSON.parse(opts.body).amount })); }
  return realFetch(url, opts);
};

async function call(jar, method, url, payload, headers = {}) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie: jars[jar] || '', ...headers } });
  const set = res.headers['set-cookie'];
  if (set) {
    const map = new Map((jars[jar] || '').split('; ').filter(Boolean).map((c) => c.split('=')));
    for (const c of [].concat(set)) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) map.set(k, v); else map.delete(k); }
    jars[jar] = [...map].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
}

const OWNER = { email: 'owner@tranzlife.test', password: 'Owner-pass-2026' };
let ownerSecret;
const ADDRESS = { name: 'Asha', phone: '9811111111', line1: '5 Lake Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600010' };

before(async () => {
  sms = installTestTwilio();
  db = await createDb(env, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1, 'Owner', 'owner', $2)`, [OWNER.email, await hashPassword('tl-temp-pass-1')]);
  // a customer with two orders: one COD, one paid online
  const r = await call('cust', 'POST', '/api/auth/otp/request', { phone: '9811111111' });
  await call('cust', 'POST', '/api/auth/otp/verify', { phone: '9811111111', code: sms.codeFor('9811111111') });
  await call('cust', 'PATCH', '/api/account', { name: 'Asha Kumar' });
});
after(async () => { await app.close(); sms.restore(); globalThis.fetch = realFetch; });

test('crypto: RFC 6238 test vector and scrypt round trip', async () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';   // "12345678901234567890"
  assert.equal(totpCode(rfcSecret, Math.floor(59 / 30)), '287082');
  assert.equal(totpCode(rfcSecret, Math.floor(1111111109 / 30)), '081804');
  const step = verifyTotp(rfcSecret, '287082', null, 59_000);
  assert.equal(step, 1);
  assert.equal(verifyTotp(rfcSecret, '287082', step, 59_000), null, 'a used code cannot be reused');
  const h = await hashPassword('secret-123');
  assert.ok(await verifyPassword('secret-123', h));
  assert.ok(!(await verifyPassword('secret-124', h)));
});

test('admin API needs a staff session; customer sessions do not count', async () => {
  assert.equal((await call('anon', 'GET', '/api/admin/dashboard')).status, 401);
  assert.equal((await call('cust', 'GET', '/api/admin/dashboard')).status, 401);
});

test('first sign-in: temporary password -> must set password and 2FA before anything else', async () => {
  const bad = await call('owner', 'POST', '/api/admin/auth/login', { email: OWNER.email, password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const ok = await call('owner', 'POST', '/api/admin/auth/login', { email: OWNER.email, password: 'tl-temp-pass-1' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.staff.mustChangePassword, true);
  assert.match(jars.owner, /tl_admin=/);

  const blocked = await call('owner', 'GET', '/api/admin/dashboard');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'setup_required');

  const weak = await call('owner', 'POST', '/api/admin/auth/password', { current: 'tl-temp-pass-1', next: 'short' });
  assert.equal(weak.status, 400);
  assert.equal((await call('owner', 'POST', '/api/admin/auth/password', { current: 'tl-temp-pass-1', next: OWNER.password })).status, 200);
  assert.equal((await call('owner', 'GET', '/api/admin/dashboard')).status, 403, 'still needs 2FA');

  const setup = await call('owner', 'POST', '/api/admin/auth/2fa/setup', {});
  assert.match(setup.body.qr, /^data:image\/png;base64,/);
  assert.match(setup.body.uri, /^otpauth:\/\/totp\//);
  ownerSecret = setup.body.secret;
  assert.equal((await call('owner', 'POST', '/api/admin/auth/2fa/enable', { code: '000000' === totpCode(ownerSecret) ? '111111' : '000000' })).status, 400);
  assert.equal((await call('owner', 'POST', '/api/admin/auth/2fa/enable', { code: totpCode(ownerSecret) })).status, 200);
  assert.equal((await call('owner', 'GET', '/api/admin/dashboard')).status, 200, 'fully set up');
});

test('sign-in with 2FA: password alone asks for the code; reused code is refused', async () => {
  jars.owner2 = '';
  const step1 = await call('owner2', 'POST', '/api/admin/auth/login', { email: OWNER.email, password: OWNER.password });
  assert.deepEqual(step1.body, { needsCode: true });
  assert.ok(!jars.owner2.includes('tl_admin'), 'no session before the code');
  const reused = await call('owner2', 'POST', '/api/admin/auth/login', { email: OWNER.email, password: OWNER.password, code: totpCode(ownerSecret) });
  assert.equal(reused.status, 401, 'the code used to enable 2FA cannot be used again');
  const next = totpCode(ownerSecret, totpStep() + 1);
  const ok = await call('owner2', 'POST', '/api/admin/auth/login', { email: OWNER.email, password: OWNER.password, code: next });
  assert.equal(ok.status, 200);
  assert.equal((await call('owner2', 'GET', '/api/admin/auth/me')).body.staff.role, 'owner');
});

test('5 wrong passwords lock the account for 15 minutes', async () => {
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash) VALUES ('lock@tranzlife.test', 'Lock', 'support', $1)`, [await hashPassword('Right-pass-1')]);
  for (let i = 0; i < 4; i++) assert.equal((await call('x', 'POST', '/api/admin/auth/login', { email: 'lock@tranzlife.test', password: 'nope' })).status, 401);
  assert.equal((await call('x', 'POST', '/api/admin/auth/login', { email: 'lock@tranzlife.test', password: 'nope' })).status, 429);
  const right = await call('x', 'POST', '/api/admin/auth/login', { email: 'lock@tranzlife.test', password: 'Right-pass-1' });
  assert.equal(right.status, 429, 'even the right password is refused while locked');
});

test('orders: status flow, cancel returns stock, COD delivered = paid, refunds', async () => {
  const stock = async () => (await db.query(`SELECT on_hand, reserved FROM inventory WHERE product_id = 'liver-booster'`)).rows[0];
  const start = await stock();
  const cod = await call('cust', 'POST', '/api/checkout/place', { items: [{ id: 'liver-booster', pack: 1, qty: 3 }], paymentMethod: 'cod', address: ADDRESS, idempotencyKey: 'adm-cod-1' });
  const n = cod.body.order.number;
  assert.equal((await stock()).on_hand, start.on_hand - 3);

  const list = await call('owner', 'GET', '/api/admin/orders?status=confirmed&q=asha');
  assert.ok(list.body.rows.some((r) => r.order_number === n));

  const jump = await call('owner', 'POST', `/api/admin/orders/${n}/status`, { status: 'delivered' });
  assert.equal(jump.status, 409, 'cannot skip from confirmed to delivered');
  assert.equal((await call('owner', 'POST', `/api/admin/orders/${n}/status`, { status: 'cancelled' })).status, 400, 'cancel needs a reason');
  for (const s of ['packed', 'shipped', 'delivered']) assert.equal((await call('owner', 'POST', `/api/admin/orders/${n}/status`, { status: s })).status, 200);
  let detail = (await call('owner', 'GET', `/api/admin/orders/${n}`)).body;
  assert.equal(detail.order.paymentStatus, 'paid', 'cash collected on delivery');
  assert.deepEqual(detail.order.next, ['returned']);

  const refund = await call('owner', 'POST', `/api/admin/orders/${n}/refund`, { amount: 10000, reason: 'Damaged bottle' });
  assert.equal(refund.body.method, 'manual');
  const tooMuch = await call('owner', 'POST', `/api/admin/orders/${n}/refund`, { amount: 10_000_000, reason: 'test' });
  assert.equal(tooMuch.status, 400);
  detail = (await call('owner', 'GET', `/api/admin/orders/${n}`)).body;
  assert.equal(detail.order.paymentStatus, 'partially_refunded');
  assert.equal(detail.order.refunded, 10000);

  // cancel a confirmed order -> stock comes back
  const second = await call('cust', 'POST', '/api/checkout/place', { items: [{ id: 'liver-booster', pack: 2, qty: 1 }], paymentMethod: 'cod', address: ADDRESS, idempotencyKey: 'adm-cod-2' });
  const before = await stock();
  assert.equal((await call('owner', 'POST', `/api/admin/orders/${second.body.order.number}/status`, { status: 'cancelled', note: 'Customer asked' })).status, 200);
  assert.equal((await stock()).on_hand, before.on_hand + 2);

  // online order: full refund through Razorpay
  const online = await call('cust', 'POST', '/api/checkout/place', { items: [{ id: 'reviva-roll-on', pack: 1, qty: 1 }], paymentMethod: 'upi', address: ADDRESS, idempotencyKey: 'adm-upi-1' });
  await app.shop.orders.markPaid({ providerOrderId: online.body.payment.orderId, providerPaymentId: 'pay_ADM1', actor: 'test' });
  const cancel = await call('owner', 'POST', `/api/admin/orders/${online.body.order.number}/status`, { status: 'cancelled', note: 'Out of area' });
  assert.equal(cancel.body.refundSuggested, true);
  const rf = await call('owner', 'POST', `/api/admin/orders/${online.body.order.number}/refund`, { reason: 'Order cancelled' });
  assert.equal(rf.body.method, 'razorpay');
  assert.ok(razorpayCalls.some((u) => u.includes('/payments/pay_ADM1/refund')));
  assert.equal((await call('owner', 'GET', `/api/admin/orders/${online.body.order.number}`)).body.order.paymentStatus, 'refunded');
});

test('products and stock: edits are validated and audited', async () => {
  assert.equal((await call('owner', 'PATCH', '/api/admin/products/liver-booster', { price: 99900, mrp: 79900 })).status, 400, 'price above MRP');
  assert.equal((await call('owner', 'PATCH', '/api/admin/products/liver-booster', { price: 69900, gstRate: 12, hsnCode: '30049011' })).status, 200);
  const q = await call('cust', 'POST', '/api/checkout/quote', { items: [{ id: 'liver-booster', pack: 1, qty: 1 }], paymentMethod: 'cod' });
  assert.equal(q.body.subtotal, 69900, 'checkout uses the new price immediately');

  assert.equal((await call('owner', 'POST', '/api/admin/products/liver-booster/stock', { mode: 'set', units: -1 })).status, 400);
  assert.equal((await call('owner', 'POST', '/api/admin/products/liver-booster/stock', { mode: 'add', units: 50, note: 'Batch 42' })).status, 200);
  const moves = await call('owner', 'GET', '/api/admin/products/liver-booster/stock');
  assert.equal(moves.body.movements[0].reason, 'restock');
  const log = await call('owner', 'GET', '/api/admin/audit?entity=product&entityId=liver-booster');
  assert.deepEqual(log.body.rows.map((r) => r.action), ['stock.adjust', 'product.update']);
  assert.equal(log.body.rows[1].before.price, 90000);
});

test('roles: support can view but not change; only the owner manages staff', async () => {
  const created = await call('owner', 'POST', '/api/admin/staff', { email: 'help@tranzlife.test', name: 'Helpdesk', role: 'support' });
  assert.match(created.body.tempPassword, /^tl-/);
  // sign the support user in and complete setup
  await call('sup', 'POST', '/api/admin/auth/login', { email: 'help@tranzlife.test', password: created.body.tempPassword });
  await call('sup', 'POST', '/api/admin/auth/password', { current: created.body.tempPassword, next: 'Support-pass-1' });
  const s = await call('sup', 'POST', '/api/admin/auth/2fa/setup', {});
  await call('sup', 'POST', '/api/admin/auth/2fa/enable', { code: totpCode(s.body.secret) });

  assert.equal((await call('sup', 'GET', '/api/admin/orders')).status, 200);
  assert.equal((await call('sup', 'PATCH', '/api/admin/products/liver-booster', { price: 100 })).status, 403);
  assert.equal((await call('sup', 'GET', '/api/admin/staff')).status, 403);
  const orders = (await call('sup', 'GET', '/api/admin/orders')).body.rows;
  assert.equal((await call('sup', 'POST', `/api/admin/orders/${orders[0].order_number}/status`, { status: 'returned' })).status, 403);
  assert.equal((await call('sup', 'POST', `/api/admin/orders/${orders[0].order_number}/note`, { note: 'Customer called' })).status, 200);

  const me = (await call('owner', 'GET', '/api/admin/auth/me')).body.staff;
  const staff = (await call('owner', 'GET', '/api/admin/staff')).body.staff;
  const ownerId = staff.find((x) => x.email === OWNER.email).id;
  const demote = await call('owner', 'PATCH', `/api/admin/staff/${ownerId}`, { role: 'manager' });
  assert.equal(demote.status, 400, 'cannot remove the last owner');
  assert.equal(me.email, OWNER.email);

  const off = await call('owner', 'PATCH', `/api/admin/staff/${created.body.id}`, { active: false });
  assert.equal(off.status, 200);
  assert.equal((await call('sup', 'GET', '/api/admin/orders')).status, 401, 'deactivation signs them out');
});

test('CSV export neutralises spreadsheet formulas', async () => {
  await call('cust', 'PATCH', '/api/account', { name: '=HYPERLINK("http://evil")' });
  await call('cust', 'POST', '/api/checkout/place', { items: [{ id: 'reviva-roll-on', pack: 1, qty: 1 }], paymentMethod: 'cod', address: { ...ADDRESS, line1: '+cmd|calc' }, idempotencyKey: 'adm-csv-1' });
  const r = await call('owner', 'GET', '/api/admin/orders.csv');
  assert.match(r.headers['content-type'], /text\/csv/);
  assert.ok(r.body.includes(`"'=HYPERLINK(""http://evil"")"`));
  assert.ok(!/,"=/.test(r.body) && !/,"\+/.test(r.body));
});

test('customer data deletion removes personal details but keeps orders', async () => {
  const list = await call('owner', 'GET', '/api/admin/customers');
  const c = list.body.rows[0];
  assert.equal((await call('owner', 'POST', `/api/admin/customers/${c.id}/delete`, {})).status, 200);
  const d = (await call('owner', 'GET', `/api/admin/customers/${c.id}`)).body;
  assert.equal(d.customer.name, 'Deleted customer');
  assert.equal(d.customer.email, null);
  assert.equal(d.addresses.length, 0);
  assert.ok(d.orders.length > 0);
  assert.equal((await call('cust', 'GET', '/api/auth/me')).body.customer, null, 'their sessions are ended');
});

test('dashboard numbers', async () => {
  const d = (await call('owner', 'GET', '/api/admin/dashboard')).body;
  assert.equal(d.daily.length, 14);
  assert.ok(d.periods.month_orders >= 2);
  assert.ok(d.recent.length >= 3);
});

test('overview: KPIs vs previous period, trend, pipeline, best sellers, attention', async () => {
  const o = (await call('owner', 'GET', '/api/admin/overview?range=30d')).body;
  assert.equal(o.range, '30d');
  assert.equal(o.trend.length, 30);
  assert.ok(o.current.orders >= 2 && o.current.revenue > 0);
  assert.equal(o.current.aov, Math.round(o.current.revenue / o.current.orders));
  assert.equal(o.previous.orders, 0, 'nothing in the previous 30 days');
  assert.equal(o.trend.reduce((s, p) => s + p.orders, 0), o.current.orders, 'trend adds up to the KPI');
  assert.ok(o.best.length >= 1 && o.best[0].revenue >= o.best.at(-1).revenue);
  assert.ok(o.payments.cod.orders >= 1);
  assert.ok(Array.isArray(o.attention));
  const today = (await call('owner', 'GET', '/api/admin/overview?range=today')).body;
  assert.equal(today.trend.length, 24);
  assert.match(today.trend[0].label, /^\d\d:00$/);
});

test('stage counts, bulk status change, packing slips, search', async () => {
  const mk = async (k) => (await call('cust2', 'POST', '/api/checkout/place', { items: [{ id: 'cyclerelief-roll-on', pack: 1, qty: 1 }], paymentMethod: 'cod', idempotencyKey: `bulk-order-${k}`,
    address: { name: 'Bulk Test', phone: '9822233344', line1: '1 Mill Road', city: 'Coimbatore', state: 'Tamil Nadu', pin: '641001' } })).body.order.number;
  await call('cust2', 'POST', '/api/auth/otp/request', { phone: '9822233344' });
  await call('cust2', 'POST', '/api/auth/otp/verify', { phone: '9822233344', code: sms.codeFor('9822233344') });
  await call('cust2', 'PATCH', '/api/account', { name: 'Bulk Test' });
  const [a, b] = [await mk(1), await mk(2)];

  const before = (await call('owner', 'GET', '/api/admin/orders/counts')).body.counts;
  assert.ok(before.to_pack >= 2);
  const tab = (await call('owner', 'GET', '/api/admin/orders?stage=to_pack')).body.rows;
  assert.ok(tab.every((r) => r.status === 'confirmed') && tab.some((r) => r.order_number === a));
  assert.equal(tab.find((r) => r.order_number === a).city, 'Coimbatore');

  const bulk = (await call('owner', 'POST', '/api/admin/orders/bulk-status', { numbers: [a, b, 'TZL-999999'], status: 'packed' })).body;
  assert.equal(bulk.done, 2);
  assert.equal(bulk.failed, 1);
  assert.match(bulk.results.find((r) => r.number === 'TZL-999999').error, /not found/i);
  const after = (await call('owner', 'GET', '/api/admin/orders/counts')).body.counts;
  assert.equal(after.ready_to_ship, before.ready_to_ship + 2);
  assert.equal((await call('sup', 'POST', '/api/admin/orders/bulk-status', { numbers: [a], status: 'shipped' })).status, 401, 'support (deactivated earlier) cannot');

  const slips = (await call('owner', 'GET', `/api/admin/orders/slips?numbers=${a},${b}`)).body.slips;
  assert.equal(slips.length, 2);
  assert.equal(slips[0].address.city, 'Coimbatore');
  assert.equal(slips[0].items[0].qty, 1);

  const s = (await call('owner', 'GET', '/api/admin/search?q=coimbatore')).body;
  assert.ok(Array.isArray(s.orders));
  const byPhone = (await call('owner', 'GET', '/api/admin/search?q=98222')).body;
  assert.ok(byPhone.customers.some((c) => c.name === 'Bulk Test'));
  const byProduct = (await call('owner', 'GET', '/api/admin/search?q=cycle')).body;
  assert.equal(byProduct.products[0].id, 'cyclerelief-roll-on');
  assert.equal((await call('owner', 'GET', '/api/admin/search?q=x')).status, 400, 'at least 2 characters');
});
