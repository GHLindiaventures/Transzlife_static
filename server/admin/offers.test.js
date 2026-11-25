// Pricing & offers, badges with truth rules, pack discounts, shared date ranges. In-memory Postgres.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword } from './crypto.js';
import { installTestTwilio, TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { priceWith, resolveBadge } from '../shop/offers.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let app, db, sms, owner = '';
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const H = 3600e3, D = 86400e3;

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
const product = async (id) => (await call('GET', `/api/products/${id}`, undefined, '')).body.product;
const offer = (o) => call('POST', '/api/admin/offers', { kind: 'sale', productIds: [], discountType: 'percent', value: 10, startsAt: iso(-H), endsAt: iso(D), ...o });

before(async () => {
  sms = installTestTwilio();
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','Owner','owner',$1,false,true,$2)`,
    [await hashPassword('Pass-word-123'), SECRET]);
  const { totpCode } = await import('./crypto.js');
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode(SECRET, Math.floor(Date.now() / 30000)) } });
  owner = [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
  await db.query('UPDATE inventory SET on_hand = 100');
});
after(async () => { await app.close(); sms.restore(); });

test('offer maths: whole rupees, never above the regular price, never below ₹1', () => {
  assert.equal(priceWith({ discount_type: 'percent', value: 15 }, 69900), 59400);       // 594.15 -> ₹594
  assert.equal(priceWith({ discount_type: 'flat', value: 5000 }, 90000), 85000);
  assert.equal(priceWith({ discount_type: 'price', value: 120000 }, 90000), 90000, 'a "price" above the regular price changes nothing');
  assert.equal(priceWith({ discount_type: 'flat', value: 999999 }, 90000), 100);
});

test('selling price can never be set above the MRP', async () => {
  const r = await call('PATCH', '/api/admin/pricing/liver-booster', { price: 95000, mrp: 90000 });
  assert.equal(r.status, 400); assert.match(r.body.error, /MRP/);
});

test('a running offer lowers the price everywhere: catalogue, checkout, order record, discount record', async () => {
  const before = await product('reviva-roll-on');
  assert.equal(before.price, 699); assert.equal(before.offer, null);
  const o = await offer({ name: 'Diwali offer', productIds: ['reviva-roll-on'], discountType: 'percent', value: 20, badge: 'hot_deal' });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const p = await product('reviva-roll-on');
  assert.equal(p.price, 559); assert.equal(p.mrp, 699, 'the struck price stays the MRP'); assert.equal(p.regularPrice, 699);
  assert.equal(p.offer.name, 'Diwali offer'); assert.equal(p.badge, 'Hot deal');

  const c = await customer('9811100011', 'Offer Buyer');
  const q = (await call('POST', '/api/checkout/quote', { items: [{ id: 'reviva-roll-on', pack: 2, qty: 1 }], paymentMethod: 'upi' }, c)).body;
  assert.equal(q.lines[0].unit, 106200, '2-pack at the offer price: 559 × 2 × 0.95 = 1062');
  const placed = await call('POST', '/api/checkout/place', { items: [{ id: 'reviva-roll-on', pack: 2, qty: 1 }], paymentMethod: 'cod', idempotencyKey: 'offer-order-1',
    address: { name: 'Offer Buyer', phone: '9811100011', line1: '2 Beach Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' } }, c);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const item = (await db.query(`SELECT i.unit_price, i.list_price, i.offer_id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.order_number = $1`, [placed.body.order.number])).rows[0];
  assert.equal(item.unit_price, 106200); assert.equal(item.list_price, 132800); assert.equal(item.offer_id, o.body.offer.id);
  const disc = (await db.query(`SELECT kind, amount FROM order_discounts d JOIN orders o ON o.id = d.order_id WHERE o.order_number = $1 ORDER BY kind`, [placed.body.order.number])).rows;
  assert.deepEqual(disc.map((d) => [d.kind, d.amount]), [['offer', 26600], ['pack', 5600]]);
  const admin = (await call('GET', '/api/admin/pricing')).body;
  assert.equal(admin.offers.find((x) => x.name === 'Diwali offer').used.orders, 1);
});

test('scheduled and ended offers do nothing; overlapping offers: the lowest price wins', async () => {
  await offer({ name: 'Next week', productIds: ['energy-booster'], value: 50, startsAt: iso(7 * D), endsAt: iso(8 * D) });
  assert.equal((await product('energy-booster')).price, 1850, 'not started yet');
  await offer({ name: 'Ten off', productIds: ['energy-booster'], value: 10 });
  await offer({ name: 'Flat 300', productIds: ['energy-booster'], discountType: 'flat', value: 30000 });
  const p = await product('energy-booster');
  assert.equal(p.price, 1550); assert.equal(p.offer.name, 'Flat 300');
  const id = (await call('GET', '/api/admin/pricing')).body.offers.find((x) => x.name === 'Flat 300').id;
  const o = (await db.query('SELECT * FROM offers WHERE id = $1', [id])).rows[0];
  await call('PATCH', `/api/admin/offers/${id}`, { name: o.name, kind: 'sale', productIds: o.product_ids, discountType: 'flat', value: 30000, startsAt: iso(-2 * D), endsAt: iso(-D), showCountdown: false });
  assert.equal((await product('energy-booster')).price, 1665, 'ended: back to the 10% offer');
  assert.equal((await call('DELETE', `/api/admin/offers/${id}`)).status, 409, 'already ran: switch off, not delete');
  const sched = (await call('GET', '/api/admin/pricing')).body.offers.find((x) => x.name === 'Next week');
  assert.equal(sched.status, 'scheduled');
  assert.equal((await call('DELETE', `/api/admin/offers/${sched.id}`)).status, 200);
});

test('offers that change nothing, too-long flash sales and bad percentages are refused', async () => {
  assert.equal((await offer({ name: 'Useless', productIds: ['cyclerelief-roll-on'], discountType: 'price', value: 99900 })).status, 400);
  assert.equal((await offer({ name: 'Mega flash', kind: 'flash', endsAt: iso(10 * D) })).status, 400);
  assert.equal((await offer({ name: 'Too much', value: 95 })).status, 400);
  assert.equal((await offer({ name: 'Backwards', startsAt: iso(D), endsAt: iso(H) })).status, 400);
});

test('badges only claim what is true', async () => {
  // offer badges need a running offer
  await call('PATCH', '/api/admin/pricing/cyclerelief-roll-on', { badge: { key: 'limited_offer', enabled: true } });
  assert.equal((await product('cyclerelief-roll-on')).badge, null);
  const row = (await call('GET', '/api/admin/pricing')).body.products.find((p) => p.id === 'cyclerelief-roll-on');
  assert.match(row.badgeProblem, /offer is running/);
  // NEW ARRIVAL switches itself off after 30 days
  await call('PATCH', '/api/admin/pricing/pulmoclear-gummies', { badge: { key: 'new_arrival', enabled: true } });
  assert.equal((await product('pulmoclear-gummies')).badge, 'New arrival');
  await db.query(`UPDATE products SET badge_config = jsonb_set(badge_config, '{startsAt}', to_jsonb((now() - interval '31 days')::text)) WHERE id = 'pulmoclear-gummies'`);
  assert.equal((await product('pulmoclear-gummies')).badge, null);
  // custom text, with a colour from the safe presets only
  assert.equal((await call('PATCH', '/api/admin/pricing/liver-booster', { badge: { key: 'custom', text: 'Doctor\'s pick', tone: 'neon', enabled: true } })).status, 400);
  await call('PATCH', '/api/admin/pricing/liver-booster', { badge: { key: 'custom', text: 'Ayurvedic', tone: 'gold', enabled: true } });
  const lb = await product('liver-booster');
  assert.equal(lb.badge, 'Ayurvedic'); assert.equal(lb.badgeStyle.bg, '#8a5a00');
  // BEST SELLER can't be chosen by hand; it comes from real sales
  assert.equal((await call('PATCH', '/api/admin/pricing/energy-booster', { badge: { key: 'best_seller', enabled: true } })).status, 400);
  const facts = { bestSellers: new Set(['energy-booster']), trending: new Set() };
  assert.equal(resolveBadge({ id: 'energy-booster', badge_config: null }, null, facts).text, 'Best seller');
  assert.equal(resolveBadge({ id: 'energy-booster', badge_config: { key: 'custom', text: 'x', enabled: false, auto: false } }, null, facts), null, 'auto badges can be switched off');
});

test('pack discounts are editable, reach the site and the checkout', async () => {
  assert.equal((await call('PUT', '/api/admin/packs', { packs: [{ qty: 2, label: 'Pack of 2', discountPct: 8 }] })).status, 400, 'pack of 1 is required');
  assert.equal((await call('PUT', '/api/admin/packs', { packs: [{ qty: 1, label: 'Pack of 1', discountPct: 0 }, { qty: 2, label: 'Pack of 2', discountPct: 8 }] })).status, 200);
  const site = (await call('GET', '/api/products', undefined, '')).body;
  assert.deepEqual(site.packs.map((k) => [k.qty, k.off]), [[1, 0], [2, 0.08]]);
  assert.equal(site.shop.prepaidDiscount, 0.05);
  const c = await customer('9811100012', 'Pack Buyer');
  const q = (await call('POST', '/api/checkout/quote', { items: [{ id: 'liver-booster', pack: 2, qty: 1 }] }, c)).body;
  assert.equal(q.lines[0].unit, 165600, '900 × 2 × 0.92');
  assert.equal((await call('POST', '/api/checkout/quote', { items: [{ id: 'liver-booster', pack: 3, qty: 1 }] }, c)).status, 400, 'removed pack size');
});

test('shared date ranges work on every report', async () => {
  const today = new Date(Date.now() + 5.5 * H).toISOString().slice(0, 10);
  for (const url of ['/api/admin/overview', '/api/admin/analytics', '/api/admin/traffic']) {
    for (const qs of ['range=month', 'range=365d', `range=custom&from=${today}&to=${today}`]) {
      const r = await call('GET', `${url}?${qs}`);
      assert.equal(r.status, 200, `${url}?${qs}: ${JSON.stringify(r.body).slice(0, 200)}`);
      assert.equal(r.body.range, qs.split('&')[0].split('=')[1]);
    }
  }
  assert.equal((await call('GET', '/api/admin/overview?range=custom&from=2026-02-30&to=x')).body.range, '30d', 'bad dates fall back');
});
