// Search-engine and share-preview HTML for blog pages, written by the server (crawlers and WhatsApp / Facebook /
// X previews do not run the site's JavaScript, so the tags must be in the HTML itself):
//   /blogs              title, description, canonical, Open Graph, Twitter, Blog structured data
//   /blogs/<slug>       the article's own SEO title, description, canonical, robots, Open Graph / Twitter tags,
//                       BlogPosting + BreadcrumbList structured data built only from the article's real data
//                       (no invented authors, ratings or dates); 404 for drafts, scheduled and unknown articles
// Redirects (one hop, never a chain): saved redirects (cms_redirects), the old /blog, /journal and /journal/<id>
// addresses, trailing slashes and upper-case letters in article addresses.
import { PUBLIC, SLUG, seoOf } from './posts.js';
import { esc } from './render.js';

const BRAND = 'TranzLife Biosciences';
const BRAND_SUFFIX = ` | ${BRAND}`;
const LOGO = '/assets/logo.png';
const BLOG_TITLE = 'Blogs';
const BLOG_DESC = 'TranzLife blogs: practical, easy-to-read guides on quitting smoking, lung, liver and menstrual wellness, immunity and everyday Ayurvedic habits.';

// ---------------------------------------------------------------- redirects (cached; refreshed on change)
let redirects = null;          // Map from_path -> { to, code }
let loadedAt = 0;
const REDIRECT_TTL_MS = 60_000;
/** Call after any redirect is added, changed or removed. */
export function invalidateRedirects() { redirects = null; }
async function redirectMap(db) {
  if (redirects && Date.now() - loadedAt < REDIRECT_TTL_MS) return redirects;
  const rows = (await db.query('SELECT from_path, to_path, status_code FROM cms_redirects')).rows;
  redirects = new Map(rows.map((r) => [r.from_path, { to: r.to_path, code: r.status_code }]));
  loadedAt = Date.now();
  return redirects;
}
/** Follows saved redirects to the final address (at most 5 hops; a loop stops where it started). */
export function finalTarget(map, path) {
  let cur = path, code = null;
  const seen = new Set([path]);
  for (let i = 0; i < 5; i++) {
    const r = map.get(cur);
    if (!r || seen.has(r.to)) break;
    code = code === 302 || r.code === 302 ? 302 : 301;
    cur = r.to; seen.add(cur);
  }
  return cur === path ? null : { to: cur, code: code || 301 };
}

// ---------------------------------------------------------------- tags
const abs = (base, url) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`);
const meta = (attr, key, content) => (content ? `<meta ${attr}="${key}" content="${esc(content)}">` : '');
const jsonLd = (data) => `<script type="application/ld+json" data-ssr-ld>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** The HTML tags for a page's <head>. */
export function headTags({ title, description, canonical, robots, image, imageAlt, type = 'website', ogTitle, ogDescription, extra = [], ld = [] }) {
  return [
    `<title>${esc(title)}</title>`,
    meta('name', 'description', description),
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    meta('name', 'robots', robots),
    meta('property', 'og:type', type),
    meta('property', 'og:site_name', BRAND),
    meta('property', 'og:title', ogTitle || title),
    meta('property', 'og:description', ogDescription || description),
    meta('property', 'og:url', canonical),
    meta('property', 'og:image', image),
    meta('property', 'og:image:alt', image ? imageAlt : ''),
    meta('property', 'og:locale', 'en_IN'),
    ...extra,
    meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary'),
    ...ld.map(jsonLd),
  ].filter(Boolean).map((t) => `  ${t}`).join('\n');
}

/** Puts the tags into the page, replacing index.html's site-wide title, description, canonical and share tags. */
export function injectHead(html, tags) {
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="(description|robots|twitter:[^"]*)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="(og:[^"]*|article:[^"]*)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  return cleaned.replace('</head>', `${tags}\n</head>`);
}

/** The site's public address: SITE_URL if set, else the address the request came to. */
export function siteBase(env, req) {
  if (env.SITE_URL) return String(env.SITE_URL).replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (env.NODE_ENV === 'production' || env.RENDER ? 'https' : 'http');
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------- pages
export function createSeoPages({ db, env = process.env }) {
  const q = db.query;

  async function listing(base, url) {
    const cat = url.searchParams.get('category');
    const c = cat && SLUG.test(cat) ? (await q(`SELECT c.slug, c.name, c.description FROM cms_categories c
      WHERE c.slug = $1 AND EXISTS (SELECT 1 FROM cms_posts p WHERE p.category_id = c.id AND ${PUBLIC})`, [cat])).rows[0] : null;
    const canonical = `${base}/blogs${c ? `?category=${c.slug}` : ''}`;
    const title = `${c ? `${c.name} | ` : ''}${BLOG_TITLE}${BRAND_SUFFIX}`;
    const description = c?.description || BLOG_DESC;
    const latest = (await q(`SELECT p.slug, p.title FROM cms_posts p WHERE ${PUBLIC} ${c ? 'AND p.category_id = (SELECT id FROM cms_categories WHERE slug = $1)' : ''}
      ORDER BY p.published_at DESC LIMIT 10`, c ? [c.slug] : [])).rows;
    return {
      status: 200,
      head: headTags({
        title, description, canonical, robots: 'index, follow, max-image-preview:large', image: abs(base, '/assets/share/og-home.jpg'), imageAlt: BRAND,
        ld: [{
          '@context': 'https://schema.org', '@type': 'Blog', name: `${BRAND} ${BLOG_TITLE}`, url: canonical, description,
          publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: abs(base, LOGO) } },
          blogPost: latest.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${base}/blogs/${p.slug}` })),
        }],
      }),
    };
  }

  async function article(base, slug) {
    const p = (await q(`SELECT p.*, c.name AS category_name, c.slug AS category_slug, a.name AS author_name, a.title AS author_title,
        (SELECT array_agg(t.name ORDER BY t.name) FROM cms_post_tags pt JOIN cms_tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id) AS tags
      FROM cms_posts p LEFT JOIN cms_categories c ON c.id = p.category_id LEFT JOIN cms_authors a ON a.id = p.author_id
      WHERE p.slug = $1 AND ${PUBLIC}`, [slug])).rows[0];
    if (!p) return null;
    const seo = seoOf(p.seo);
    const self = `${base}/blogs/${p.slug}`;
    const canonical = seo.canonical ? abs(base, seo.canonical) : self;
    const title = seo.title || `${p.title}${BRAND_SUFFIX}`;
    const description = seo.description || p.excerpt || BLOG_DESC;
    const image = abs(base, seo.og.image || p.featured_image || '/assets/share/og-home.jpg');
    const robots = `${seo.robots.index ? 'index' : 'noindex'}, ${seo.robots.follow ? 'follow' : 'nofollow'}${seo.robots.index ? ', max-image-preview:large' : ''}`;
    const published = new Date(p.published_at).toISOString();
    const modified = new Date(Math.max(new Date(p.content_updated_at), new Date(p.published_at))).toISOString();
    const keywords = [...new Set([seo.focusKeyword, ...seo.keywords, ...(p.tags || [])].filter(Boolean))];
    const words = String(p.content_html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const author = p.author_name
      ? { '@type': 'Person', name: p.author_name, ...(p.author_title ? { jobTitle: p.author_title } : {}) }
      : { '@type': 'Organization', name: BRAND, url: base };
    const posting = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: p.title.slice(0, 110), description, image: [image],
      datePublished: published, dateModified: modified, author,
      publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: abs(base, LOGO) } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, url: self, inLanguage: 'en-IN', wordCount: words,
      ...(p.category_name ? { articleSection: p.category_name } : {}),
      ...(keywords.length ? { keywords: keywords.join(', ') } : {}),
    };
    const crumbs = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: BLOG_TITLE, item: `${base}/blogs` },
        ...(p.category_name ? [{ '@type': 'ListItem', position: 3, name: p.category_name, item: `${base}/blogs?category=${p.category_slug}` }] : []),
        { '@type': 'ListItem', position: p.category_name ? 4 : 3, name: p.title, item: self },
      ],
    };
    const og = seo.og, tw = seo.twitter;
    return {
      status: 200,
      head: headTags({
        title, description, canonical, robots, image, imageAlt: p.featured_image_alt || p.title, type: 'article',
        // Open Graph / Twitter may use their own title and description (SEO panel > Social sharing)
        ogTitle: og.title, ogDescription: og.description,
        extra: [
          meta('property', 'article:published_time', published),
          meta('property', 'article:modified_time', modified),
          meta('property', 'article:section', p.category_name),
          ...(p.tags || []).slice(0, 6).map((t) => meta('property', 'article:tag', t)),
          meta('name', 'twitter:title', tw.title || og.title || title),
          meta('name', 'twitter:description', tw.description || og.description || description),
          meta('name', 'twitter:image', abs(base, tw.image || og.image || p.featured_image || '/assets/share/og-home.jpg')),
          meta('name', 'twitter:image:alt', p.featured_image_alt || p.title),
        ],
        ld: [posting, crumbs],
      }),
    };
  }

  const notFound = (base) => ({
    status: 404,
    head: headTags({ title: `Page not found${BRAND_SUFFIX}`, description: BLOG_DESC, robots: 'noindex, follow' }),
  });

  /**
   * For a GET page request: { redirect, status } to send a redirect, { status, head } for a blog page,
   * or null (not a blog page and no redirect: serve the site as usual).
   */
  async function handle(req) {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return null; }
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return null; }
    const search = url.search;
    const go = (to, code = 301) => ({ redirect: `${to}${search}`, status: code });

    // saved redirects (old article addresses, manual redirects), followed to the end so there is one hop
    const map = await redirectMap(db);
    const lookup = path.length > 1 ? path.replace(/\/+$/, '') : path;
    const saved = finalTarget(map, lookup);
    if (saved) return go(saved.to, saved.code);

    // old addresses of the blog
    if (/^\/(blog|journal)\/?$/i.test(path)) return go('/blogs');
    const old = /^\/journal\/([^/]+)\/?$/i.exec(path);
    if (old) { const to = `/blogs/${old[1].toLowerCase()}`; const f = finalTarget(map, to); return go(f ? f.to : to); }

    if (!/^\/blogs(\/|$)/i.test(path)) return null;
    const base = siteBase(env, req);
    // one address per page: no trailing slash, lower case
    const tidy = path.replace(/\/+$/, '') || '/';
    if (tidy !== path || tidy !== tidy.toLowerCase()) {
      const to = tidy.toLowerCase();
      // only to an address that can exist (a valid article address); anything else is simply not found
      if (/^\/blogs(\/[a-z0-9]+(-[a-z0-9]+)*)?$/.test(to)) { const f = finalTarget(map, to); return go(f ? f.to : to); }
      return notFound(base);
    }
    if (tidy === '/blogs') return listing(base, url);
    const m = /^\/blogs\/([^/]+)$/.exec(tidy);
    if (!m || !SLUG.test(m[1]) || m[1].length > 120) return notFound(base);
    return (await article(base, m[1])) || notFound(base);
  }

  return { handle };
}
