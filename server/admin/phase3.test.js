// Returns, customer profiles/segments/notes, analytics. In-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, totpCode } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let app, db, sms, owner = '', support = '';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function call(method, url, payload, cookie = owner) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
}
async function staffLogin(email, role) {
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ($1,$2,$3,$4,false,true,$5)`,
    [email, role, role, await hashPassword('Pass-word-123'), SECRET]);
  // each sign-in needs a fresh code step; reuse is blocked, so use the "previous" step for the second account
  const step = Math.floor(Date.now() / 30000) + (role === 'owner' ? 0 : -1);
  const { totpCode: code } = await import('./crypto.js');
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { email, password: 'Pass-word-123', code: code(SECRET, step) } });
  return [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
}
async function customer(phone, name) {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone } });
  const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone, code: sms.codeFor(phone) } });
  const c = [].concat(v.headers['set-cookie']).map((x) => x.split(';')[0]).join('; ');
  await call('PATCH', '/api/account', { name }, c);
  return c;
}
const place = async (c, items, key, phone = '9844455566') => (await call('POST', '/api/checkout/place', { items, paymentMethod: 'cod', idempotencyKey: key,
  address: { name: 'Return Tester', phone, line1: '8 Lake View', city: 'Madurai', state: 'Tamil Nadu', pin: '625002' } }, c)).body.order.number;
const deliver = async (n) => { for (const s of ['packed', 'shipped', 'delivered']) await call('POST', `/api/admin/orders/${n}/status`, { status: s }); };
const inv = async (id) => (await db.query('SELECT on_hand FROM inventory WHERE product_id = $1', [id])).rows[0].on_hand;

before(async () => {
  sms = installTestTwilio();
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
  owner = await staffLogin('owner@x.test', 'owner');
  support = await staffLogin('help@x.test', 'support');
});
after(async () => { await app.close(); sms.restore(); });

test('returns: request -> receive (resellable back into its batch, damaged not) -> refund; order becomes returned', async () => {
  const c = await customer('9844455566', 'Return Tester');
  await call('POST', '/api/admin/products/liver-booster/batches', { batchNo: 'LB-R1', mfgDate: day(-20), expiryDate: day(500), qty: 10 });
  const n = await place(c, [{ id: 'liver-booster', pack: 1, qty: 2 }, { id: 'reviva-roll-on', pack: 1, qty: 1 }], 'ret-order-1');
  const notYet = await call('POST', `/api/admin/orders/${n}/returns`, { items: [{ orderItemId: 1, qty: 1 }], reason: 'damaged' });
  assert.equal(notYet.status, 409, 'only delivered orders');
  await deliver(n);
  const r0 = (await call('GET', `/api/admin/orders/${n}/returnable`)).body;
  assert.equal(r0.eligible, true);
  const [liver, reviva] = r0.items;
  assert.equal((await call('POST', `/api/admin/orders/${n}/returns`, { items: [{ orderItemId: liver.id, qty: 3 }], reason: 'damaged' })).status, 400, 'more than bought');

  const ret = await call('POST', `/api/admin/orders/${n}/returns`, { items: [{ orderItemId: liver.id, qty: 2 }, { orderItemId: reviva.id, qty: 1 }], reason: 'damaged', note: 'Box crushed' });
  assert.match(ret.body.number, /^RET-\d{6}$/);
  assert.equal((await call('GET', '/api/admin/returns/counts')).body.counts.requested, 1);
  const attn = (await call('GET', '/api/admin/alerts')).body.items.map((i) => i.key);
  assert.ok(attn.includes('returns_requested'));

  const detail = (await call('GET', `/api/admin/returns/${ret.body.id}`)).body;
  assert.equal(detail.items.length, 2);
  assert.equal(detail.suggestedRefund, 90000 * 2 + 69900);
  assert.equal((await call('POST', `/api/admin/returns/${ret.body.id}/resolve`, { resolution: 'refund' })).status, 409, 'receive first');

  const liverBefore = await inv('liver-booster'), revivaBefore = await inv('reviva-roll-on');
  const batchBefore = (await db.query(`SELECT qty_remaining FROM batches WHERE batch_no = 'LB-R1'`)).rows[0].qty_remaining;
  const rec = await call('POST', `/api/admin/returns/${ret.body.id}/receive`, {
    items: [{ id: detail.items[0].id, condition: 'resellable' }, { id: detail.items[1].id, condition: 'damaged' }], note: 'One leaked' });
  assert.equal(rec.body.restocked, 2);
  assert.equal(rec.body.orderReturned, true, 'everything came back');
  assert.equal(await inv('liver-booster'), liverBefore + 2);
  assert.equal(await inv('reviva-roll-on'), revivaBefore, 'damaged unit is not put back on sale');
  assert.equal((await db.query(`SELECT qty_remaining FROM batches WHERE batch_no = 'LB-R1'`)).rows[0].qty_remaining, batchBefore + 2, 'back into the same batch');
  assert.equal((await call('GET', `/api/admin/orders/${n}`)).body.order.status, 'returned');

  assert.equal((await call('POST', `/api/admin/returns/${ret.body.id}/resolve`, { resolution: 'refund' }, support)).status, 403, 'support cannot');
  const res = await call('POST', `/api/admin/returns/${ret.body.id}/resolve`, { resolution: 'refund', note: 'Sorry about that' });
  assert.equal(res.status, 200);
  assert.equal(res.body.refund.amount, 249900);
  assert.equal(res.body.refund.method, 'manual', 'COD: paid back by hand');
  const o = (await call('GET', `/api/admin/orders/${n}`)).body.order;
  assert.equal(o.paymentStatus, 'refunded', 'free-shipping order: the returned items were the whole total');
  assert.equal((await call('POST', `/api/admin/returns/${ret.body.id}/resolve`, { resolution: 'no_action' })).status, 409, 'closed');
});

test('returns: partial return keeps the order delivered; reject path; list filters', async () => {
  const c = await customer('9855566677', 'Partial Returner');
  const n = await place(c, [{ id: 'cyclerelief-roll-on', pack: 1, qty: 3 }], 'ret-order-2', '9855566677');
  await deliver(n);
  const item = (await call('GET', `/api/admin/orders/${n}/returnable`)).body.items[0];
  const ret = await call('POST', `/api/admin/orders/${n}/returns`, { items: [{ orderItemId: item.id, qty: 1 }], reason: 'changed_mind' });
  assert.equal((await call('POST', `/api/admin/returns/${ret.body.id}/reject`, { note: '' })).status, 400, 'needs a reason');
  assert.equal((await call('POST', `/api/admin/returns/${ret.body.id}/reject`, { note: 'Opened and used' })).status, 200);
  // rejected returns free the quantity up again
  assert.equal((await call('GET', `/api/admin/orders/${n}/returnable`)).body.items[0].returnable, 3);
  const r2 = await call('POST', `/api/admin/orders/${n}/returns`, { items: [{ orderItemId: item.id, qty: 1 }], reason: 'expired' });
  const d2 = (await call('GET', `/api/admin/returns/${r2.body.id}`)).body;
  const rec = await call('POST', `/api/admin/returns/${r2.body.id}/receive`, { items: [{ id: d2.items[0].id, condition: 'expired' }] });
  assert.equal(rec.body.restocked, 0);
  assert.equal(rec.body.orderReturned, false);
  assert.equal((await call('GET', `/api/admin/orders/${n}`)).body.order.status, 'delivered');
  await call('POST', `/api/admin/returns/${r2.body.id}/resolve`, { resolution: 'replacement' });
  const lists = { open: (await call('GET', '/api/admin/returns')).body.rows.length, all: (await call('GET', '/api/admin/returns?status=all')).body.rows.length, rejected: (await call('GET', '/api/admin/returns?status=rejected')).body.rows.length };
  assert.deepEqual(lists, { open: 0, all: 3, rejected: 1 });
});

test('customers: segments, lifetime value, profile, notes', async () => {
  const c = await customer('9866677788', 'Loyal Lata');
  for (const k of [1, 2, 3]) await place(c, [{ id: 'pulmoclear-gummies', pack: 1, qty: 1 }], `loyal-${k}-order`, '9866677788');
  await customer('9877788899', 'Window Shopper');
  const list = (await call('GET', '/api/admin/customers?sort=ltv')).body;
  assert.ok(list.counts.loyal >= 1 && list.counts.prospect >= 1);
  const lata = list.rows.find((r) => r.name === 'Loyal Lata');
  assert.equal(lata.segment, 'loyal');
  assert.equal(lata.orders, 3);
  const loyalOnly = (await call('GET', '/api/admin/customers?segment=loyal')).body.rows;
  assert.ok(loyalOnly.every((r) => r.segment === 'loyal'));
  const shopper = (await call('GET', '/api/admin/customers?segment=prospect')).body.rows.find((r) => r.name === 'Window Shopper');
  assert.equal(shopper.orders, 0);

  const p = (await call('GET', `/api/admin/customers/${lata.id}`)).body;
  assert.equal(p.segment, 'loyal');
  assert.equal(p.stats.orders, 3);
  assert.equal(p.stats.aov, Math.round(p.stats.spent / 3));
  assert.equal(p.favourites[0].id, 'pulmoclear-gummies');
  assert.equal(p.stats.city, 'Madurai');

  assert.equal((await call('POST', `/api/admin/customers/${lata.id}/notes`, { body: 'Prefers WhatsApp updates' }, support)).status, 200, 'support can add notes');
  const notes = (await call('GET', `/api/admin/customers/${lata.id}`)).body.notes;
  assert.equal(notes[0].body, 'Prefers WhatsApp updates');
  assert.equal(notes[0].staff_email, 'help@x.test');
  assert.equal((await call('DELETE', `/api/admin/customers/${lata.id}/notes/${notes[0].id}`, {})).status, 200, 'owner can remove any note');
});

test('analytics: series, totals vs previous, products with return rate, geography, payments, CSV', async () => {
  const a = (await call('GET', '/api/admin/analytics?range=30d')).body;
  assert.equal(a.unit, 'day');
  assert.equal(a.series.length, 30);
  assert.equal(a.series.reduce((s, x) => s + x.orders, 0), a.current.orders);
  assert.equal(a.series.reduce((s, x) => s + x.first + x.repeat, 0), a.current.orders);
  assert.ok(a.current.repeatRate > 0, 'Loyal Lata ordered 3 times');
  const liver = a.products.find((p) => p.id === 'liver-booster');
  assert.ok(liver.returnRate > 0);
  assert.equal(a.states[0].name, 'Tamil Nadu');
  assert.ok(a.payments.cod.orders > 0);
  assert.ok(a.returns.some((r) => r.reason === 'damaged'));
  assert.equal((await call('GET', '/api/admin/analytics?range=365d')).body.unit, 'month');
  assert.equal((await call('GET', '/api/admin/analytics?range=90d')).body.unit, 'week');
  const csv = await call('GET', '/api/admin/analytics.csv?range=30d&report=products');
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.body, /"Product","Units","Orders","Revenue \(₹\)","Units returned","Return rate %"/);
});

void totpCode;
