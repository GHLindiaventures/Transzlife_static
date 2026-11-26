// Ingredient library, product label/batch info, compliance centre. In-memory Postgres.   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { createMedia } from '../shop/media.js';
import { hashPassword, totpCode } from './crypto.js';
import { TEST_TWILIO_ENV } from '../shop/test-twilio.js';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
let app, db, owner = '', manager = '';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
async function call(method, url, payload, cookie = owner, headers = {}) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie, ...headers } });
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body };
}
async function login(email, role, step) {
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_enabled, totp_secret) VALUES ($1,$2,$3,$4,false,true,$5)`, [email, role, role, await hashPassword('Pass-word-123'), SECRET]);
  const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { origin: ORIGIN, host: 'localhost:3000' }, payload: { email, password: 'Pass-word-123', code: totpCode(SECRET, step) } });
  return [].concat(r.headers['set-cookie']).map((c) => c.split(';')[0]).join('; ');
}

before(async () => {
  db = await createDb(TEST_TWILIO_ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: TEST_TWILIO_ENV, db, logger: false });
  const step = Math.floor(Date.now() / 30000);
  owner = await login('o@x.test', 'owner', step);
  manager = await login('m@x.test', 'manager', step - 1);
});
after(async () => { await app.close(); });

test('ingredient library: seeded from the site, edit, hide, add, delete rules', async () => {
  const pub = (await call('GET', '/api/ingredients', undefined, '')).body.ingredients;
  assert.equal(pub.length, 41);   // per the client product document (Nov 2026)
  assert.equal(pub.find((g) => g.id === 'tulsi').latin, 'Ocimum sanctum');
  const admin = (await call('GET', '/api/admin/ingredients')).body.ingredients;
  assert.ok(admin.find((g) => g.id === 'tulsi').used_in.some((p) => p.id === 'pulmoclear-gummies'), 'shows which products use it');

  assert.equal((await call('PATCH', '/api/admin/ingredients/tulsi', { note: 'Queen of herbs, used in kadha.' })).status, 200);
  assert.equal((await call('GET', '/api/ingredients', undefined, '')).body.ingredients.find((g) => g.id === 'tulsi').note, 'Queen of herbs, used in kadha.');

  const del = await call('DELETE', '/api/admin/ingredients/tulsi', {});
  assert.equal(del.status, 409, 'used by products: cannot delete');
  assert.match(del.body.error, /PulmoClear/);

  const add = await call('POST', '/api/admin/ingredients', { name: 'Ashwagandha', latin: 'Withania somnifera', type: 'herb', part: 'Root' });
  assert.equal(add.body.id, 'ashwagandha');
  await call('PATCH', '/api/admin/ingredients/ashwagandha', { active: false });
  assert.ok(!(await call('GET', '/api/ingredients', undefined, '')).body.ingredients.some((g) => g.id === 'ashwagandha'), 'hidden from the site');
  assert.equal((await call('DELETE', '/api/admin/ingredients/ashwagandha', {})).status, 200, 'unused: can delete');
  assert.equal((await call('POST', '/api/admin/ingredients/tulsi/photo', Buffer.from('x'), owner, { 'content-type': 'image/jpeg' })).status, 503, 'no storage in tests');
});

test('product pages get the batch a customer will receive (soonest expiry in stock)', async () => {
  assert.equal((await call('GET', '/api/products/liver-booster', undefined, '')).body.product.batch, null);
  await call('POST', '/api/admin/products/liver-booster/batches', { batchNo: 'LB-LATE', mfgDate: day(-10), expiryDate: day(700), qty: 5 });
  await call('POST', '/api/admin/products/liver-booster/batches', { batchNo: 'LB-SOON', mfgDate: day(-200), expiryDate: day(300), qty: 5 });
  const b = (await call('GET', '/api/products/liver-booster', undefined, '')).body.product.batch;
  assert.equal(new Date(b.expiry).toISOString().slice(0, 10), day(300));
  assert.equal(new Date(b.mfg).toISOString().slice(0, 10), day(-200));
});

test('compliance centre: expiry status, reminders, date checks, permissions', async () => {
  assert.equal((await call('POST', '/api/admin/certificates', { name: 'Bad dates', kind: 'licence', issuedOn: day(10), expiresOn: day(5) })).status, 400);
  const lic = await call('POST', '/api/admin/certificates', { name: 'AYUSH manufacturing licence', kind: 'licence', issuer: 'Directorate of Indian Medicine', number: 'TN-AY-123', issuedOn: day(-700), expiresOn: day(30) }, manager);
  assert.equal(lic.status, 200);
  await call('POST', '/api/admin/certificates', { name: 'GMP certificate', kind: 'certificate', expiresOn: day(-3) });
  await call('POST', '/api/admin/certificates', { name: 'ISO 9001:2015', kind: 'certificate', expiresOn: day(400) });
  await call('POST', '/api/admin/certificates', { name: 'DPIIT recognition', kind: 'registration' });
  const list = (await call('GET', '/api/admin/certificates')).body.certificates;
  const st = Object.fromEntries(list.map((c) => [c.name, c.status]));
  assert.deepEqual(st, { 'GMP certificate': 'expired', 'AYUSH manufacturing licence': 'expiring', 'ISO 9001:2015': 'valid', 'DPIIT recognition': 'no_expiry' });
  assert.equal(list.find((c) => c.name.startsWith('AYUSH')).daysLeft, 30);

  const alerts = (await call('GET', '/api/admin/alerts')).body.items;
  assert.match(alerts.find((a) => a.key === 'certs_due').detail, /AYUSH manufacturing licence \(30 days\)/);
  assert.match(alerts.find((a) => a.key === 'certs_expired').detail, /GMP certificate/);

  const pr = await call('PATCH', `/api/admin/certificates/${lic.body.id}`, { expiresOn: day(800), number: 'TN-AY-124' });
  assert.equal(pr.status, 200, JSON.stringify(pr.body));
  assert.equal((await call('GET', '/api/admin/certificates')).body.certificates.find((c) => c.id === lic.body.id).status, 'valid');
  assert.equal((await call('POST', `/api/admin/certificates/${lic.body.id}/document`, Buffer.from('%PDF-1.4 x'), owner, { 'content-type': 'application/pdf' })).status, 503, 'no storage in tests');
  assert.equal((await call('GET', `/api/admin/certificates/${lic.body.id}/document`)).status, 404, 'nothing uploaded');
  assert.equal((await call('DELETE', `/api/admin/certificates/${lic.body.id}`, {}, manager)).status, 403, 'only an owner deletes');
  assert.equal((await call('DELETE', `/api/admin/certificates/${lic.body.id}`, {})).status, 200);
  const log = (await call('GET', '/api/admin/audit?entity=certificate')).body.rows.map((r) => r.action);
  assert.ok(log.includes('certificate.create') && log.includes('certificate.update') && log.includes('certificate.delete'));
});

test('documents: only real PDFs / images are accepted (checked by their first bytes)', async () => {
  const m = createMedia({ AWS_ENDPOINT_URL_S3: 'http://127.0.0.1:9', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' }, { log: {} });
  await assert.rejects(m.putDocument(Buffer.from('<html>not a pdf</html>'), 'application/pdf'), /does not look like a real PDF/);
  await assert.rejects(m.putDocument(Buffer.from('GIF89a'), 'image/gif'), /PDF, JPG or PNG/);
  await assert.rejects(m.putDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/jpeg'), /does not look like/);
});
