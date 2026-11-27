// Blog CMS, writing and publishing (Phase B), on an in-memory Postgres.   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, newTotpSecret, totpCode } from '../admin/crypto.js';

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
const doc = (...blocks) => ({ type: 'doc', content: blocks });
const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

/** New draft -> saved with the given fields. Returns the saved post. */
async function draft(fields) {
  const made = (await call('cm', 'POST', '/api/admin/cms/posts', {})).body.post;
  const r = await call('cm', 'PATCH', `/api/admin/cms/posts/${made.id}`, { baseUpdatedAt: made.updatedAt, ...fields });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.post;
}

before(async () => {
  db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: ENV, db, logger: false });
  await signIn('cm', 'content_manager');
  await signIn('sup', 'support');
});
after(async () => { await app.close(); });

test('write a draft: saves, cleans the document, keeps versions, refuses stale saves', async () => {
  const made = await call('cm', 'POST', '/api/admin/cms/posts', {});
  assert.equal(made.status, 200);
  const post = made.body.post;
  assert.equal(post.status, 'draft');
  assert.match(post.slug, /^draft-/);

  const content = doc(
    h2('Morning habits'),
    { type: 'paragraph', attrs: { style: 'color:red' }, content: [{ type: 'text', text: 'Drink water ', marks: [{ type: 'bold' }, { type: 'underline' }] },
      { type: 'text', text: 'first', marks: [{ type: 'link', attrs: { href: '/shop', target: '_blank', class: 'x' } }] }] },
    { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
  );
  const saved = await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, {
    baseUpdatedAt: post.updatedAt, title: 'Five morning habits', slug: 'five-morning-habits', excerpt: 'Small things that add up.',
    content, tags: ['Habits', 'habits', 'Water'], featured: true,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const s = saved.body.post;
  assert.equal(s.slug, 'five-morning-habits');
  assert.deepEqual(s.tags, ['Habits', 'Water'], 'tags are de-duplicated');
  assert.deepEqual(s.content.content[1], { type: 'paragraph', content: [
    { type: 'text', text: 'Drink water ', marks: [{ type: 'bold' }] },
    { type: 'text', text: 'first', marks: [{ type: 'link', attrs: { href: '/shop' } }] },
  ] }, 'unknown nodes, marks and attributes are dropped before saving');
  assert.equal(s.content.content.length, 2);
  const html = (await db.query('SELECT content_html FROM cms_posts WHERE id = $1', [post.id])).rows[0].content_html;
  assert.equal(html, '<h2 id="morning-habits">Morning habits</h2><p><strong>Drink water </strong><a href="/shop">first</a></p>');

  // a stale copy (another tab) cannot overwrite the newer one
  const stale = await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: post.updatedAt, title: 'Old tab' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'conflict');

  // autosaves keep at most one version per 10 minutes; a manual save always keeps one
  let base = s.updatedAt;
  for (const t of ['A', 'B', 'C']) base = (await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: base, autosave: true, title: `Five morning habits ${t}` })).body.post.updatedAt;
  const reasons = (await db.query('SELECT reason FROM cms_revisions WHERE post_id = $1 ORDER BY id', [post.id])).rows.map((r) => r.reason);
  assert.deepEqual(reasons, ['create', 'save']);

  // bad input is refused with a clear message
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: base, slug: 'Bad Slug!' })).status, 400);
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: base, featuredImage: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: base, slug: 'liver-the-silent-worker' })).status, 409, 'URLs are unique');
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/posts/${post.id}`, { baseUpdatedAt: base, sneaky: 1 })).status, 400, 'unknown fields are refused');
});

test('publish, unpublish, preview: drafts are never public', async () => {
  const empty = (await call('cm', 'POST', '/api/admin/cms/posts', { title: 'Nothing yet' })).body.post;
  const nope = await call('cm', 'POST', `/api/admin/cms/posts/${empty.id}/publish`, {});
  assert.equal(nope.status, 400);
  assert.match(nope.body.error, /body is empty/);

  const d = await draft({ title: 'Monsoon lung care', slug: 'monsoon-lung-care', excerpt: 'Damp air and your lungs.', content: doc(h2('Why'), p('Humidity and mould.')) });
  assert.equal((await call('anon', 'GET', '/api/blog/posts/monsoon-lung-care')).status, 404, 'a draft is not public');
  const prev = await call('cm', 'GET', `/api/admin/cms/posts/${d.id}/preview`);
  assert.equal(prev.status, 200);
  assert.match(prev.body.post.html, /Humidity and mould/);
  assert.equal((await call('anon', 'GET', `/api/admin/cms/posts/${d.id}/preview`)).status, 401, 'preview needs a staff sign-in');

  const pub = await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/publish`, {});
  assert.equal(pub.status, 200);
  assert.equal(pub.body.post.status, 'published');
  assert.equal(pub.body.post.live, true);
  const first = pub.body.post.publishedAt;
  assert.equal((await call('anon', 'GET', '/api/blog/posts/monsoon-lung-care')).status, 200);
  assert.match((await call('anon', 'GET', '/sitemap.xml')).body, /\/blogs\/monsoon-lung-care</);

  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/unpublish`, {})).status, 200);
  assert.equal((await call('anon', 'GET', '/api/blog/posts/monsoon-lung-care')).status, 404, 'unpublished = gone from the site');
  assert.doesNotMatch((await call('anon', 'GET', '/sitemap.xml')).body, /monsoon-lung-care/);
  const again = await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/publish`, {});
  assert.equal(again.body.post.publishedAt, first, 'republishing keeps the first publication date');

  assert.match((await call('anon', 'GET', '/robots.txt')).body, /Disallow: \/blog-preview\//);
  assert.equal((await call('sup', 'POST', '/api/admin/cms/posts', {})).status, 403, 'support cannot write articles');
  assert.equal((await call('sup', 'POST', `/api/admin/cms/posts/${d.id}/unpublish`, {})).status, 403);
});

test('changing a live address redirects the old one, without chains', async () => {
  const d = await draft({ title: 'Tulsi tea', slug: 'tulsi-tea', content: doc(p('Steep the leaves.')) });
  const live = (await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/publish`, {})).body.post;
  const one = (await call('cm', 'PATCH', `/api/admin/cms/posts/${d.id}`, { baseUpdatedAt: live.updatedAt, slug: 'tulsi-tea-guide' })).body.post;
  await call('cm', 'PATCH', `/api/admin/cms/posts/${d.id}`, { baseUpdatedAt: one.updatedAt, slug: 'how-to-make-tulsi-tea' });
  const redirects = (await db.query(`SELECT from_path, to_path FROM cms_redirects WHERE post_id = $1 ORDER BY from_path`, [d.id])).rows;
  assert.deepEqual(redirects, [
    { from_path: '/blogs/tulsi-tea', to_path: '/blogs/how-to-make-tulsi-tea' },
    { from_path: '/blogs/tulsi-tea-guide', to_path: '/blogs/how-to-make-tulsi-tea' },
  ]);
  assert.deepEqual((await call('anon', 'GET', '/api/blog/posts/tulsi-tea')).body, { redirect: '/blogs/how-to-make-tulsi-tea' });

  // a draft that was never live just changes its address
  const dr = await draft({ title: 'Ginger', slug: 'ginger' });
  await call('cm', 'PATCH', `/api/admin/cms/posts/${dr.id}`, { baseUpdatedAt: dr.updatedAt, slug: 'ginger-tea' });
  assert.equal((await db.query(`SELECT COUNT(*) AS n FROM cms_redirects WHERE post_id = $1`, [dr.id])).rows[0].n, 0);
});

test('duplicate, archive, delete and bulk actions', async () => {
  const d = await draft({ title: 'Sleep and energy', slug: 'sleep-and-energy', content: doc(p('Seven hours.')), tags: ['Sleep'] });
  const copy = await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/duplicate`, {});
  assert.equal(copy.status, 200);
  assert.equal(copy.body.post.title, 'Copy of Sleep and energy');
  assert.equal(copy.body.post.slug, 'sleep-and-energy-copy');
  assert.equal(copy.body.post.status, 'draft');
  assert.deepEqual(copy.body.post.tags, ['Sleep']);

  await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/publish`, {});
  const del = await call('cm', 'DELETE', `/api/admin/cms/posts/${d.id}`);
  assert.equal(del.status, 409, 'a live article must be unpublished before it can be deleted');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/archive`, {})).body.post.status, 'archived');
  assert.equal((await call('anon', 'GET', '/api/blog/posts/sleep-and-energy')).status, 404, 'archived = not public');
  assert.equal((await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/restore`, {})).body.post.status, 'draft');
  assert.equal((await call('cm', 'DELETE', `/api/admin/cms/posts/${d.id}`)).status, 200);
  assert.equal((await call('cm', 'GET', `/api/admin/cms/posts/${d.id}`)).status, 404);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM cms_revisions WHERE post_id = $1', [d.id])).rows[0].n, 0);

  const ready = await draft({ title: 'Ready one', content: doc(p('Words here.')) });
  const empty = (await call('cm', 'POST', '/api/admin/cms/posts', { title: 'Empty one' })).body.post;
  const bulk = await call('cm', 'POST', '/api/admin/cms/posts/bulk', { ids: [ready.id, empty.id], action: 'publish' });
  assert.equal(bulk.status, 200);
  assert.equal(bulk.body.done, 1);
  assert.equal(bulk.body.skipped.length, 1);
  assert.equal(bulk.body.skipped[0].title, 'Empty one');
  const cat = (await db.query(`SELECT id FROM cms_categories WHERE slug = 'quit-smoking'`)).rows[0].id;
  const moved = await call('cm', 'POST', '/api/admin/cms/posts/bulk', { ids: [ready.id, empty.id], action: 'category', categoryId: cat });
  assert.equal(moved.body.done, 2);
  assert.equal((await call('sup', 'POST', '/api/admin/cms/posts/bulk', { ids: [ready.id], action: 'archive' })).status, 403);
});

test('categories, tags and bylines', async () => {
  const c = await call('cm', 'POST', '/api/admin/cms/categories', { name: 'Everyday Wellness', description: 'Small daily habits.' });
  assert.equal(c.status, 200);
  assert.equal(c.body.category.slug, 'everyday-wellness');
  assert.equal((await call('cm', 'POST', '/api/admin/cms/categories', { name: 'Everyday Wellness' })).status, 409);
  const d = await draft({ title: 'Walk after meals', content: doc(p('Ten minutes.')), categoryId: c.body.category.id });
  await call('cm', 'POST', `/api/admin/cms/posts/${d.id}/publish`, {});
  const cats = (await call('anon', 'GET', '/api/blog/categories')).body.categories;
  assert.ok(cats.some((x) => x.slug === 'everyday-wellness' && x.posts === 1), 'a new category with a live article appears on the site');
  assert.equal((await call('cm', 'DELETE', `/api/admin/cms/categories/${c.body.category.id}`)).status, 200);
  assert.equal((await db.query('SELECT category_id FROM cms_posts WHERE id = $1', [d.id])).rows[0].category_id, null, 'its articles keep everything else');

  const a = await call('cm', 'POST', '/api/admin/cms/authors', { name: 'Dr. Meena Rao', title: 'Nutritionist', avatarUrl: 'javascript:x' });
  assert.equal(a.status, 400);
  const a2 = await call('cm', 'POST', '/api/admin/cms/authors', { name: 'Dr. Meena Rao', title: 'Nutritionist' });
  assert.equal(a2.status, 200);
  const withAuthor = await draft({ title: 'Iron-rich foods', content: doc(p('Greens.')), authorId: a2.body.author.id });
  await call('cm', 'POST', `/api/admin/cms/posts/${withAuthor.id}/publish`, {});
  assert.deepEqual((await call('anon', 'GET', `/api/blog/posts/${withAuthor.slug}`)).body.post.author.name, 'Dr. Meena Rao');

  const t = await call('cm', 'POST', '/api/admin/cms/tags', { name: 'Monsoon' });
  assert.equal(t.status, 200);
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/tags/${t.body.tag.id}`, { name: 'Monsoon care' })).body.tag.name, 'Monsoon care');
  assert.equal((await call('sup', 'POST', '/api/admin/cms/tags', { name: 'Nope' })).status, 403);
});
