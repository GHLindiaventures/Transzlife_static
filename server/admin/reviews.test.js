// Reviews (verified buyers only, auto-publish vs hold, votes, reports, moderation) and live presence.
// In-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { createPresence, ACTIVE_MS } from '../shop/presence.js';
import { displayName } from '../shop/reviews.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const ENV = { ...TEST_TWILIO_ENV, ORDER_NOTIFICATIONS: 'sms', SITE_URL: 'https://shop.test' };
let app, db, sms, owner = '';

async function call(method, url, payload, cookie = owner, extra = {}) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, 'user-agent': UA, ...extra } });
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
async function order(c, phone, productId, key, deliver = true) {
  const r = await call('POST', '/api/checkout/place', { items: [{ id: productId, pack: 1, qty: 1 }], paymentMethod: 'cod', idempotencyKey: key,
    address: { name: 'Review Tester', phone, line1: '4 Temple St', city: 'Madurai', state: 'Tamil Nadu', pin: '625001' } }, c);
  if (!r.body.order) throw new Error(`order failed: ${JSON.stringify(r.body)}`);
  const n = r.body.order.number;
  if (deliver) for (const s of ['packed', 'shipped', 'delivered']) await call('POST', `/api/admin/orders/${n}/status`, { status: s });
  return n;
}
const write = (c, productId, rating, body, extra = {}) => call('POST', '/api/reviews', { productId, rating, body, ...extra }, c);
const GOOD = 'Easy to take every day after dinner, the taste is fine and the bottle lasts nearly a month.';

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

test('display names never show more than a first name and initial', () => {
  assert.equal(displayName('Priya Sharma'), 'Priya S.');
  assert.equal(displayName('Ravi'), 'Ravi');
  assert.equal(displayName(''), 'TranzLife customer');
});

test('only verified buyers can review; clean reviews publish at once; one review per product, editable', async () => {
  const c = await customer('9876501234', 'Priya Sharma');
  assert.equal((await write('', 'liver-booster', 5, GOOD)).status, 401, 'signed out');
  assert.equal((await write(c, 'liver-booster', 5, GOOD)).status, 403, 'never bought');
  await order(c, '9876501234', 'liver-booster', 'rv-undelivered', false);
  assert.equal((await write(c, 'liver-booster', 5, GOOD)).status, 403, 'bought but not delivered yet');
  await order(c, '9876501234', 'liver-booster', 'rv-delivered');

  const page0 = (await call('GET', '/api/products/liver-booster/reviews', undefined, c)).body;
  assert.equal(page0.canReview, true);
  const r = await write(c, 'liver-booster', 4, GOOD, { title: 'Good daily routine' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.held, false);
  assert.equal(r.body.review.name, 'Priya S.');
  assert.equal(r.body.review.verified, true);

  const page = (await call('GET', '/api/products/liver-booster/reviews', undefined, '')).body;
  assert.equal(page.summary.total, 1); assert.equal(page.summary.avg, 4); assert.deepEqual(page.summary.counts, [0, 0, 0, 1, 0]);
  assert.equal(page.reviews[0].title, 'Good daily routine');
  assert.ok(!JSON.stringify(page).includes('9876501234'), 'phone never exposed');

  // editing keeps one review and updates the rating
  await write(c, 'liver-booster', 2, 'Changed my mind: the taste is too bitter for me to keep taking it daily.');
  const after = (await call('GET', '/api/products/liver-booster/reviews', undefined, '')).body;
  assert.equal(after.reviews.length, 1); assert.equal(after.summary.avg, 2);
  assert.equal(after.reviews[0].rating, 2, 'negative reviews publish like any other');

  // the catalogue carries the rating
  const cat = (await call('GET', '/api/products/liver-booster', undefined, '')).body.product;
  assert.deepEqual(cat.rating, { avg: 2, count: 1 });
  assert.equal(cat.sold30, null, 'fewer than 5 orders: no "bought N times" line');
});

test('suspicious reviews are held, never for being negative; staff approve / reject with a content reason', async () => {
  const c = await customer('9876501235', 'Arun Kumar');
  await order(c, '9876501235', 'reviva-roll-on', 'rv-hold-1');
  await order(c, '9876501235', 'energy-booster', 'rv-hold-2');
  await order(c, '9876501235', 'cyclerelief-roll-on', 'rv-hold-3');
  const claim = await write(c, 'reviva-roll-on', 5, 'This cured my diabetes completely, no more need for insulin now!');
  assert.equal(claim.body.held, true);
  const link = await write(c, 'energy-booster', 4, 'Good stuff, I also sell it cheaper at www.cheapdeals.in call 9876543210');
  assert.equal(link.body.held, true);
  const third = await write(c, 'cyclerelief-roll-on', 1, 'Did not suit me at all, the smell is too strong and it stung my skin.');
  assert.equal(third.body.held, true, 'third review within a day: held as a burst');

  const list = (await call('GET', '/api/admin/reviews?status=pending')).body;
  const byProduct = Object.fromEntries(list.rows.map((r) => [r.product_id, r]));
  assert.ok(byProduct['reviva-roll-on'].hold_reasons.includes('medical_claim'));
  assert.ok(byProduct['energy-booster'].hold_reasons.includes('link') && byProduct['energy-booster'].hold_reasons.includes('contact'));
  assert.deepEqual(byProduct['cyclerelief-roll-on'].hold_reasons, ['burst'], 'held only for the burst, not for the 1★');
  assert.equal(byProduct['reviva-roll-on'].order_number.length > 0, true);
  assert.ok((await call('GET', '/api/admin/alerts')).body.items.some((a) => a.key === 'reviews'));

  assert.equal((await call('POST', `/api/admin/reviews/${byProduct['reviva-roll-on'].id}/status`, { status: 'rejected' })).status, 400, 'a reason is required');
  assert.equal((await call('POST', `/api/admin/reviews/${byProduct['reviva-roll-on'].id}/status`, { status: 'rejected', reason: 'negative' })).status, 400, 'no "negative" reason exists');
  assert.equal((await call('POST', `/api/admin/reviews/${byProduct['reviva-roll-on'].id}/status`, { status: 'rejected', reason: 'medical_claim' })).status, 200);
  assert.equal((await call('POST', '/api/admin/reviews/bulk', { ids: [byProduct['cyclerelief-roll-on'].id], status: 'approved' })).status, 200);
  const cyc = (await call('GET', '/api/products/cyclerelief-roll-on/reviews', undefined, '')).body;
  assert.equal(cyc.summary.total, 1); assert.equal(cyc.reviews[0].rating, 1);
  assert.equal((await call('GET', '/api/products/reviva-roll-on/reviews', undefined, '')).body.summary.total, 0, 'rejected: not shown');

  assert.equal((await call('POST', `/api/admin/reviews/${byProduct['cyclerelief-roll-on'].id}/reply`, { reply: 'Sorry to hear that, Arun. We have messaged you.' })).status, 200);
  assert.match((await call('GET', '/api/products/cyclerelief-roll-on/reviews', undefined, '')).body.reviews[0].reply.text, /Sorry to hear/);

  // removing is final
  await call('POST', `/api/admin/reviews/${byProduct['energy-booster'].id}/status`, { status: 'removed', reason: 'spam' });
  assert.equal((await write(c, 'energy-booster', 5, GOOD)).status, 403);
});

test('helpful votes: one per person, not on your own review; three reports send a review back to the queue', async () => {
  const author = await customer('9876501236', 'Meena Iyer');
  await order(author, '9876501236', 'pulmoclear-gummies', 'rv-vote-01');
  const id = (await write(author, 'pulmoclear-gummies', 5, GOOD)).body.review.id;
  assert.equal((await call('POST', `/api/reviews/${id}/helpful`, {}, author)).status, 400, 'own review');
  assert.equal((await call('POST', `/api/reviews/${id}/helpful`, {}, '')).status, 401, 'anonymous without consent');
  const v = randomUUID();
  assert.deepEqual((await call('POST', `/api/reviews/${id}/helpful`, { v }, '')).body, { helpful: 1, votedHelpful: true });
  assert.deepEqual((await call('POST', `/api/reviews/${id}/helpful`, { v }, '')).body, { helpful: 0, votedHelpful: false }, 'second press undoes');
  await call('POST', `/api/reviews/${id}/helpful`, { v }, '');

  for (let i = 0; i < 2; i++) await call('POST', `/api/reviews/${id}/report`, { reason: 'Spam or advertising', v: randomUUID() }, '');
  await call('POST', `/api/reviews/${id}/report`, { reason: 'Spam or advertising', v }, '');
  await call('POST', `/api/reviews/${id}/report`, { reason: 'Spam or advertising', v }, '');       // same person twice counts once
  assert.equal((await db.query('SELECT status, report_count FROM reviews WHERE id = $1', [id])).rows[0].status, 'pending');
  const reported = (await call('GET', '/api/admin/reviews?status=reported')).body.rows.find((r) => r.id === id);
  assert.equal(reported.reports[0].n, 3);
  await call('POST', `/api/admin/reviews/${id}/status`, { status: 'approved' });
  assert.equal((await db.query('SELECT status, report_count FROM reviews WHERE id = $1', [id])).rows[0].report_count, 0);
  const raw = JSON.stringify((await db.query(`SELECT voter FROM review_votes`)).rows);
  assert.ok(!raw.includes('127.0.0.1'), 'no IP addresses stored');
});

test('review requests: opted-in customers, one per delivered order, only products not yet reviewed', async () => {
  const c = await customer('9876501237', 'Kavya Nair');
  const n = await order(c, '9876501237', 'breathefree-inhaler', 'rv-request');
  const oid = (await db.query('SELECT id FROM orders WHERE order_number = $1', [n])).rows[0].id;
  const { reminders } = app.shop;
  assert.equal((await reminders.sendReviewRequest(oid)).sent, false, 'no consent');
  await call('PATCH', '/api/account', { name: 'Kavya Nair', marketingConsent: true }, c);
  assert.equal((await reminders.sendReviewRequest(oid)).sent, true);
  assert.match(sms.sent.at(-1).Body, /BreatheFree.*\?review=1/);
  assert.equal((await reminders.sendReviewRequest(oid)).sent, false, 'once per order');
  const mine = (await call('GET', '/api/reviews/mine', undefined, c)).body;
  assert.deepEqual(mine.toReview.map((p) => p.id), ['breathefree-inhaler']);
});

test('presence: one per browser, idle visitors drop out, small numbers are not shown', async () => {
  let t = 1_000_000;
  const p = createPresence({ now: () => t });
  const a = { v: randomUUID() }, b = { ip: '10.0.0.2', ua: 'Firefox' }, c = { ip: '10.0.0.3', ua: 'Chrome' };
  p.beat(a, '/products/liver-booster'); p.beat(a, '/products/liver-booster');     // two tabs, same browser
  assert.equal(p.counts(null).site, 1);
  p.beat(b, '/products/liver-booster'); p.beat(c, '/shop');
  const { key } = p.beat(a, '/products/liver-booster');
  assert.deepEqual(p.counts(key, 'liver-booster'), { site: 3, others: 1 }, 'others excludes yourself');
  t += ACTIVE_MS + 1;
  p.beat(c, '/shop');
  assert.equal(p.counts(null).site, 1, 'idle visitors expire');

  // the API applies the minimums (3 site-wide, 2 others on a product)
  const r = await call('POST', '/api/presence', { path: '/shop' }, '');
  assert.deepEqual(r.body, { site: null, product: null });
  const bot = await call('POST', '/api/presence', { path: '/' }, '', { 'user-agent': 'Googlebot/2.1' });
  assert.equal(bot.status, 204);
  assert.equal((await call('GET', '/api/admin/presence')).body.total, 1);
});
