// Blog CMS, SEO (Phase C): the checklist, the HTML written for crawlers and link previews, status codes and
// redirects.   npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { hashPassword, newTotpSecret, totpCode } from '../admin/crypto.js';
import { analyzeSeo } from './seo-checks.js';
import { createSeoPages, finalTarget, injectHead, invalidateRedirects } from './seo-html.js';

const ORIGIN = 'http://localhost:3000';
const ENV = { NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40), SITE_URL: 'https://www.tranzlife.in' };
let app, db, pages;
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
const page = (path) => pages.handle({ url: path, headers: { host: 'localhost:3000' } });
const ld = (head) => [...head.matchAll(/<script type="application\/ld\+json" data-ssr-ld>(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const t = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c) => ({ type: 'paragraph', content: c });
const h = (level, text) => ({ type: 'heading', attrs: { level }, content: [t(text)] });

before(async () => {
  db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  app = await buildShopApp({ env: ENV, db, logger: false });
  pages = createSeoPages({ db, env: ENV });
  await signIn('cm', 'content_manager');
  await signIn('sup', 'support');
});
after(async () => { await app.close(); });

test('SEO checklist: a well-made article scores high; each problem is named with a fix', () => {
  const sentence = 'Tulsi tea is a simple daily habit that many families enjoy. ';
  const good = {
    title: 'Tulsi Tea Benefits for Everyday Breathing', slug: 'tulsi-tea-benefits',
    excerpt: 'Tulsi tea benefits explained simply: what holy basil tea may do for breathing, stress and immunity, how to brew it, and who should be careful.',
    featuredImage: 'https://images.unsplash.com/photo-1?w=1200', featuredImageAlt: 'A cup of tulsi tea',
    seo: { focusKeyword: 'tulsi tea benefits', robots: { index: true, follow: true }, og: {}, twitter: {}, keywords: [] },
    content: { type: 'doc', content: [
      p(t('Tulsi tea benefits start with how gentle it is. '), t('Brew it', [{ type: 'link', attrs: { href: '/products/breathefree-inhaler' } }]), t(' daily.')),
      h(2, 'Tulsi tea benefits for the lungs'),
      ...Array.from({ length: 12 }, () => p(t(sentence.repeat(5)))),
      p(t('Read the '), t('study', [{ type: 'link', attrs: { href: 'https://pubmed.ncbi.nlm.nih.gov/1' } }]), t('. Tulsi tea benefits are modest but real.')),
      { type: 'image', attrs: { src: '/assets/tulsi.jpg', alt: 'Tulsi leaves' } },
      h(3, 'How to brew it'), p(t('Steep for five minutes.')),
    ] },
  };
  const r = analyzeSeo(good, { knownPaths: new Set(['/products/breathefree-inhaler']), others: [], selfId: 'x' });
  assert.ok(r.score >= 85, `expected a high score, got ${r.score}: ${r.checks.filter((c) => c.status !== 'pass').map((c) => c.id).join(', ')}`);
  assert.ok(r.score <= 100 && r.max > 0);

  const bad = analyzeSeo({
    title: 'Tips', slug: 'draft-abc123', excerpt: '', seo: { focusKeyword: 'tulsi', robots: { index: true, follow: true }, og: {}, twitter: {}, keywords: [] },
    featuredImage: 'https://x.example/cover.png', featuredImageAlt: '',
    content: { type: 'doc', content: [h(1, 'Second title'), h(4, 'Skipped'), p(t('tulsi tulsi tulsi tulsi')), { type: 'image', attrs: { src: '/a.jpg', alt: '' } },
      p(t('gone', [{ type: 'link', attrs: { href: '/blogs/does-not-exist' } }]))] },
  }, { knownPaths: new Set(['/']), others: [{ id: 'o1', title: 'Other', seoTitle: '', description: '', focusKeyword: 'Tulsi' }] });
  const by = Object.fromEntries(bad.checks.map((c) => [c.id, c]));
  assert.ok(bad.score < 40, `poor article scores low (${bad.score})`);
  assert.equal(by.url.status, 'fail');
  assert.equal(by.headings.status, 'fail');
  assert.match(by.headings.message, /Heading 1/);
  assert.equal(by.internal.status, 'fail');
  assert.match(by.internal.message, /does-not-exist/);
  assert.equal(by.alt.status, 'fail');
  assert.match(by.alt.message, /2 of 2/);
  assert.equal(by['kw-density'].status, 'warn', 'keyword stuffing is flagged');
  assert.equal(by['kw-unique'].status, 'warn');
  assert.equal(by.description.status, 'fail');
  assert.equal(by['img-format'].status, 'warn');
  for (const c of bad.checks) if (c.status !== 'pass') assert.ok(c.fix, `${c.id} explains how to fix it`);
});

test('article pages carry their own tags and real structured data; drafts and unknown slugs are 404', async () => {
  const r = await page('/blogs/quit-smoking-naturally-herbal-ayurvedic');
  assert.equal(r.status, 200);
  assert.match(r.head, /<title>How to Quit Smoking Naturally: 7 Herbal and Ayurvedic Approaches \| TranzLife Biosciences<\/title>/);
  assert.match(r.head, /<link rel="canonical" href="https:\/\/www\.tranzlife\.in\/blogs\/quit-smoking-naturally-herbal-ayurvedic">/);
  assert.match(r.head, /<meta property="og:type" content="article">/);
  assert.match(r.head, /<meta property="og:image" content="https:\/\/images\.unsplash\.com\//);
  assert.match(r.head, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.match(r.head, /<meta property="article:published_time" content="2026-11-24T18:30:00\.000Z">/);
  const [posting, crumbs] = ld(r.head);
  assert.equal(posting['@type'], 'BlogPosting');
  assert.equal(posting.datePublished, '2026-11-24T18:30:00.000Z', 'the real publication date');
  assert.deepEqual(posting.author, { '@type': 'Organization', name: 'TranzLife Biosciences', url: 'https://www.tranzlife.in' }, 'no invented author');
  assert.equal(posting.articleSection, 'Quit Smoking');
  assert.ok(!('aggregateRating' in posting) && !('review' in posting), 'no ratings or reviews');
  assert.ok(posting.wordCount > 500);
  assert.deepEqual(crumbs.itemListElement.map((i) => i.name), ['Home', 'Blogs', 'Quit Smoking', 'How to Quit Smoking Naturally: 7 Herbal and Ayurvedic Approaches']);

  // SEO settings change what is written
  await db.query(`UPDATE cms_posts SET seo = $2::jsonb WHERE slug = $1`, ['liver-the-silent-worker', JSON.stringify({
    title: 'Your Liver, Explained', description: 'What the liver does.', robots: { index: false, follow: true }, og: { title: 'Share title' }, twitter: { title: 'X title' }, focusKeyword: 'liver health' })]);
  const custom = await page('/blogs/liver-the-silent-worker');
  assert.match(custom.head, /<title>Your Liver, Explained<\/title>/);
  assert.match(custom.head, /<meta name="robots" content="noindex, follow">/);
  assert.match(custom.head, /<meta property="og:title" content="Share title">/);
  assert.match(custom.head, /<meta name="twitter:title" content="X title">/);
  assert.match(ld(custom.head)[0].keywords, /liver health/);

  const author = (await db.query(`INSERT INTO cms_authors (slug, name, title) VALUES ('meena', 'Dr. Meena Rao', 'Nutritionist') RETURNING id`)).rows[0].id;
  await db.query(`UPDATE cms_posts SET author_id = $1 WHERE slug = 'breathing-in-polluted-cities'`, [author]);
  assert.deepEqual(ld((await page('/blogs/breathing-in-polluted-cities')).head)[0].author, { '@type': 'Person', name: 'Dr. Meena Rao', jobTitle: 'Nutritionist' });

  await db.query(`INSERT INTO cms_posts (slug, title, status) VALUES ('secret-draft', 'Secret', 'draft')`);
  for (const path of ['/blogs/secret-draft', '/blogs/no-such-thing', '/blogs/a/b', '/blogs/Bad%20Slug']) {
    const nf = await page(path);
    assert.equal(nf?.status, 404, `${path} is a 404`);
    assert.match(nf.head, /noindex/);
    assert.doesNotMatch(nf.head, /Secret/);
  }

  const list = await page('/blogs?category=quit-smoking');
  assert.equal(list.status, 200);
  assert.match(list.head, /<title>Quit Smoking \| Blogs \| TranzLife Biosciences<\/title>/);
  assert.match(list.head, /href="https:\/\/www\.tranzlife\.in\/blogs\?category=quit-smoking"/);
  assert.equal(ld(list.head)[0]['@type'], 'Blog');
  assert.equal(await page('/shop'), null, 'other pages are left alone');
});

test('the tags replace the site-wide ones in the page', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const out = injectHead(html, '  <title>New</title>\n  <meta name="description" content="d">\n  <link rel="canonical" href="https://x/y">');
  assert.equal((out.match(/<title>/g) || []).length, 1);
  assert.equal((out.match(/name="description"/g) || []).length, 1);
  assert.equal((out.match(/property="og:/g) || []).length, 0, 'the home page share tags are gone');
  assert.match(out, /<title>New<\/title>/);
  assert.match(out, /id="root"/);
});

test('old and messy addresses redirect in one hop', async () => {
  assert.deepEqual(await page('/journal/liver-the-silent-worker'), { redirect: '/blogs/liver-the-silent-worker', status: 301 });
  assert.deepEqual(await page('/blog'), { redirect: '/blogs', status: 301 });
  assert.deepEqual(await page('/Blogs/Liver-The-Silent-Worker/?utm_source=x'), { redirect: '/blogs/liver-the-silent-worker?utm_source=x', status: 301 });
  await db.query(`INSERT INTO cms_redirects (from_path, to_path) VALUES ('/blogs/a1', '/blogs/a2'), ('/blogs/a2', '/blogs/liver-the-silent-worker'), ('/x', '/y'), ('/y', '/x')`);
  invalidateRedirects();
  assert.deepEqual(await page('/blogs/a1'), { redirect: '/blogs/liver-the-silent-worker', status: 301 }, 'a chain is followed to the end');
  const loop = finalTarget(new Map([['/x', { to: '/y', code: 301 }], ['/y', { to: '/x', code: 301 }]]), '/x');
  assert.deepEqual(loop, { to: '/y', code: 301 }, 'a loop stops instead of spinning');
  await db.query(`DELETE FROM cms_redirects`);
  invalidateRedirects();
});

test('redirects API: add, no chains, no loops, live articles protected, permissions', async () => {
  const a = await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/old-liver', toPath: '/blogs/liver-the-silent-worker' });
  assert.equal(a.status, 200);
  const b = await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/older-liver/', toPath: '/old-liver' });
  assert.equal(b.status, 200);
  assert.deepEqual([b.body.redirect.fromPath, b.body.redirect.toPath], ['/older-liver', '/blogs/liver-the-silent-worker'], 'points straight at the final page');
  // moving the target repoints the old redirect too
  await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/blogs/liver-the-silent-worker-old', toPath: '/old-liver' });
  const loop = await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/blogs/liver-the-silent-worker', toPath: '/old-liver' });
  assert.equal(loop.status, 409, 'a live article address cannot be redirected away');
  const circle = await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/blogs/liver-the-silent-worker-x', toPath: '/blogs/liver-the-silent-worker-x' });
  assert.equal(circle.status, 400);
  assert.equal((await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: '/admin', toPath: '/' })).status, 400);
  assert.equal((await call('cm', 'POST', '/api/admin/cms/redirects', { fromPath: 'no-slash', toPath: '/' })).status, 400);
  assert.deepEqual(await page('/older-liver'), { redirect: '/blogs/liver-the-silent-worker', status: 301 }, 'used by the site at once');

  const list = await call('cm', 'GET', '/api/admin/cms/redirects');
  assert.equal(list.body.redirects.length, 3);
  assert.equal((await call('sup', 'POST', '/api/admin/cms/redirects', { fromPath: '/a', toPath: '/b' })).status, 403);
  assert.equal((await call('cm', 'DELETE', `/api/admin/cms/redirects/${a.body.redirect.id}`)).status, 200);
  assert.equal(await page('/old-liver'), null, 'removed at once');
});

test('editor gets what the live SEO checks need', async () => {
  const id = (await db.query(`SELECT id FROM cms_posts WHERE slug = 'quit-smoking-naturally-herbal-ayurvedic'`)).rows[0].id;
  const r = await call('cm', 'GET', `/api/admin/cms/posts/${id}`);
  assert.equal(r.status, 200);
  const ctx = r.body.seoContext;
  assert.ok(ctx.knownPaths.includes('/products/breathefree-inhaler'));
  assert.ok(ctx.knownPaths.includes('/blogs/liver-the-silent-worker'));
  assert.ok(!ctx.knownPaths.includes('/blogs/secret-draft'), 'drafts are not link targets');
  assert.ok(ctx.others.length > 20);
  const result = analyzeSeo({ ...r.body.post }, { knownPaths: new Set(ctx.knownPaths), others: ctx.others, selfId: id });
  assert.equal(result.checks.find((c) => c.id === 'internal').status, 'pass', 'the imported article links to a real product');
  // SEO settings save and come back
  const saved = await call('cm', 'PATCH', `/api/admin/cms/posts/${id}`, { baseUpdatedAt: r.body.post.updatedAt, seo: { focusKeyword: 'quit smoking naturally', keywords: ['tulsi'], robots: { index: true, follow: true } } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.post.seo.focusKeyword, 'quit smoking naturally');
  assert.deepEqual(saved.body.post.seo.keywords, ['tulsi']);
  assert.equal((await call('cm', 'PATCH', `/api/admin/cms/posts/${id}`, { baseUpdatedAt: saved.body.post.updatedAt, seo: { canonical: 'javascript:alert(1)' } })).status, 400);
});
