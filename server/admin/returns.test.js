// Customer returns, end to end: eligibility rules, the request, staff review -> approve -> pickup -> received -> refund,
// rejection, and the settings that control the policy. In-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, totpCode } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const ENV = { ...TEST_TWILIO_ENV, ORDER_NOTIFICATIONS: 'off', SITE_URL: 'https://shop.test' };
let app, db, sms, owner = '';

async function call(method, url, payload, cookie = owner) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, 'user-agent': UA } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body };
}
async function customer(phone, name) {
  await call('POST', '/api/auth/otp/request', { phone }, '');
  const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone, code: sms.codeFor(phone) } });
  const c = [].concat(v.headers['set-cookie']).map((x) => x.split(';')[0]).join('; ');
  await call('PATCH', '/api/account', { name }, c);
  return c;
}
async function order(c, phone, lines, key, deliver = true) {
  const r = await call('POST', '/api/checkout/place', { items: lines.map(([id, qty]) => ({ id, pack: 1, qty })), paymentMethod: 'cod', idempotencyKey: key,
    address: { name: 'Return Tester', phone, line1: '4 Temple St', city: 'Madurai', state: 'Tamil Nadu', pin: '625001' } }, c);
  if (!r.body.order) throw new Error(`order failed: ${JSON.stringify(r.body)}`);
  const n = r.body.order.number;
  if (deliver) for (const s of ['packed', 'shipped', 'delivered']) await call('POST', `/api/admin/orders/${n}/status`, { status: s });
  return n;
}
const policyOf = async (c, n) => (await call('GET', `/api/orders/${n}/returns`, undefined, c)).body.policy;

before(async () => {
  sms = installTestTwilio();
  db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: ENV, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','Owner','owner',$1,false,true,$2)`,
    [await hashPassword('Pass-word-123'), SECRET]);
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode(SECRET, Math.floor(Date.now() / 30000)) } });
  owner = [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  await db.query('UPDATE inventory SET on_hand = 100');
});
after(async () => { await app.close(); sms.restore(); });

test('returns are for the signed-in owner of a delivered order, and the policy explains what is not returnable', async () => {
  const c = await customer('9876500001', 'Asha K');
  const n = await order(c, '9876500001', [['liver-booster', 2], ['energy-booster', 1]], 'rt-key-0001', false);
  assert.equal((await call('GET', `/api/orders/${n}/returns`, undefined, '')).status, 401, 'signed out');
  const early = await policyOf(c, n);
  assert.equal(early.canReturn, false, 'not delivered yet');
  assert.match(early.items[0].why, /delivered/i);

  for (const s of ['packed', 'shipped', 'delivered']) await call('POST', `/api/admin/orders/${n}/status`, { status: s });
  const other = await customer('9876500002', 'Someone Else');
  assert.equal((await call('GET', `/api/orders/${n}/returns`, undefined, other)).status, 404, 'not their order');

  const ok = await policyOf(c, n);
  assert.equal(ok.canReturn, true);
  assert.equal(ok.windowDays, 7);
  assert.equal(ok.items.find((i) => i.productId === 'liver-booster').returnable, 2);

  // a product the owner marked "not returnable" is shown with the reason and cannot be sent back
  assert.equal((await call('PATCH', '/api/admin/products/energy-booster', { returnable: false })).status, 200);
  const eb = (await policyOf(c, n)).items.find((i) => i.productId === 'energy-booster');
  assert.equal(eb.returnable, 0);
  assert.match(eb.why, /cannot be returned/i);
  const bad = await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: eb.orderItemId, qty: 1 }], reason: 'changed_mind' }, c);
  assert.equal(bad.status, 409);
  await call('PATCH', '/api/admin/products/energy-booster', { returnable: true });
});

test('request -> review -> approve -> pickup -> received -> refund, with a history customers can see', async () => {
  const c = await customer('9876500003', 'Meena R');
  const n = await order(c, '9876500003', [['liver-booster', 2]], 'rt-key-0002');
  const line = (await policyOf(c, n)).items[0];

  assert.equal((await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 3 }], reason: 'damaged' }, c)).status, 400, 'more than bought');
  assert.equal((await call('POST', `/api/orders/${n}/returns`, { items: [], reason: 'damaged' }, c)).status, 400, 'nothing chosen');
  assert.equal((await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 1 }], reason: 'nonsense' }, c)).status, 400, 'unknown reason');
  const made = await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 1 }], reason: 'damaged', note: 'Bottle cap cracked' }, c);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.match(made.body.number, /^RET-\d{6}$/);

  // one pack left: asking for two more is refused
  assert.equal((await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 2 }], reason: 'damaged' }, c)).status, 400);
  const mine = (await call('GET', '/api/returns', undefined, c)).body.returns;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].label, 'Return Requested');
  assert.equal(mine[0].items[0].qty, 1);

  const id = made.body.id;
  const adv = (to, extra = {}) => call('POST', `/api/admin/returns/${id}/advance`, { to, ...extra });
  assert.equal((await adv('pickup_scheduled', { pickupAt: '2030-01-01' })).status, 409, 'cannot skip approval');
  assert.equal((await adv('under_review')).status, 200);
  assert.equal((await adv('approved', { note: 'Photo received' })).status, 200);
  assert.equal((await adv('pickup_scheduled')).status, 400, 'a pickup date is required');
  assert.equal((await adv('pickup_scheduled', { pickupAt: '2030-01-01', note: 'Courier will call' })).status, 200);
  assert.equal((await call('GET', '/api/returns', undefined, c)).body.returns[0].label, 'Pickup Scheduled');

  const detail = (await call('GET', `/api/admin/returns/${id}`)).body;
  const recv = await call('POST', `/api/admin/returns/${id}/receive`, { items: detail.items.map((i) => ({ id: i.id, condition: 'damaged' })) });
  assert.equal(recv.status, 200, JSON.stringify(recv.body));
  assert.equal((await call('GET', '/api/returns', undefined, c)).body.returns[0].label, 'Returned');
  const refund = await call('POST', `/api/admin/returns/${id}/resolve`, { resolution: 'refund' });
  assert.equal(refund.status, 200, JSON.stringify(refund.body));
  // cash-on-delivery refunds are recorded by hand and count as completed at once
  const final = (await call('GET', '/api/returns', undefined, c)).body.returns[0];
  assert.equal(final.label, 'Refund Completed');
  assert.deepEqual(final.history.map((h) => h.status), ['requested', 'under_review', 'approved', 'pickup_scheduled', 'received', 'resolved']);
});

test('staff can reject with a reason the customer sees; the window and the shop-wide switch are respected', async () => {
  const c = await customer('9876500004', 'Ravi T');
  const n = await order(c, '9876500004', [['pulmoclear-gummies', 1]], 'rt-key-0003');
  const line = (await policyOf(c, n)).items[0];
  const made = await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 1 }], reason: 'changed_mind' }, c);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal((await call('POST', `/api/admin/returns/${made.body.id}/reject`, { note: '' })).status, 400, 'a reason is required');
  assert.equal((await call('POST', `/api/admin/returns/${made.body.id}/reject`, { note: 'Opened product cannot be returned' })).status, 200);
  const r = (await call('GET', '/api/returns', undefined, c)).body.returns[0];
  assert.equal(r.label, 'Rejected');
  assert.equal(r.rejectReason, 'Opened product cannot be returned');
  // a rejected return frees the item for a new request
  assert.equal((await policyOf(c, n)).items[0].returnable, 1);

  // outside the window
  await db.query(`UPDATE order_events SET created_at = now() - interval '10 days' WHERE order_id = (SELECT id FROM orders WHERE order_number = $1) AND to_status = 'delivered'`, [n]);
  const late = await policyOf(c, n);
  assert.equal(late.canReturn, false);
  assert.match(late.items[0].why, /window closed/i);
  // the owner widens the window
  assert.equal((await call('PATCH', '/api/admin/settings', { return_window_days: 30 })).status, 200);
  assert.equal((await policyOf(c, n)).canReturn, true);
  // ...or switches returns off
  await call('PATCH', '/api/admin/settings', { returns_enabled: false });
  const off = await call('POST', `/api/orders/${n}/returns`, { items: [{ orderItemId: line.orderItemId, qty: 1 }], reason: 'changed_mind' }, c);
  assert.equal(off.status, 409);
  await call('PATCH', '/api/admin/settings', { returns_enabled: true, return_window_days: 7 });
});

test('a product without a price is sent as null (never 0) and cannot be bought', async () => {
  await db.query(`UPDATE products SET price = 0, mrp = 0 WHERE id = 'pulmoclear-gummies'`);
  const list = (await call('GET', '/api/products', undefined, '')).body.products;
  const p = list.find((x) => x.id === 'pulmoclear-gummies');
  assert.equal(p.price, null);
  assert.equal(p.mrp, null);
  const q = await call('POST', '/api/checkout/quote', { items: [{ id: 'pulmoclear-gummies', pack: 1, qty: 1 }], paymentMethod: 'cod' }, '');
  assert.equal(q.status, 400, 'an unpriced product cannot be bought');
  await db.query(`UPDATE products SET price = 20000, mrp = 20000 WHERE id = 'pulmoclear-gummies'`);
});
