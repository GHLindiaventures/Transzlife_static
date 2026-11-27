// Search engines: GET /robots.txt and GET /sitemap.xml (served before the static site).
// The sitemap is built from the live catalogue (products added in the dashboard appear automatically),
// the "Shop by concern" pages, the published blog posts (from the blog CMS; drafts, scheduled posts that
// are not live yet, archived posts and posts set to "noindex" are left out) and the policy pages.
// Private and transactional pages (admin, account, cart, checkout, sign-in, order pages, API) are kept out.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INDEXABLE, PUBLIC, postPath } from '../cms/posts.js';

// /science is switched off and /journal moved to /blogs (both redirect), so neither is listed
const STATIC_PAGES = ['/', '/shop', '/about', '/sustainability', '/faq', '/contact', '/concerns', '/ingredients', '/blogs',
  '/policies/privacy', '/policies/terms', '/policies/shipping'];
const PRIVATE = ['/admin', '/api/', '/account', '/cart', '/checkout', '/login', '/order/'];

/** Ids from a site data file (entries are `    id: '…'` at the top level of the list). */
function idsFrom(rel) {
  try {
    const text = readFileSync(fileURLToPath(new URL(`../../src/store/data/${rel}`, import.meta.url)), 'utf8');
    return [...text.matchAll(/^ {4}id: '([a-z0-9-]+)'/gm)].map((m) => m[1]);
  } catch { return []; }
}
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const day = (d) => new Date(d).toISOString().slice(0, 10);

export default async function seoRoutes(app, { db, env }) {
  const concerns = idsFrom('concerns.js');
  // the public address: SITE_URL when set (production), otherwise the address this request came to
  const base = (req) => String(env.SITE_URL || `${req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

  app.get('/robots.txt', async (req, reply) => {
    reply.header('Content-Type', 'text/plain; charset=utf-8').header('Cache-Control', 'public, max-age=3600');
    return ['User-agent: *', ...PRIVATE.map((p) => `Disallow: ${p}`), '', `Sitemap: ${base(req)}/sitemap.xml`, ''].join('\n');
  });

  app.get('/sitemap.xml', async (req, reply) => {
    const products = (await db.query('SELECT id, updated_at FROM products WHERE active ORDER BY sort_order, name')).rows;
    // a post's own canonical URL elsewhere means this address is not the one to list
    const posts = (await db.query(`SELECT p.slug, GREATEST(p.published_at, p.content_updated_at) AS lastmod FROM cms_posts p
      WHERE ${PUBLIC} AND ${INDEXABLE} AND COALESCE(p.seo->>'canonical', '') = '' ORDER BY p.published_at DESC`)).rows;
    const newest = posts.reduce((m, p) => (!m || p.lastmod > m ? p.lastmod : m), null);
    const urls = [
      ...STATIC_PAGES.map((path) => ({ path, lastmod: path === '/blogs' && newest ? day(newest) : null })),
      ...products.map((p) => ({ path: `/products/${p.id}`, lastmod: day(p.updated_at) })),
      ...concerns.map((id) => ({ path: `/concerns/${id}` })),
      ...posts.map((p) => ({ path: postPath(p.slug), lastmod: day(p.lastmod) })),
    ];
    const root = base(req);
    reply.header('Content-Type', 'application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=600');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((u) => `  <url><loc>${xml(root + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  });
}
