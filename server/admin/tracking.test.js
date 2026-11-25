// Visitor tracking, carts, wishlist, reminders, traffic report. In-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { classify, isBot, parseUa } from '../shop/track.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ENV = { ...TEST_TWILIO_ENV, ORDER_NOTIFICATIONS: 'sms', SITE_URL: 'https://shop.test' };
let app, db, sms, owner = '';

async function call(method, url, payload, cookie = owner, ua = CHROME) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, 'user-agent': ua } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
}
async function customer(phone, name) {
  await call('POST', '/api/auth/otp/request', { phone }, '');
  const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { phone, code: sms.codeFor(phone) } });
  const c = [].concat(v.headers['set-cookie']).map((x) => x.split(';')[0]).join('; ');
  await call('PATCH', '/api/account', { name }, c);
  return c;
}
const ev = (n, extra = {}) => ({ id: randomUUID(), n, ...extra });

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
  await db.query(`UPDATE inventory SET on_hand = 50`);
});
after(async () => { await app.close(); sms.restore(); });

test('helpers: bots, user agents, traffic sources', () => {
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBot('curl/8.4.0'), true);
  assert.equal(isBot(CHROME), false);
  assert.deepEqual(parseUa(CHROME), { device: 'mobile', browser: 'Chrome', os: 'Android' });
  assert.equal(classify({ utm: { source: 'Instagram', medium: 'paid' } }).source, 'instagram');
  assert.equal(classify({ share: true }).source, 'share');
  assert.equal(classify({ referrerHost: 'www.google.co.in' }).source, 'google');
  assert.equal(classify({ referrerHost: 'l.facebook.com' }).source, 'facebook');
  assert.equal(classify({}).source, 'direct');
});

test('ingest: consented visitor, anonymous views, bots dropped, duplicates stored once, other visitor cannot reuse a visit', async () => {
  const v = randomUUID(), s = randomUUID();
  const first = ev('page_view', { p: '/products/liver-booster' });
  const r = await call('POST', '/api/t', { v, s, ctx: { landing: '/products/liver-booster?utm_source=ig', utm: { source: 'instagram', campaign: 'diwali' } }, events: [first, ev('add_to_cart', { pid: 'liver-booster' })] }, '');
  assert.equal(r.status, 204);
  await call('POST', '/api/t', { v, s, events: [first] }, '');                      // retried send
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM events WHERE visitor_id = $1`, [v])).rows[0].n), 2);
  const visit = (await db.query('SELECT * FROM visits WHERE id = $1', [s])).rows[0];
  assert.equal(visit.source, 'instagram'); assert.equal(visit.campaign, 'diwali'); assert.equal(visit.is_new, true);
  assert.equal(visit.landing_path, '/products/liver-booster'); assert.equal(visit.device, 'mobile');
  const pv = (await db.query(`SELECT product_id FROM events WHERE event_id = $1`, [first.id])).rows[0];
  assert.equal(pv.product_id, 'liver-booster', 'product page view is linked to the product');

  // no consent: page views only, nothing identifying
  await call('POST', '/api/t', { events: [ev('page_view', { p: '/shop' }), ev('add_to_cart', { pid: 'liver-booster' })] }, '');
  const anon = (await db.query(`SELECT name FROM events WHERE visitor_id IS NULL`)).rows;
  assert.deepEqual(anon.map((x) => x.name), ['page_view']);

  // bots
  await call('POST', '/api/t', { v: randomUUID(), s: randomUUID(), events: [ev('page_view', { p: '/' })] }, '', 'Googlebot/2.1 (+http://www.google.com/bot.html)');
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM visitors')).rows[0].n), 1);

  // a second visit from the same browser is a returning visit
  const s2 = randomUUID();
  await call('POST', '/api/t', { v, s: s2, events: [ev('page_view', { p: '/' })] }, '');
  assert.equal((await db.query('SELECT is_new FROM visits WHERE id = $1', [s2])).rows[0].is_new, false);

  // someone else's visitor id cannot write into this visit
  await call('POST', '/api/t', { v: randomUUID(), s, events: [ev('page_view', { p: '/x' })] }, '');
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM events WHERE visit_id = $1`, [s])).rows[0].n), 2);

  assert.equal((await call('POST', '/api/t', { v, s, events: [{ id: randomUUID(), n: 'hack' }] }, '')).status, 400, 'unknown event names refused');
});

test('cart mirror -> abandoned -> checkout order closes it, attributed to the visit source; sign-in links history', async () => {
  const c = await customer('9811122233', 'Asha Kumar');
  const v = randomUUID(), s = randomUUID();
  await call('POST', '/api/t', { v, s, ctx: { share: true }, events: [ev('page_view', { p: '/products/reviva-roll-on' })] }, '');   // before sign-in
  await call('PUT', '/api/t/cart', { v, items: [{ id: 'reviva-roll-on', pack: 1, qty: 2 }] }, c);
  let cart = (await db.query('SELECT * FROM carts WHERE visitor_id = $1', [v])).rows[0];
  assert.equal(cart.item_count, 2); assert.equal(cart.value, 2 * 69900); assert.ok(cart.started_at);

  await call('POST', '/api/t', { v, s, events: [ev('begin_checkout')] }, c);
  cart = (await db.query('SELECT * FROM carts WHERE visitor_id = $1', [v])).rows[0];
  assert.ok(cart.checkout_at, 'checkout reached');
  const linked = Number((await db.query('SELECT COUNT(*) AS n FROM events WHERE visitor_id = $1 AND customer_id IS NOT NULL', [v])).rows[0].n);
  assert.equal(linked, 2, 'anonymous history now belongs to the customer');

  // abandoned (backdate) shows in the admin list, with the customer
  await db.query(`UPDATE carts SET updated_at = now() - interval '3 hours' WHERE visitor_id = $1`, [v]);
  const list = (await call('GET', '/api/admin/carts?status=abandoned')).body;
  assert.equal(list.counts.abandoned, 1); assert.equal(list.rows[0].customer, 'Asha Kumar'); assert.equal(list.rows[0].items[0].name.length > 0, true);
  assert.equal(list.rows[0].source, 'share');

  // reminder refused without consent, sent with it, never twice
  const id = list.rows[0].id;
  assert.equal((await call('POST', `/api/admin/carts/${id}/remind`, {})).status, 409);
  await call('PATCH', '/api/account', { name: 'Asha Kumar', marketingConsent: true }, c);
  assert.equal((await call('GET', '/api/auth/me', undefined, c)).body.customer.marketingConsent, true);
  const before = sms.sent.length;
  assert.equal((await call('POST', `/api/admin/carts/${id}/remind`, {})).status, 200);
  assert.equal(sms.sent.length, before + 1);
  assert.match(sms.sent.at(-1).Body, /Reviva/i);
  assert.match(sms.sent.at(-1).Body, /STOP/);
  assert.equal((await call('POST', `/api/admin/carts/${id}/remind`, {})).status, 409, 'one reminder per cart');

  // order placed from this visit closes the cart and records the source
  const o = await call('POST', '/api/checkout/place', { items: [{ id: 'reviva-roll-on', pack: 1, qty: 2 }], paymentMethod: 'cod', idempotencyKey: 'track-order-1', track: { v, s },
    address: { name: 'Asha Kumar', phone: '9811122233', line1: '1 MG Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' } }, c);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const order = (await db.query('SELECT visitor_id, visit_id, source FROM orders WHERE order_number = $1', [o.body.order.number])).rows[0];
  assert.equal(order.visitor_id, v); assert.equal(order.source, 'share');
  assert.ok((await db.query('SELECT order_id FROM carts WHERE visitor_id = $1', [v])).rows[0].order_id);

  // the browser empties the cart, then starts a new one: a fresh cart slot
  await call('PUT', '/api/t/cart', { v, items: [] }, c);
  await call('PUT', '/api/t/cart', { v, items: [{ id: 'liver-booster', pack: 1, qty: 1 }] }, c);
  cart = (await db.query('SELECT * FROM carts WHERE visitor_id = $1', [v])).rows[0];
  assert.equal(cart.order_id, null); assert.equal(cart.reminded_at, null); assert.equal(cart.checkout_at, null);

  // the traffic report sees all of it
  const t = (await call('GET', '/api/admin/traffic?range=7d')).body;
  assert.ok(t.current.visitors >= 2);
  assert.ok(t.current.pageViews >= 4);
  assert.equal(t.funnel.find((f) => f.key === 'bought').n, 1);
  assert.ok(t.sources.some((x) => x.source === 'share' && x.orders === 1));
  assert.ok(t.products.find((p) => p.id === 'reviva-roll-on').views >= 1);
  assert.equal(t.statuses.find((x) => x.status === 'confirmed').n, 1);
  const custom = (await call('GET', `/api/admin/traffic?range=custom&from=${new Date(Date.now() - 864e5).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`)).body;
  assert.equal(custom.range, 'custom');

  // the customer profile shows the activity
  const cid = (await db.query(`SELECT id FROM customers WHERE phone = '9811122233'`)).rows[0].id;
  const prof = (await call('GET', `/api/admin/customers/${cid}`)).body;
  assert.ok(prof.activity.visits >= 1); assert.ok(prof.timeline.length >= 1); assert.equal(prof.marketingConsent, true); assert.ok(prof.reorderDue);
  assert.equal(prof.reminders[0].kind, 'cart');

  // refill reminder for their last order
  assert.equal((await call('POST', `/api/admin/customers/${cid}/remind-reorder`, {})).status, 200);
  assert.match(sms.sent.at(-1).Body, /Reviva/i);

  // deleting the customer removes their browsing data
  assert.equal((await call('POST', `/api/admin/customers/${cid}/delete`, {})).status, 200);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM events WHERE visitor_id = $1', [v])).rows[0].n), 0);
  assert.equal((await db.query('SELECT 1 FROM visitors WHERE id = $1', [v])).rows.length, 0);
});

test('wishlist: signed-in only, merge from the browser, unknown products ignored', async () => {
  const c = await customer('9822233344', 'Ravi Menon');
  assert.equal((await call('GET', '/api/wishlist', undefined, '')).status, 401);
  assert.deepEqual((await call('POST', '/api/wishlist/merge', { ids: ['liver-booster', 'no-such-product'] }, c)).body.ids, ['liver-booster']);
  assert.deepEqual((await call('POST', '/api/wishlist', { productId: 'reviva-roll-on', on: true }, c)).body.ids.sort(), ['liver-booster', 'reviva-roll-on']);
  assert.deepEqual((await call('POST', '/api/wishlist', { productId: 'liver-booster', on: false }, c)).body.ids, ['reviva-roll-on']);
});

test('settings: reminder switches saved by an owner', async () => {
  const r = await call('PATCH', '/api/admin/settings', { reminders_cart: true, cart_reminder_hours: 6, reorder_days: 28 });
  assert.equal(r.status, 200);
  assert.equal(r.body.settings.reminders_cart, true); assert.equal(r.body.settings.reorder_days, 28);
});
