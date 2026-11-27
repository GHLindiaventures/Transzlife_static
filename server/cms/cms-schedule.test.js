// Blog CMS, scheduling and version history (Phase D), on an in-memory Postgres.   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, newTotpSecret, totpCode } from '../admin/crypto.js';
import { publishDuePosts } from './scheduler.js';
import { diffLines, docLines } from './render.js';

const ORIGIN = 'http://localhost:3000';
const ENV = { NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40) };
let app, db;
const jars = {};

async function call(jar, method, url, payload) {
  const res = await app.inject({ method, url, payload, headers: { origin: ORIGIN, host: 'localhost:3000', cookie: jars[jar] || '' } });
  const set = res.headers['set-cookie'];
  if (set) {
    const map = new Map((jars[jar] || '').split('; ').filter(Boolean).map((c) => c.split('=')));
    for (const c of [].concat(set)) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (v) map.set(k, v); else map.delete(k); }
    jars[jar] = [...map].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  let body; try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body };
}
async function signIn(jar, role) {
  const email = `${jar}@tranzlife.test`, password = `${jar}-Pass-2026`, secret = newTotpSecret();
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
    VALUES ($1, $2, $3, $4, false, $5, true)`, [email, jar, role, await hashPassword(password), secret]);
  assert.equal((await call(jar, 'POST', '/api/admin/auth/login', { email, password, code: totpCode(secret) })).status, 200);
}
const doc = (...texts) => ({ type: 'doc', content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) });
async function draft(title, slug, text = 'Some words here.') {
  const made = (await call('cm', 'POST', '/api/admin/cms/posts', {})).body.post;
  return (await call('cm', 'PATCH', `/api/admin/cms/posts/${made.id}`, { baseUpdatedAt: made.updatedAt, title, slug, content: doc(text) })).body.post;
}
const ist = (hoursFromNow) => {
  // an exact moment written the way the dashboard sends it (India time, +05:30)
  const d = new Date(Date.now() + hoursFromNow * 3_600_000 + 5.5 * 3_600_000);
  return `${d.toISOString().slice(0, 19)}+05:30`;
};

before(async () => {
  db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: ENV, db, logger: false });
  await signIn('cm', 'content_manager');
  await signIn('sup', 'support');
});
after(async () => { await app.close(); });

test('schedule: hidden until its time, exact to the minute, then marked published by the job', async () => {
  const d = await draft('Winter immunity tips', 'winter-immunity-tips');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/schedule`, { publishAt: ist(-1) })).status, 400, 'not in the past');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/schedule`, { publishAt: ist(24 * 400) })).status, 400, 'not more than a year ahead');
  assert.equal((await call('sup', 'POST', `/api/admin/cms/posts/${d.id}/schedule`, { publishAt: ist(2) })).status, 403);

  const s = await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/schedule`, { publishAt: ist(2) });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.post.status, 'scheduled');
  assert.equal(s.body.post.live, false);
  assert.ok(Math.abs(new Date(s.body.post.publishedAt) - (Date.now() + 2 * 3_600_000)) < 120_000, 'the +05:30 time is read correctly');
  assert.equal((await call('anon', 'GET', '/api/blog/posts/winter-immunity-tips')).status, 404, 'not public before its time');
  assert.doesNotMatch((await call('anon', 'GET', '/sitemap.xml')).body, /winter-immunity-tips/);

  // its time comes: public at once, even before the job runs
  await db.query(`UPDATE cms_posts SET published_at = now() - interval '1 second' WHERE id = $1`, [d.id]);
  assert.equal((await call('anon', 'GET', '/api/blog/posts/winter-immunity-tips')).status, 200);
  const done = await publishDuePosts(db, { log: { info() {} } });
  assert.deepEqual(done.map((p) => p.slug), ['winter-immunity-tips']);
  assert.equal((await db.query('SELECT status FROM cms_posts WHERE id = $1', [d.id])).rows[0].status, 'published');
  const last = (await db.query(`SELECT reason, staff_email FROM cms_revisions WHERE post_id = $1 ORDER BY id DESC LIMIT 1`, [d.id])).rows[0];
  assert.deepEqual(last, { reason: 'publish', staff_email: 'scheduler' });
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'cms.post_publish_scheduled' AND entity_id = $1`, [d.id])).rows[0].n, 1);
  assert.equal((await publishDuePosts(db, { log: { info() {} } })).length, 0, 'running again changes nothing');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/schedule`, { publishAt: ist(3) })).status, 409, 'a live article must be unpublished first');
});

test('schedule: clashes are reported, publish now and cancel work', async () => {
  const a = await draft('Article A', 'article-a');
  const b = await draft('Article B', 'article-b');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${a.id}/schedule`, { publishAt: ist(5) })).status, 200);
  const clash = await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/schedule`, { publishAt: ist(5.2) });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.code, 'clash');
  assert.match(clash.body.error, /“Article A” is already scheduled/);
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/schedule`, { publishAt: ist(5.2), allowClash: true })).status, 200, 'unless confirmed');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/schedule`, { publishAt: ist(9) })).status, 200, 'moving it away is fine');

  const now = await call('cm', 'POST', `/api/admin/cms/posts/${a.id}/publish`, {});
  assert.equal(now.body.post.status, 'published');
  assert.ok(Math.abs(new Date(now.body.post.publishedAt) - Date.now()) < 60_000, 'publish now = now, not the scheduled time');
  const cancel = await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/unpublish`, {});
  assert.equal(cancel.body.post.status, 'draft');
  assert.equal((await call('anon', 'GET', '/api/blog/posts/article-b')).status, 404);

  const empty = (await call('cm', 'POST', '/api/admin/cms/posts', { title: 'Empty' })).body.post;
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${empty.id}/schedule`, { publishAt: ist(4) })).status, 400, 'empty articles cannot be scheduled');
  await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/archive`, {});
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${b.id}/schedule`, { publishAt: ist(4) })).status, 409);
});

test('version history: list, read, restore keeps the current text and the URL', async () => {
  const d = await draft('Ginger tea', 'ginger-tea', 'First version of the text.');
  const v2 = (await call('cm', 'PATCH', `/api/admin/cms/posts/${d.id}`, { baseUpdatedAt: d.updatedAt, title: 'Ginger tea guide', content: doc('Second version.'), tags: ['Ginger'] })).body.post;
  const v3 = (await call('cm', 'PATCH', `/api/admin/cms/posts/${d.id}`, { baseUpdatedAt: v2.updatedAt, slug: 'ginger-tea-guide', content: doc('Third version.') })).body.post;

  const list = await call('cm', 'GET', `/api/admin/cms/posts/${d.id}/revisions`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.revisions.map((r) => r.reason), ['save', 'save', 'save', 'create'], 'newest first');
  const first = list.body.revisions[2];
  const one = await call('cm', 'GET', `/api/admin/cms/revisions/${first.id}`);
  assert.equal(one.body.revision.snapshot.title, 'Ginger tea');
  assert.deepEqual(docLines(one.body.revision.snapshot.content), ['First version of the text.']);

  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/restore-version`, { revisionId: first.id, baseUpdatedAt: d.updatedAt })).status, 409, 'a stale page cannot restore over newer work');
  const other = await draft('Other', 'other-article');
  const otherRev = (await call('cm', 'GET', `/api/admin/cms/posts/${other.id}/revisions`)).body.revisions[0];
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/restore-version`, { revisionId: otherRev.id, baseUpdatedAt: v3.updatedAt })).status, 404);
  assert.equal((await call('sup', 'POST', `/api/admin/cms/posts/${d.id}/restore-version`, { revisionId: first.id, baseUpdatedAt: v3.updatedAt })).status, 403);

  const r = await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/restore-version`, { revisionId: first.id, baseUpdatedAt: v3.updatedAt });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.post.title, 'Ginger tea');
  assert.deepEqual(docLines(r.body.post.content), ['First version of the text.']);
  assert.equal(r.body.post.slug, 'ginger-tea-guide', 'the URL is not changed by a restore');
  assert.deepEqual(r.body.post.tags, [], 'tags come back as they were');
  const after = (await call('cm', 'GET', `/api/admin/cms/posts/${d.id}/revisions`)).body.revisions;
  assert.deepEqual(after.slice(0, 2).map((x) => x.reason), ['restore', 'save'], 'the text before the restore is kept');
  const kept = (await call('cm', 'GET', `/api/admin/cms/revisions/${after[1].id}`)).body.revision.snapshot;
  assert.deepEqual(docLines(kept.content), ['Third version.'], 'so the restore can be undone');
  assert.match((await db.query('SELECT content_html FROM cms_posts WHERE id = $1', [d.id])).rows[0].content_html, /First version/);
});

test('comparing versions: readable lines and a line diff', () => {
  const lines = docLines({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Water' }] }] }] },
    { type: 'image', attrs: { src: '/a.jpg', alt: 'Tea', caption: 'Hot' } },
    { type: 'faq', content: [{ type: 'faqItem', attrs: { question: 'Safe?' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yes.' }] }] }] },
  ] });
  assert.deepEqual(lines, ['Heading 2: Why', '• Water', 'Photo: Tea (Hot)', 'Q: Safe?', 'A: Yes.']);
  assert.deepEqual(diffLines(['a', 'b', 'c'], ['a', 'x', 'c']), [
    { type: 'same', text: 'a' }, { type: 'removed', text: 'b' }, { type: 'added', text: 'x' }, { type: 'same', text: 'c' },
  ]);
});
