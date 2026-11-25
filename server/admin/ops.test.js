// COD confirmation by message (signed Twilio webhook), staff phone confirmation, stock run-out alerts,
// daily owner summary. In-memory Postgres (PGlite).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { twilioSignature } from '../shop/ops.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const ENV = { ...TEST_TWILIO_ENV, ORDER_NOTIFICATIONS: 'sms', SITE_URL: 'https://shop.test' };
const HOOK = 'https://shop.test/api/webhooks/twilio/sms';
let app, db, sms, owner = '';

async function call(method, url, payload, cookie = owner) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie } });
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
const codOrder = async (c, phone, key, id = 'liver-booster', qty = 1) => (await call('POST', '/api/checkout/place', { items: [{ id, pack: 1, qty }], paymentMethod: 'cod', idempotencyKey: key,
  address: { name: 'Cod Tester', phone, line1: '9 Market St', city: 'Salem', state: 'Tamil Nadu', pin: '636001' } }, c)).body.order.number;
async function reply(from, body, { sign = true } = {}) {
  const params = { From: `+91${from}`, Body: body, MessageSid: 'SM1' };
  const res = await app.inject({ method: 'POST', url: '/api/webhooks/twilio/sms', payload: new URLSearchParams(params).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(sign ? { 'x-twilio-signature': twilioSignature('test-token', HOOK, params) } : {}) } });
  return { status: res.statusCode, body: res.body };
}
const cod = async (n) => (await db.query('SELECT cod_confirmation, cod_confirmed_by FROM orders WHERE order_number = $1', [n])).rows[0];

before(async () => {
  sms = installTestTwilio();
  db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: ENV, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','Owner','owner',$1,false,true,$2)`,
    [await hashPassword('Pass-word-123'), SECRET]);
  const { totpCode } = await import('./crypto.js');
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode(SECRET, Math.floor(Date.now() / 30000)) } });
  owner = [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  await db.query('UPDATE inventory SET on_hand = 100');
});
after(async () => { await app.close(); sms.restore(); });

test('COD confirmation is off until switched on', async () => {
  const c = await customer('9822200001', 'First Buyer');
  const n = await codOrder(c, '9822200001', 'cod-off-01');
  assert.equal((await cod(n)).cod_confirmation, null);
});

test('customer replies YES / NO by message; signature required; no reply -> call', async () => {
  assert.equal((await call('PATCH', '/api/admin/settings', { cod_confirmation: true })).status, 200);
  const c = await customer('9822200002', 'Second Buyer');
  const yes = await codOrder(c, '9822200002', 'cod-yes-01');
  assert.equal((await cod(yes)).cod_confirmation, 'pending');
  await new Promise((r) => setTimeout(r, 20));
  assert.match(sms.sent.at(-1).Body, /Reply YES to confirm or NO to cancel/);

  assert.equal((await reply('9822200002', 'yes', { sign: false })).status, 403, 'unsigned webhook refused');
  const r = await reply('9822200002', 'Yes please');
  assert.equal(r.status, 200); assert.match(r.body, /<Message>Thank you! Order .* is confirmed/);
  assert.deepEqual(await cod(yes), { cod_confirmation: 'confirmed', cod_confirmed_by: 'customer' });
  assert.equal((await reply('9822200002', 'YES')).body.includes('<Message>'), false, 'nothing pending any more: no reply sent');

  const no = await codOrder(c, '9822200002', 'cod-no-001');
  assert.match((await reply('9822200002', 'no')).body, /want to cancel/);
  assert.equal((await cod(no)).cod_confirmation, 'cancel_requested');
  assert.equal((await db.query('SELECT status FROM orders WHERE order_number = $1', [no])).rows[0].status, 'confirmed', 'staff cancel it, not the message');
  const alerts = (await call('GET', '/api/admin/alerts')).body.items;
  assert.ok(alerts.some((a) => a.key === 'cod_cancel'));

  const silent = await codOrder(c, '9822200002', 'cod-silent1');
  await db.query(`UPDATE orders SET cod_requested_at = now() - interval '25 hours' WHERE order_number = $1`, [silent]);
  await app.shop.ops.sweep();
  assert.equal((await cod(silent)).cod_confirmation, 'no_reply');
  assert.ok((await call('GET', '/api/admin/alerts')).body.items.some((a) => a.key === 'cod_no_reply'));
  // staff call and record it
  assert.equal((await call('POST', `/api/admin/orders/${silent}/cod`, { result: 'confirmed', note: 'Called, will be home after 6' })).status, 200);
  assert.deepEqual(await cod(silent), { cod_confirmation: 'confirmed', cod_confirmed_by: 'staff:o@x.test' });
  const detail = (await call('GET', `/api/admin/orders/${silent}`)).body;
  assert.equal(detail.order.codConfirmation, 'confirmed');
  assert.ok(detail.events.some((e) => /confirmed by phone: Called/.test(e.note || '')));
});

test('stock run-out alert from the last 30 days of sales', async () => {
  // 3 orders × 4 units in the last 30 days = 0.4 a day; 5 left -> 12 days
  const c = await customer('9822200003', 'Third Buyer');
  for (const k of ['ro-1-0001', 'ro-2-0001', 'ro-3-0001']) await codOrder(c, '9822200003', k, 'energy-booster', 4);
  await db.query(`UPDATE inventory SET on_hand = reserved + 5 WHERE product_id = 'energy-booster'`);
  const items = (await call('GET', '/api/admin/alerts')).body.items;
  const runout = items.find((a) => a.key === 'runout');
  assert.ok(runout, JSON.stringify(items.map((a) => a.key)));
  assert.match(runout.detail, /Energy Booster™?: about 12 days left/);
});

test('daily summary: preview, sent once a day to the listed numbers', async () => {
  const preview = (await call('GET', '/api/admin/daily-summary/preview')).body.text;
  assert.match(preview, /^TranzLife yesterday: \d+ orders?, ₹/);
  assert.match(preview, /to pack/);
  assert.equal((await call('PATCH', '/api/admin/settings', { daily_summary: { enabled: true, phones: ['12345'], hour: 9 } })).status, 400, 'bad number');
  await call('PATCH', '/api/admin/settings', { daily_summary: { enabled: true, phones: ['9833300009'], hour: 6 } });
  const before = sms.sent.filter((m) => m.To === '+919833300009').length;
  await app.shop.ops.sweep(); await app.shop.ops.sweep();
  const sent = sms.sent.filter((m) => m.To === '+919833300009');
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })) % 24;
  assert.equal(sent.length - before, hour >= 6 ? 1 : 0, 'once a day, from the chosen hour');
});
