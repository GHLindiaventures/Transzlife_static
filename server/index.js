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
import { buildShopApp } from './shop/app.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.pdf':'application/pdf' };

const serveSite = existsSync(join(ROOT, 'index.html'));
if (!serveSite) console.warn('dist/ not found: serving the APIs only. Run `npm run build` to serve the site too.');

const chat = createChatApi(process.env);

// Security headers on every page and file (the API adds its own in shop/app.js).
// HSTS only when hosted (HTTPS); no CSP yet (inline JSON-LD, Razorpay checkout): see the production checklist.
const HOSTED = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  ...(HOSTED ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};
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

function serveFile(req, res){
  let path;
  try { path = decodeURIComponent(req.url.split('?')[0]); } catch(e){ res.writeHead(400, SECURITY); return res.end(); }
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)){ res.writeHead(403, SECURITY); return res.end(); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  const ext = extname(file).toLowerCase();
  const immutable = file.includes(`${sep}assets${sep}`) && FINGERPRINT.test(file);
  const headers = { ...SECURITY, 'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=86400' };
  if (!COMPRESSIBLE.has(ext)) {
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }
  const accept = String(req.headers['accept-encoding'] || '');
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  let body = readFileSync(file);
  // share previews (WhatsApp, Facebook) need absolute image / page URLs: filled from SITE_URL
  if (ext === '.html' && SITE_URL) body = Buffer.from(body.toString('utf8').replaceAll('content="/', `content="${SITE_URL}/`));
  if (enc) {
    const key = `${file}|${enc}`;
    let out = immutable ? packed.get(key) : null;
    if (!out) { out = encode(body, enc); if (immutable) packed.set(key, out); }
    body = out;
    headers['Content-Encoding'] = enc;
  }
  headers.Vary = 'Accept-Encoding';
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

// One HTTP server: the chat handler sees each request first and passes everything else to Fastify.
const serverFactory = (fastifyHandler) =>
  createServer((req, res) => chat.handle(req, res, () => fastifyHandler(req, res)));

let app;
try {
  app = await buildShopApp({ env: process.env, fastifyOptions: { serverFactory } });
} catch (e) {
  // Keep the website and chat online even if the shop database is not reachable.
  console.error(`[shop] API disabled: ${e.message}`);
  app = Fastify({ logger: true, serverFactory });
  app.all('/api/*', async (req, reply) => reply.code(503).send({ error: 'The shop is temporarily unavailable. Please try again shortly.', code: 'shop_down' }));
}

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(405).send();
  if (!serveSite) return reply.code(404).send('Site not built.');
  reply.hijack();
  serveFile(req.raw, reply.raw);
});

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`TranzLife site + Tulsi chat + shop API on http://localhost:${PORT}`);
chat.warmUp();
