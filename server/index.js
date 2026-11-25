// Production server: the built website (dist/), the Tulsi chat API and the shop API in one process.
//   npm run build && npm start      ->  http://localhost:3000
//   npm run dev:api                 ->  shop API only, for `npm run dev` (Vite proxies /api to it)
// Settings come from .env (see .env.example).
//
// Request order: Tulsi chat (/api/chat, /api/insight, /api/health) -> shop API (Fastify) -> static site.
import { createReadStream, existsSync, statSync } from 'node:fs';
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

function serveFile(req, res){
  let path;
  try { path = decodeURIComponent(req.url.split('?')[0]); } catch(e){ res.writeHead(400); return res.end(); }
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)){ res.writeHead(403); return res.end(); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  const hashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, { 'Content-Type':TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control':hashed ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options':'nosniff' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
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
