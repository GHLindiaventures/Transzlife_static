// Website content: announcement bar and homepage sections. In-memory Postgres (PGlite).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword } from './crypto.js';
import { TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { contrast } from '../shop/content.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let app, db, owner = '';
const iso = (ms) => new Date(Date.now() + ms).toISOString();

async function call(method, url, payload, cookie = owner) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
}
const site = async () => (await call('GET', '/api/site-content', undefined, '')).body;

before(async () => {
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ('o@x.test','Owner','owner',$1,false,true,$2)`,
    [await hashPassword('Pass-word-123'), SECRET]);
  const { totpCode } = await import('./crypto.js');
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'o@x.test', password: 'Pass-word-123', code: totpCode(SECRET, Math.floor(Date.now() / 30000)) } });
  owner = [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
});
after(async () => { await app.close(); });

test('contrast maths matches WCAG', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.ok(contrast('#124a2c', '#efc04a') >= 4.5, 'the current bar colours are readable');
  assert.ok(contrast('#ffff00', '#ffffff') < 2);
});

test('the bar fills in live shop settings, so it never disagrees with checkout', async () => {
  const s = await site();
  assert.equal(s.announcement.messages[0].text, 'Free delivery on orders over ₹999');
  assert.equal(s.announcement.messages[0].href, '/shop');
  assert.ok(s.announcement.messages.some((m) => m.text === 'Extra 5% off on prepaid orders'));
  await call('PATCH', '/api/admin/settings', { free_shipping_above: 149900, prepaid_discount_pct: 0 });
  const t = await site();
  assert.equal(t.announcement.messages[0].text, 'Free delivery on orders over ₹1,499');
  assert.ok(!t.announcement.messages.some((m) => /prepaid/.test(m.text)), 'no "0% off" message');
  assert.match(t.announcement.bg, /^#/);
  await call('PATCH', '/api/admin/settings', { free_shipping_above: 99900, prepaid_discount_pct: 5 });
});

test('messages: create, schedule, switch off, reorder, delete; links must be safe', async () => {
  assert.equal((await call('POST', '/api/admin/announcements', { text: 'Click me', linkUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('POST', '/api/admin/announcements', { text: 'Visit', linkUrl: '//evil.example' })).status, 400);
  const now = (await call('POST', '/api/admin/announcements', { text: 'Diwali offer: 20% off Reviva', linkUrl: '/products/reviva-roll-on' })).body.announcement;
  const later = (await call('POST', '/api/admin/announcements', { text: 'New Year sale starts soon', startsAt: iso(86400e3) })).body.announcement;
  assert.equal(later.status, 'scheduled');
  let texts = (await site()).announcement.messages.map((m) => m.text);
  assert.ok(texts.includes('Diwali offer: 20% off Reviva')); assert.ok(!texts.includes('New Year sale starts soon'));

  const all = (await call('GET', '/api/admin/content')).body.announcements;
  await call('PUT', '/api/admin/announcements/order', { ids: [now.id, ...all.filter((a) => a.id !== now.id).map((a) => a.id)] });
  assert.equal((await site()).announcement.messages[0].text, 'Diwali offer: 20% off Reviva');

  await call('PATCH', `/api/admin/announcements/${now.id}`, { text: now.text, linkUrl: now.linkUrl, active: false });
  texts = (await site()).announcement.messages.map((m) => m.text);
  assert.ok(!texts.includes('Diwali offer: 20% off Reviva'), 'switched off');
  assert.equal((await call('DELETE', `/api/admin/announcements/${later.id}`)).status, 200);
});

test('bar colours must be readable', async () => {
  const bad = await call('PUT', '/api/admin/announcements/style', { bg: '#ffff00', fg: '#ffffff', speed: 'normal' });
  assert.equal(bad.status, 400); assert.match(bad.body.error, /hard to read/);
  assert.equal((await call('PUT', '/api/admin/announcements/style', { bg: '#5b2a6e', fg: '#ffffff', speed: 'slow' })).status, 200);
  const s = await site();
  assert.equal(s.announcement.bg, '#5b2a6e'); assert.equal(s.announcement.speed, 'slow');
});

test('homepage: order, hide, headings and products per section', async () => {
  const cur = (await call('GET', '/api/admin/content')).body.sections;
  const products = cur.find((s) => s.key === 'products');
  const next = [{ ...products, title: 'Bestsellers this season', productIds: ['liver-booster', 'reviva-roll-on'] },
    ...cur.filter((s) => s.key !== 'products').map((s) => (s.key === 'brands' ? { ...s, visible: false } : s))];
  assert.equal((await call('PUT', '/api/admin/home', { sections: next.slice(1) })).status, 400, 'every section must be sent');
  assert.equal((await call('PUT', '/api/admin/home', { sections: next.map((s) => (s.key === 'products' ? { ...s, productIds: ['nope'] } : s)) })).status, 400);
  assert.equal((await call('PUT', '/api/admin/home', { sections: next })).status, 200);
  const home = (await site()).home.sections;
  assert.equal(home[0].key, 'products'); assert.equal(home[0].title, 'Bestsellers this season');
  assert.deepEqual(home[0].productIds, ['liver-booster', 'reviva-roll-on']);
  assert.equal(home.find((s) => s.key === 'brands').visible, false);
  const log = (await call('GET', '/api/admin/audit?entity=content')).body.rows;
  assert.ok(log.some((r) => r.action === 'content.home'));
});

test('search engines: robots.txt keeps private pages out, sitemap lists live products and pages', async () => {
  const robots = await app.inject({ method: 'GET', url: '/robots.txt', headers: { host: 'shop.example' } });
  assert.equal(robots.statusCode, 200);
  for (const p of ['/admin', '/checkout', '/account', '/api/']) assert.match(robots.body, new RegExp(`Disallow: ${p}`));
  assert.match(robots.body, /Sitemap: http:\/\/shop\.example\/sitemap\.xml/);
  const map = await app.inject({ method: 'GET', url: '/sitemap.xml', headers: { host: 'shop.example' } });
  assert.equal(map.statusCode, 200);
  assert.match(map.headers['content-type'], /xml/);
  assert.match(map.body, /<loc>http:\/\/shop\.example\/products\/liver-booster<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.match(map.body, /\/concerns\/liver</); assert.match(map.body, /\/journal\/liver-the-silent-worker</); assert.match(map.body, /\/policies\/privacy</);
  assert.ok(!/admin|checkout|account/.test(map.body));
});
