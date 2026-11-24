// Catalogue + batches tests on an in-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, totpCode } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { writeOffExpired } from '../shop/batches.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let app, db, sms, admin = '', cust = '';

async function call(method, url, payload, cookie = admin, headers = {}) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, ...headers } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
}
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const inv = async (id) => (await db.query('SELECT on_hand, reserved FROM inventory WHERE product_id = $1', [id])).rows[0];

before(async () => {
  sms = installTestTwilio();
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','Owner','owner',$1,false,true,$2)`, [await hashPassword('Pass-word-123'), SECRET]);
  const login = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode(SECRET) } });
  admin = [].concat(login.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone: '9833344455' } });
  const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone: '9833344455', code: sms.codeFor('9833344455') } });
  cust = [].concat(v.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  await call('PATCH', '/api/account', { name: 'Batch Buyer' }, cust);
});
after(async () => { await app.close(); sms.restore(); });

test('public catalogue: content copied from the site, prices in rupees, no exact stock numbers', async () => {
  const r = await call('GET', '/api/products', undefined, '');
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-cache');
  const liver = r.body.products.find((p) => p.id === 'liver-booster');
  assert.equal(liver.price, 900);
  assert.ok(liver.faqs.length >= 3 && liver.ingredients.includes('milk-thistle'));
  assert.deepEqual(liver.images, ['/img/p/liver.webp']);
  assert.equal(liver.stock, 'in');
  assert.equal(liver.available, undefined, 'exact stock is never public');
});

test('create product: starts hidden, edit content + label details, completeness rises, then goes on sale', async () => {
  const bad = await call('POST', '/api/admin/products', { name: 'Ashwagandha Calm Tablets', price: 50000, mrp: 40000 });
  assert.equal(bad.status, 400);
  const c = await call('POST', '/api/admin/products', { name: 'Ashwagandha Calm™ Tablets', format: 'Tablets', size: '60 tablets', price: 45000, mrp: 49900 });
  assert.equal(c.body.id, 'ashwagandha-calm-tablets');
  assert.ok(!(await call('GET', '/api/products', undefined, '')).body.products.some((p) => p.id === c.body.id), 'hidden until switched on');

  const before = (await call('GET', `/api/admin/products/${c.body.id}`)).body.completeness.score;
  const patch = await call('PATCH', `/api/admin/products/${c.body.id}`, {
    tagline: 'Everyday calm with KSM-66 ashwagandha', gstRate: 12, hsnCode: '30049011',
    content: { summary: 'A gentle daily tablet with standardised ashwagandha root extract to support a calm mind and restful sleep.', highlights: ['KSM-66', 'Vegan', '60 tablets'],
      description: ['Ashwagandha is one of Ayurveda’s most trusted adaptogens, traditionally used to support calm and resilience.'], ingredients: ['ashwagandha'],
      howToUse: ['1 tablet twice daily after meals'], precautions: ['Not for pregnant women'], faqs: [['Is it habit forming?', 'No.'], ['When will I feel it?', 'Usually 2 to 4 weeks.'], ['Vegan?', 'Yes.']] },
    compliance: { netQuantity: '60 tablets', manufacturer: 'TranzLife Biosciences', manufacturerAddress: 'Egmore, Chennai 600008', licenceNo: 'AYUSH/TN/1234', shelfLifeMonths: 24, consumerCare: 'care@tranzlife.in' },
  });
  assert.equal(patch.status, 200);
  const after = (await call('GET', `/api/admin/products/${c.body.id}`)).body;
  assert.ok(after.completeness.score > before);
  assert.deepEqual(after.completeness.missing.sort(), ['At least 2 photos', 'Stock in a batch with expiry date'].sort());
  assert.equal(after.product.compliance.licenceNo, 'AYUSH/TN/1234');

  await call('PATCH', `/api/admin/products/${c.body.id}`, { active: true });
  const pub = (await call('GET', '/api/products', undefined, '')).body.products.find((p) => p.id === c.body.id);
  assert.equal(pub.price, 450);
  assert.equal(pub.stock, 'out', 'no stock yet');
  const log = (await call('GET', `/api/admin/audit?entity=product&entityId=${c.body.id}`)).body.rows.map((r) => r.action);
  assert.ok(log.includes('product.create') && log.includes('product.update'));
});

test('photo upload without storage configured gives a clear message', async () => {
  const r = await call('POST', '/api/admin/products/liver-booster/media', Buffer.from('not really'), admin, { 'content-type': 'image/jpeg' });
  assert.equal(r.status, 503);
  assert.match(r.body.error, /storage is not set up/i);
  const wrongType = await call('POST', '/api/admin/products/liver-booster/media', 'hello', admin, { 'content-type': 'text/plain' });
  assert.ok(wrongType.status === 415 || wrongType.status === 400);
});

test('batches: validation, FEFO allocation, recall view, cancel puts units back in the same batch', async () => {
  const id = 'energy-booster';
  assert.equal((await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'EB-01', mfgDate: day(-10), expiryDate: day(-20), qty: 5 })).status, 400, 'expiry before mfg');
  assert.equal((await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'EB-00', mfgDate: day(-400), expiryDate: day(-1), qty: 5 })).status, 400, 'already expired');
  const start = await inv(id);
  const late = await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'eb-late', mfgDate: day(-30), expiryDate: day(600), qty: 10 });
  const soon = await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'EB-SOON', mfgDate: day(-300), expiryDate: day(60), qty: 3 });
  assert.equal(late.status, 200);
  assert.equal((await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'EB-SOON', mfgDate: day(-3), expiryDate: day(90), qty: 1 })).status, 409, 'duplicate batch number');
  assert.equal((await inv(id)).on_hand, start.on_hand + 13);

  // 2 packs of 2 = 4 units: 3 from EB-SOON (expires first), 1 from EB-LATE
  const o = await call('POST', '/api/checkout/place', { items: [{ id, pack: 2, qty: 2 }], paymentMethod: 'cod', idempotencyKey: 'fefo-order-1',
    address: { name: 'Batch Buyer', phone: '9833344455', line1: '4 Temple Road', city: 'Trichy', state: 'Tamil Nadu', pin: '620001' } }, cust);
  assert.equal(o.status, 200);
  const full = (await call('GET', `/api/admin/products/${id}`)).body;
  const bySoon = full.batches.find((b) => b.batch_no === 'EB-SOON'), byLate = full.batches.find((b) => b.batch_no === 'EB-LATE');
  assert.equal(bySoon.qty_remaining, 0);
  assert.equal(byLate.qty_remaining, 9);
  assert.equal(bySoon.shipped, 3);

  const recall = (await call('GET', `/api/admin/batches/${soon.body.id}`)).body;
  assert.equal(recall.orders.length, 1);
  assert.equal(recall.orders[0].name, 'Batch Buyer');
  assert.equal(recall.orders[0].qty, 3);

  const slips = (await call('GET', `/api/admin/orders/slips?numbers=${o.body.order.number}`)).body.slips;
  assert.deepEqual(slips[0].items[0].batches.map((b) => `${b.batchNo}×${b.qty}`).sort(), ['EB-LATE×1', 'EB-SOON×3']);

  await call('POST', `/api/admin/orders/${o.body.order.number}/status`, { status: 'cancelled', note: 'Customer changed mind' });
  const back = (await call('GET', `/api/admin/products/${id}`)).body;
  assert.equal(back.batches.find((b) => b.batch_no === 'EB-SOON').qty_remaining, 3);
  assert.equal(back.batches.find((b) => b.batch_no === 'EB-LATE').qty_remaining, 10);
  assert.equal((await inv(id)).on_hand, start.on_hand + 13);
});

test('expired batches are taken out of stock and never sold; write-off needs a reason', async () => {
  const id = 'reviva-roll-on';
  const startOnHand = (await inv(id)).on_hand;
  // an expired batch (as if time passed) and a good one
  await db.query(`INSERT INTO batches (product_id, batch_no, mfg_date, expiry_date, qty_received, qty_remaining) VALUES ($1,'RV-OLD',$2,$3,4,4)`, [id, day(-700), day(-1)]);
  await db.query('UPDATE inventory SET on_hand = on_hand + 4 WHERE product_id = $1', [id]);
  const done = await writeOffExpired(db);
  assert.deepEqual(done.map((d) => `${d.batchNo}:${d.units}`), ['RV-OLD:4']);
  assert.equal((await inv(id)).on_hand, startOnHand);
  const b = (await db.query(`SELECT qty_remaining, written_off_at FROM batches WHERE batch_no = 'RV-OLD'`)).rows[0];
  assert.equal(b.qty_remaining, 0);
  assert.ok(b.written_off_at);
  assert.deepEqual(await writeOffExpired(db), [], 'runs once');

  const good = await call('POST', `/api/admin/products/${id}/batches`, { batchNo: 'RV-NEW', mfgDate: day(-5), expiryDate: day(700), qty: 6 });
  assert.equal((await call('POST', `/api/admin/batches/${good.body.id}/write-off`, { reason: '' })).status, 400);
  const w = await call('POST', `/api/admin/batches/${good.body.id}/write-off`, { reason: 'Leaking caps' });
  assert.equal(w.body.units, 6);
  assert.equal((await call('POST', `/api/admin/batches/${good.body.id}/write-off`, { reason: 'again' })).status, 400);
});

test('admin product list: completeness, days of stock left, batches, sales trend', async () => {
  const list = (await call('GET', '/api/admin/products')).body.products;
  const eb = list.find((p) => p.id === 'energy-booster');
  assert.equal(eb.spark.length, 14);
  assert.ok(eb.completeness.score > 0 && eb.completeness.score < 100);
  assert.equal(eb.batches, 2);
  assert.ok(eb.next_expiry);
  assert.ok(list.find((p) => p.id === 'ashwagandha-calm-tablets'));
  const ing = (await call('GET', '/api/admin/ingredients')).body.ingredients;
  assert.ok(ing.length > 10 && ing[0].id && ing[0].name);
});
