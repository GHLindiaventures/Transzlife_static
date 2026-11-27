// Blog CMS tests on an in-memory Postgres (PGlite).   npm run test:api
//   - the old articles are imported once, with their URLs, dates and content intact
//   - the public API and the sitemap only ever show published posts
//   - the article HTML renderer cannot output scripts, event handlers or unsafe links
//   - the content manager role can use the CMS and website copy, and is refused EVERY shop route
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, newTotpSecret, totpCode } from '../admin/crypto.js';
import { importLegacyArticles, legacyToDoc } from './legacy.js';
import { renderDoc, safeUrl, slugify } from './render.js';
import { ARTICLES } from '../../src/store/data/articles.js';

const ORIGIN = 'http://localhost:3000';
const ENV = { NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40) };
const quiet = { info() {}, log() {}, warn() {}, error() {} };
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
  return { status: res.statusCode, body, headers: res.headers };
}

/** A fully set-up staff account (password changed, 2FA on), signed in under `jar`. */
async function signIn(jar, role) {
  const email = `${jar}@tranzlife.test`, password = `${jar}-Pass-2026`, secret = newTotpSecret();
  await db.query(`INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
    VALUES ($1, $2, $3, $4, false, $5, true)`, [email, jar, role, await hashPassword(password), secret]);
  const r = await call(jar, 'POST', '/api/admin/auth/login', { email, password, code: totpCode(secret) });
  assert.equal(r.status, 200, `${role} signs in`);
  return r.body.staff;
}

before(async () => {
  db = await createDb(ENV, { memory: true, log: quiet });
  app = await buildShopApp({ env: ENV, db, logger: false });
});
after(async () => { await app.close(); });

test('the old articles are imported once, with the same URLs, dates, categories and content', async () => {
  const { rows } = await db.query(`SELECT p.slug, p.title, p.status, p.published_at, p.reading_minutes, p.concern, p.content_html, c.name AS category
    FROM cms_posts p LEFT JOIN cms_categories c ON c.id = p.category_id`);
  assert.equal(rows.length, ARTICLES.length);
  const by = new Map(rows.map((r) => [r.slug, r]));
  for (const a of ARTICLES) {
    const p = by.get(a.id);
    assert.ok(p, `${a.id} keeps its URL`);
    assert.equal(p.title, a.title);
    assert.equal(p.status, 'published');
    assert.equal(p.category, a.category);
    assert.equal(p.concern, a.concern);
    assert.equal(new Date(p.published_at).toISOString(), new Date(`${a.date}T00:00:00+05:30`).toISOString());
    assert.equal(`${p.reading_minutes} min read`, a.readTime);
    for (const [heading] of a.sections) assert.ok(p.content_html.includes('>' + heading.replace(/&/g, '&amp;').replace(/'/g, '&#39;') + '<'), `${a.id}: heading "${heading}" kept`);
    for (const f of a.figures || []) assert.ok(p.content_html.includes(f.src.replace(/&/g, '&amp;')), `${a.id}: photo kept`);
  }
  const quit = by.get('quit-smoking-naturally-herbal-ayurvedic').content_html;
  assert.match(quit, /<dl class="article__faq">/);
  assert.match(quit, /<div class="article__table"><table><thead><tr><th scope="col">Week<\/th>/);
  assert.match(quit, /<div class="article__cta">.*<a href="\/products\/breathefree-inhaler" class="btn">/);
  assert.match(quit, /<strong>natural ways to quit smoking<\/strong>/);
  const revisions = Number((await db.query(`SELECT COUNT(*) AS n FROM cms_revisions WHERE reason = 'import'`)).rows[0].n);
  assert.equal(revisions, ARTICLES.length, 'each imported article starts with a revision');
  // a second start does nothing
  assert.equal(await importLegacyArticles(db, { log: quiet }), 0);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM cms_posts')).rows[0].n), ARTICLES.length);
});

test('public API and sitemap show published posts only (never drafts, future, archived or noindex)', async () => {
  const cat = (await db.query(`SELECT id FROM cms_categories ORDER BY sort LIMIT 1`)).rows[0].id;
  const add = (slug, status, when, seo = {}) => db.query(`INSERT INTO cms_posts (slug, title, status, published_at, category_id, seo, content_html)
    VALUES ($1, $1, $2, ${when}, $3, $4::jsonb, '<p>x</p>')`, [slug, status, cat, JSON.stringify(seo)]);
  await add('t-draft', 'draft', 'NULL');
  await add('t-future', 'scheduled', `now() + interval '2 days'`);
  await add('t-due', 'scheduled', `now() - interval '1 minute'`);
  await add('t-archived', 'archived', `now() - interval '9 days'`);
  await add('t-hidden', 'published', `now() - interval '1 day'`, { robots: { index: false } });

  const list = await call('anon', 'GET', '/api/blog/posts?limit=100');
  assert.equal(list.status, 200);
  const slugs = list.body.posts.map((p) => p.slug);
  assert.ok(slugs.includes('t-due'), 'a scheduled post goes live at its time');
  assert.ok(slugs.includes('t-hidden'), 'noindex posts are still readable');
  for (const s of ['t-draft', 't-future', 't-archived']) assert.ok(!slugs.includes(s), `${s} is not listed`);
  assert.equal(list.body.total, ARTICLES.length + 2);
  for (const s of ['t-draft', 't-future', 't-archived']) assert.equal((await call('anon', 'GET', `/api/blog/posts/${s}`)).status, 404, `${s} cannot be opened`);
  assert.equal((await call('anon', 'GET', '/api/blog/posts/t-due')).status, 200);

  const one = await call('anon', 'GET', '/api/blog/posts/liver-the-silent-worker');
  assert.equal(one.status, 200);
  assert.equal(one.body.post.slug, 'liver-the-silent-worker');
  assert.equal(one.body.related.length, 3);
  assert.equal(one.body.related[0].concern, 'liver', 'related posts share the topic first');
  assert.ok(!('content' in one.body.post) && !('id' in one.body.post), 'the editor document and ids stay private');

  const byCat = await call('anon', 'GET', '/api/blog/posts?category=liver-and-digestion');
  assert.ok(byCat.body.posts.length > 0 && byCat.body.posts.every((p) => p.category.slug === 'liver-and-digestion'));
  assert.equal((await call('anon', 'GET', '/api/blog/posts?category=Bad%20Value')).status, 400);
  assert.equal((await call('anon', 'GET', '/api/blog/posts/..%2F..%2Fetc')).status, 404);

  const sm = await call('anon', 'GET', '/sitemap.xml');
  assert.match(sm.body, /\/blogs\/quit-smoking-naturally-herbal-ayurvedic<\/loc><lastmod>2026-11-2\d<\/lastmod>/);
  assert.match(sm.body, /\/blogs\/t-due</);
  for (const s of ['t-draft', 't-future', 't-archived', 't-hidden']) assert.doesNotMatch(sm.body, new RegExp(`/blogs/${s}<`), `${s} is not in the sitemap`);

  await db.query(`DELETE FROM cms_posts WHERE slug LIKE 't-%'`);
});

test('a moved article answers with its new address', async () => {
  await db.query(`INSERT INTO cms_redirects (from_path, to_path) VALUES ('/blogs/old-liver-guide', '/blogs/liver-the-silent-worker')`);
  const r = await call('anon', 'GET', '/api/blog/posts/old-liver-guide');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { redirect: '/blogs/liver-the-silent-worker' });
  assert.equal((await db.query(`SELECT hits FROM cms_redirects WHERE from_path = '/blogs/old-liver-guide'`)).rows[0].hits, 1);
});

test('renderer: only safe HTML comes out, whatever the document contains', () => {
  const t = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [t('<script>alert(1)</script> & "quotes"')] },
    { type: 'paragraph', content: [t('bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]), t(' data', [{ type: 'link', attrs: { href: 'data:text/html,x' } }]),
      t(' proto', [{ type: 'link', attrs: { href: '//evil.example/x' } }]), t(' quote', [{ type: 'link', attrs: { href: '/a" onmouseover="x' } }])] },
    { type: 'paragraph', content: [t('ok', [{ type: 'link', attrs: { href: 'https://example.org/a?b=1&c=2' } }]), t(' home', [{ type: 'link', attrs: { href: 'https://www.tranzlife.in/shop' } }])] },
    { type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'x' } },
    { type: 'image', attrs: { src: 'http://insecure.example/a.jpg', alt: 'x' } },
    { type: 'image', attrs: { src: '/assets/a.jpg', alt: '"><img src=x onerror=alert(1)>', caption: '<b>c</b>' } },
    { type: 'video', attrs: { provider: 'youtube', id: 'abc"><script>' } },
    { type: 'video', attrs: { provider: 'youtube', id: 'dQw4w9WgXcQ', title: 'Breathing' } },
    { type: 'iframe', attrs: { src: 'https://evil.example' } },
    { type: 'script', content: [t('alert(1)')] },
    { type: 'paragraph', attrs: { style: 'color:red', onclick: 'x' }, content: [t('plain')] },
    { type: 'heading', attrs: { level: 9 }, content: [t('Same')] },
    { type: 'heading', attrs: { level: 3 }, content: [t('Same')] },
  ] };
  const { html, headings, words } = renderDoc(doc, { siteOrigin: 'https://www.tranzlife.in' });
  // attribute values are quoted and escaped (checked below), so look for anything outside them
  const outside = html.replace(/="[^"]*"/g, '=""');
  assert.doesNotMatch(outside, /<script|onerror|onmouseover|onclick|style=/i);
  assert.doesNotMatch(html, /javascript:|data:text|evil\.example|insecure\.example/i);
  assert.match(html, /<p>&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quotes&quot;<\/p>/);
  assert.match(html, /<p>bad data proto quote<\/p>/, 'unsafe links keep their text but lose the link');
  assert.match(html, /<a href="https:\/\/example\.org\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">ok<\/a>/);
  assert.match(html, /<a href="\/shop"> home<\/a>/, 'links to this site become internal');
  assert.match(html, /alt="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(html, /<figcaption>&lt;b&gt;c&lt;\/b&gt;<\/figcaption>/);
  assert.equal((html.match(/<iframe /g) || []).length, 1);
  assert.match(html, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ" title="Breathing"/);
  assert.match(html, /<h2 id="same">Same<\/h2><h3 id="same-2">Same<\/h3>/, 'bad levels fall back to h2; ids are unique');
  assert.deepEqual(headings.map((h) => h.id), ['same', 'same-2']);
  assert.ok(words > 5);
  assert.equal(safeUrl('/ok'), '/ok');
  assert.equal(safeUrl('mailto:care@tranzlife.in'), 'mailto:care@tranzlife.in');
  assert.equal(safeUrl('https://a.example/x.jpg', { image: true }), 'https://a.example/x.jpg');
  assert.equal(safeUrl('mailto:x@y.z', { image: true }), null);
  assert.equal(slugify('Liver & Digestion: 5 Habits!'), 'liver-and-digestion-5-habits');
  // the old format still converts the same way
  assert.equal(legacyToDoc({ sections: [['A', 'b **c**']] }).content[1].content[1].marks[0].type, 'bold');
});

test('content manager: blog, website text and announcements yes; every shop route no', async () => {
  const me = await signIn('writer', 'content_manager');
  assert.ok(me.permissions.includes('content.publish') && !me.permissions.includes('view'));

  // what the role is for
  const posts = await call('writer', 'GET', '/api/admin/cms/posts');
  assert.equal(posts.status, 200);
  assert.equal(posts.body.counts.published, ARTICLES.length);
  assert.equal((await call('writer', 'GET', '/api/admin/cms/posts?status=draft')).body.posts.length, 0);
  assert.equal((await call('writer', 'GET', '/api/admin/cms/categories')).status, 200);
  assert.equal((await call('writer', 'GET', '/api/admin/content')).status, 200);
  const ann = await call('writer', 'POST', '/api/admin/announcements', { text: 'New on the blog: lung care tips', linkUrl: '/blogs' });
  assert.equal(ann.status, 200);
  const docs = await call('writer', 'GET', '/api/admin/site-docs');
  assert.equal(docs.status, 200);
  assert.equal(docs.body.docs.find((x) => x.key === 'store.SITE').locked, true);
  assert.equal(docs.body.docs.find((x) => x.key === 'site.FAQ').locked, false);
  const faq = await call('writer', 'GET', '/api/admin/site-docs/site.FAQ');
  assert.equal((await call('writer', 'PUT', '/api/admin/site-docs/site.FAQ', { data: faq.body.data })).status, 200);
  const shopDoc = await call('writer', 'GET', '/api/admin/site-docs/store.SITE');
  assert.equal(shopDoc.status, 200, 'shop documents can be read');
  assert.equal((await call('writer', 'PUT', '/api/admin/site-docs/store.SITE', { data: shopDoc.body.data })).status, 403, '...but not changed');

  // every admin route that needs a shop permission refuses this role, before anything runs
  const dir = fileURLToPath(new URL('../admin/', import.meta.url));
  const routes = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && !n.endsWith('.test.js'))) {
    const src = readFileSync(dir + f, 'utf8');
    for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\('(\/api\/admin\/[^']+)',\s*\{?\s*(?:\.\.\.)?G\(([^)]*)\)/g)) {
      routes.push({ method: m[1].toUpperCase(), url: m[2], perm: m[3], file: f });
    }
  }
  const shopOnly = routes.filter((r) => !r.perm.startsWith('null') && !r.perm.includes('content.'));
  assert.ok(shopOnly.length > 80, `found the shop routes (${shopOnly.length})`);
  const sample = { ':id': '00000000-0000-4000-8000-000000000000', ':number': 'TL-0001', ':mediaId': '00000000-0000-4000-8000-000000000001', ':noteId': '1', ':key': 'site.FAQ' };
  for (const r of shopOnly) {
    const url = r.url.replace(/:[A-Za-z]+/g, (p) => sample[p] || 'x');
    const res = await call('writer', r.method, url, r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
    assert.equal(res.status, 403, `${r.method} ${r.url} (${r.file}, needs ${r.perm}) must refuse a content manager, got ${res.status}`);
  }
});

test('shop roles keep their access; support cannot manage the blog', async () => {
  await signIn('helper', 'support');
  assert.equal((await call('helper', 'GET', '/api/admin/cms/posts')).status, 403);
  assert.equal((await call('helper', 'GET', '/api/admin/site-docs')).status, 200, 'support still reads site text, as before');
  assert.equal((await call('helper', 'PUT', '/api/admin/site-docs/site.FAQ', { data: {} })).status, 403);
  assert.equal((await call('helper', 'POST', '/api/admin/announcements', { text: 'nope nope' })).status, 403);

  await signIn('boss', 'manager');
  assert.equal((await call('boss', 'GET', '/api/admin/dashboard')).status, 200);
  assert.equal((await call('boss', 'GET', '/api/admin/content')).status, 200);
  const shopDoc = await call('boss', 'GET', '/api/admin/site-docs/store.SITE');
  assert.equal((await call('boss', 'PUT', '/api/admin/site-docs/store.SITE', { data: shopDoc.body.data })).status, 200, 'managers can still change shop documents');

  const owner = await signIn('own', 'owner');
  assert.ok(owner.permissions.includes('view') && owner.permissions.includes('content.publish'));
  assert.equal((await call('own', 'GET', '/api/admin/cms/posts')).status, 200);
});
