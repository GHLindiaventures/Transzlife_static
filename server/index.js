// Production server: the built website (dist/), the Tulsi chat API and the shop API in one process.
//   npm run build && npm start      ->  http://localhost:3000
//   npm run dev:api                 ->  shop API only, for `npm run dev` (Vite proxies /api to it)
// Settings come from .env (see .env.example).
//
// Request order: Tulsi chat (/api/chat, /api/insight, /api/health) -> shop API (Fastify) -> static site.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { createChatApi } from './chat-api.js';
import { createClientIp } from './client-ip.js';
import { buildShopApp } from './shop/app.js';
import { VIDEO_ORIGINS } from './cms/render.js';
import { createSeoPages, injectHead } from './cms/seo-html.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.pdf':'application/pdf' };

const serveSite = existsSync(join(ROOT, 'index.html'));
if (!serveSite) console.warn('dist/ not found: serving the APIs only. Run `npm run build` to serve the site too.');

const chat = createChatApi(process.env);

// Security headers on every page and file (the API adds its own in shop/app.js).
// HSTS only when hosted (HTTPS).
const HOSTED = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Content-Security-Policy: only our own scripts, plus what the site really loads from elsewhere.
// Inline JSON-LD (<script type="application/ld+json">) is data, not code, so it is not affected.
// React's style={...} attributes need 'unsafe-inline' for styles only (never for scripts).
// Extra origins (e.g. a chat API on another domain) can be added with CSP_CONNECT_EXTRA / CSP_IMG_EXTRA.
const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const extra = (name) => String(process.env[name] || '').split(',').map((s) => s.trim()).filter(Boolean);
const MEDIA_STORE = originOf(process.env.AWS_ENDPOINT_URL_S3);     // product / review photos (shop/media.js)
const RAZORPAY = ['https://checkout.razorpay.com', 'https://api.razorpay.com'];
const CASHFREE = ['https://sdk.cashfree.com', 'https://api.cashfree.com', 'https://sandbox.cashfree.com'];
const MARKETING = ['https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://connect.facebook.net', 'https://www.facebook.com'];
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${RAZORPAY[0]} ${CASHFREE[0]} ${MARKETING[0]} ${MARKETING[1]} ${MARKETING[2]}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://images.unsplash.com https://images.pexels.com https://*.razorpay.com https://*.cashfree.com ${MARKETING[1]} ${MARKETING[3]} ${MEDIA_STORE} ${extra('CSP_IMG_EXTRA').join(' ')}`,
  "media-src 'self' blob: https://videos.pexels.com",
  "font-src 'self' data:",
  `connect-src 'self' ${RAZORPAY.join(' ')} ${CASHFREE.slice(1).join(' ')} https://lumberjack.razorpay.com ${MARKETING[0]} ${MARKETING[1]} ${MARKETING[3]} ${MEDIA_STORE} ${extra('CSP_CONNECT_EXTRA').join(' ')}`,
  `frame-src 'self' ${RAZORPAY.join(' ')} ${CASHFREE.join(' ')} ${MARKETING[0]} https://www.google.com https://maps.google.com ${VIDEO_ORIGINS.join(' ')}`,   // blog video embeds (server/cms/render.js)
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${RAZORPAY[1]} ${CASHFREE.slice(1).join(' ')}`,
  "frame-ancestors 'self'",
  ...(HOSTED ? ['upgrade-insecure-requests'] : []),
].map((d) => d.replace(/\s+/g, ' ').trim()).join('; ');

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy': CSP,
  ...(HOSTED ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

// Pages the React app knows. Anything else still gets the app (which shows its 404 page),
// but with HTTP status 404 so search engines do not index it as a copy of the home page.
const KNOWN_PAGE = new RegExp('^/(' + [
  '', 'about', 'science', 'sustainability', 'faq', 'contact', 'certifications',
  'shop', 'products(/[^/]+)?', 'product/[^/]+', 'concerns(/[^/]+)?', 'ingredients',
  'blogs?(/[^/]+)?', 'blog-preview/[^/]+', 'journal(/[^/]+)?', 'policies/[^/]+',
  'cart', 'login', 'checkout', 'order/[^/]+', 'track(/[^/]+)?', 'account', 'admin(/.*)?',
].join('|') + ')/?$');
// Text files are compressed (Brotli, else gzip). Build files never change, so each is compressed once and kept.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml']);
const packed = new Map();          // `${file}|${encoding}` -> Buffer (fingerprinted build files only)
// Vite's fingerprinted files (name-<hash>.js): safe to cache for a year. Other /assets (photos, logo) may be replaced.
const FINGERPRINT = /[-.][A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|webp|svg)$/;
const SITE_URL = String(process.env.SITE_URL || '').replace(/\/$/, '');

function encode(buf, enc){
  return enc === 'br'
    ? brotliCompressSync(buf, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 } })
    : gzipSync(buf, { level: 9 });
}

/** page: optional { status, head } from the blog SEO pages (server/cms/seo-html.js). */
function serveFile(req, res, page = null){
  let path;
  try { path = decodeURIComponent(req.url.split('?')[0]); } catch(e){ res.writeHead(400, SECURITY); return res.end(); }
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)){ res.writeHead(403, SECURITY); return res.end(); }
  let status = 200;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // a missing file (has an extension) or an unknown page: the app's 404 page, with a real 404 status
    if (extname(path) || !KNOWN_PAGE.test(path)) status = 404;
    file = join(ROOT, 'index.html');
  }
  if (page?.status) status = page.status;
  const ext = extname(file).toLowerCase();
  const immutable = file.includes(`${sep}assets${sep}`) && FINGERPRINT.test(file);
  const headers = { ...SECURITY, 'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=86400' };
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
    // a lighter WebP copy made at build time (scripts/webp-variants.mjs), for browsers that take it
    headers.Vary = 'Accept';
    if (/image\/webp/.test(String(req.headers.accept || '')) && existsSync(`${file}.webp`)) {
      file = `${file}.webp`;
      headers['Content-Type'] = 'image/webp';
    }
  }
  if (!COMPRESSIBLE.has(ext)) {
    res.writeHead(status, headers);
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }
  const accept = String(req.headers['accept-encoding'] || '');
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  let body = readFileSync(file);
  // share previews (WhatsApp, Facebook) need absolute image / page URLs: filled from SITE_URL
  if (ext === '.html' && page?.head) body = Buffer.from(injectHead(body.toString('utf8'), page.head));   // absolute URLs already
  else if (ext === '.html' && SITE_URL) {
    let html = body.toString('utf8').replaceAll('content="/', `content="${SITE_URL}/`);
    if (!html.includes('rel="canonical"')) {
      const canon = `${SITE_URL}${path === '/' ? '' : path}`;
      html = html.replace('</head>', `  <link rel="canonical" href="${canon}">\n</head>`);
    }
    body = Buffer.from(html);
  }
  if (enc) {
    const key = `${file}|${enc}`;
    let out = immutable ? packed.get(key) : null;
    if (!out) { out = encode(body, enc); if (immutable) packed.set(key, out); }
    body = out;
    headers['Content-Encoding'] = enc;
  }
  headers.Vary = 'Accept-Encoding';
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

// One HTTP server: the visitor's real IP is settled first (see client-ip.js), then the chat handler
// sees each request and passes everything else to Fastify.
const applyClientIp = createClientIp(process.env);
const serverFactory = (fastifyHandler) =>
  createServer((req, res) => { applyClientIp(req); chat.handle(req, res, () => fastifyHandler(req, res)); });

let app;
try {
  app = await buildShopApp({ env: process.env, fastifyOptions: { serverFactory } });
} catch (e) {
  // Keep the website and chat online even if the shop database is not reachable.
  console.error(`[shop] API disabled: ${e.message}`);
  app = Fastify({ logger: true, serverFactory });
  app.all('/api/*', async (req, reply) => reply.code(503).send({ error: 'The shop is temporarily unavailable. Please try again shortly.', code: 'shop_down' }));
}

// blog pages get their own title, description, share tags and structured data; old addresses redirect
const seoPages = app.shop?.db ? createSeoPages({ db: app.shop.db, env: process.env }) : null;

app.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(405).send();
  if (!serveSite) return reply.code(404).send('Site not built.');
  let page = null;
  if (seoPages && !extname(req.url.split('?')[0])) {
    try { page = await seoPages.handle(req.raw); } catch (e) { req.log.error(e, '[seo] blog page tags failed'); }   // the plain site still works
  }
  if (page?.redirect) {
    return reply.code(page.status).headers({ ...SECURITY, Location: page.redirect, 'Cache-Control': page.status === 301 ? 'public, max-age=3600' : 'no-cache' }).send();
  }
  reply.hijack();
  serveFile(req.raw, reply.raw, page);
});

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`TranzLife site + Tulsi chat + shop API on http://localhost:${PORT}`);
chat.warmUp();
