// Search engines: GET /robots.txt and GET /sitemap.xml (served before the static site).
// The sitemap is built from the live catalogue (products added in the dashboard appear automatically),
// the "Shop by concern" pages, the journal and the policy pages. Private and transactional pages
// (admin, account, cart, checkout, sign-in, order pages, API) are kept out of search results.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STATIC_PAGES = ['/', '/shop', '/about', '/science', '/sustainability', '/faq', '/contact', '/concerns', '/ingredients', '/journal',
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

export default async function seoRoutes(app, { db, env }) {
  const concerns = idsFrom('concerns.js');
  const articles = idsFrom('articles.js');
  // the public address: SITE_URL when set (production), otherwise the address this request came to
  const base = (req) => String(env.SITE_URL || `${req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

  app.get('/robots.txt', async (req, reply) => {
    reply.header('Content-Type', 'text/plain; charset=utf-8').header('Cache-Control', 'public, max-age=3600');
    return ['User-agent: *', ...PRIVATE.map((p) => `Disallow: ${p}`), '', `Sitemap: ${base(req)}/sitemap.xml`, ''].join('\n');
  });

  app.get('/sitemap.xml', async (req, reply) => {
    const products = (await db.query('SELECT id, updated_at FROM products WHERE active ORDER BY sort_order, name')).rows;
    const urls = [
      ...STATIC_PAGES.map((path) => ({ path })),
      ...products.map((p) => ({ path: `/products/${p.id}`, lastmod: new Date(p.updated_at).toISOString().slice(0, 10) })),
      ...concerns.map((id) => ({ path: `/concerns/${id}` })),
      ...articles.map((id) => ({ path: `/journal/${id}` })),
    ];
    const root = base(req);
    reply.header('Content-Type', 'application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=3600');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((u) => `  <url><loc>${xml(root + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  });
}
