// Contact form + newsletter endpoints, on an in-memory Postgres (PGlite).   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';
import { TEST_TWILIO_ENV } from './test-twilio.js';

const ORIGIN = 'http://localhost:3000';
let app, db;
let ip = 1;   // a fresh client address per test, so the per-IP rate limit only bites where we test it

const call = (url, payload, { origin = ORIGIN, from } = {}) => app.inject({
  method: 'POST', url, payload,
  headers: { origin, host: 'localhost:3000' },
  remoteAddress: from || `10.1.0.${ip}`,
}).then((r) => ({ status: r.statusCode, body: r.json() }));

const GOOD = { name: 'Test Visitor', email: 'Visitor@Example.com', phone: '+91 98765 43210', topic: 'Product question', message: 'Hello', consent: true };

before(async () => {
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
});
after(async () => { await app.close(); });

test('a valid enquiry is stored, normalised', async () => {
  ip++;
  const r = await call('/api/contact', GOOD);
  assert.equal(r.status, 200);
  const { rows } = await db.query('SELECT name, email, phone, topic FROM contact_messages');
  assert.deepEqual(rows.at(-1), { name: 'Test Visitor', email: 'visitor@example.com', phone: '9876543210', topic: 'Product question' });
});

test('invalid enquiries are refused with a readable message', async () => {
  ip++;
  assert.equal((await call('/api/contact', { ...GOOD, email: 'nope' })).status, 400);
  assert.equal((await call('/api/contact', { ...GOOD, phone: '12345' })).status, 400);
  const noConsent = await call('/api/contact', { ...GOOD, consent: false });
  assert.equal(noConsent.status, 400);
  assert.match(noConsent.body.error, /Privacy Policy/);
  assert.equal((await call('/api/contact', { ...GOOD, message: 'x'.repeat(1501) })).status, 400);
});

test('honeypot submissions look accepted but are not stored', async () => {
  ip++;
  const before = (await db.query('SELECT count(*)::int AS n FROM contact_messages')).rows[0].n;
  const r = await call('/api/contact', { ...GOOD, website: 'http://spam.example' });
  assert.equal(r.status, 200);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM contact_messages')).rows[0].n, before);
});

test('cross-site posts are blocked', async () => {
  ip++;
  assert.equal((await call('/api/contact', GOOD, { origin: 'https://evil.example' })).status, 403);
});

test('the contact form is rate limited per address', async () => {
  const from = '10.9.9.9';
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call('/api/contact', GOOD, { from })).status);
  assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200]);
  assert.equal(codes[5], 429);
});

test('newsletter: sign-up is stored once, repeats are fine', async () => {
  ip++;
  assert.equal((await call('/api/newsletter', { email: 'Reader@Example.com', source: 'home' })).status, 200);
  assert.equal((await call('/api/newsletter', { email: 'reader@example.com' })).status, 200);
  const { rows } = await db.query("SELECT email, source FROM newsletter_subscribers WHERE email = 'reader@example.com'");
  assert.deepEqual(rows, [{ email: 'reader@example.com', source: 'home' }]);
  assert.equal((await call('/api/newsletter', { email: 'bad' })).status, 400);
});
