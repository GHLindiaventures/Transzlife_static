// Builds the shop API as a Fastify app (used by server/index.js and the tests).
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { createDb } from '../db/index.js';
import { createAuth } from './auth.js';
import { createRazorpay } from './razorpay.js';
import { createTwilio } from './twilio.js';
import { createNotifier } from './notify.js';
import { createOrders } from './orders.js';
import shopRoutes from './routes.js';
import adminRoutes from '../admin/routes.js';
import catalogPublic from './catalog.js';
import { writeOffExpired } from './batches.js';
import trackRoutes from './track.js';
import { createReminders } from './reminders.js';
import reviewRoutes from './reviews.js';
import contentRoutes from './content.js';
import presenceRoutes, { createPresence } from './presence.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildShopApp({ env = process.env, db, fastifyOptions = {}, logger = true } = {}) {
  const app = Fastify({
    logger: logger && { level: env.LOG_LEVEL || 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] },
    trustProxy: true,            // Render terminates HTTPS in front of us
    bodyLimit: 64 * 1024,
    ...fastifyOptions,
  });
  const log = app.log;
  db ??= await createDb(env, { log });
  const razorpay = createRazorpay(env);
  const twilio = createTwilio(env, { log });
  const auth = createAuth({ db, env, log, twilio });
  const notifier = createNotifier({ db, twilio, env, log });
  const orders = createOrders({ db, razorpay, log, notifier });
  const reminders = createReminders({ db, twilio, env, log });
  const presence = createPresence();

  // JSON only (no text/plain or form posts, which other sites could submit). The webhook route
  // also keeps the exact raw body, needed to check Razorpay's signature.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (req.routeOptions?.config?.rawBody) req.rawBody = body;
    if (!body) return done(null, {});
    try { done(null, JSON.parse(body)); } catch (e) { e.statusCode = 400; done(e); }
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  // Cross-site request protection: state-changing calls must come from our own pages.
  const allowed = new Set(String(env.SITE_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean));
  app.addHook('onRequest', async (req, reply) => {
    if (!UNSAFE.has(req.method) || req.routeOptions?.config?.skipOriginCheck) return;
    const origin = req.headers.origin;
    let ok = false;
    if (origin) {
      try { const host = new URL(origin).host; ok = allowed.has(origin) || host === req.headers['x-forwarded-host'] || host === req.headers.host; } catch { ok = false; }
    }
    if (!ok) return reply.code(403).send({ error: 'Request blocked.', code: 'bad_origin' });
  });

  app.addHook('preHandler', auth.loadCustomer);
  app.addHook('onSend', async (req, reply, payload) => {
    if (req.url.startsWith('/api/')) {
      if (!reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    return payload;
  });

  await app.register(shopRoutes, { db, auth, orders, razorpay, notifier, log });
  await app.register(adminRoutes, { db, razorpay, twilio, notifier, reminders, presence, auth: { mode: auth.mode }, log, env });
  await app.register(trackRoutes, { db, log });
  await app.register(reviewRoutes, { db, env, log });
  await app.register(presenceRoutes, { presence });
  await app.register(contentRoutes, { db });
  await app.register(catalogPublic, { db });

  // free stock held by payments that were never completed
  const sweep = setInterval(() => {
    orders.releaseExpired().catch((e) => log.error(e, '[orders] sweep failed'));
    writeOffExpired(db, log).catch((e) => log.error(e, '[batches] expiry sweep failed'));
    reminders.sweep().catch((e) => log.error(e, '[reminders] sweep failed'));
    reminders.prune().catch((e) => log.error(e, '[analytics] prune failed'));
  }, 5 * 60_000);
  sweep.unref();
  app.addHook('onClose', async () => { clearInterval(sweep); await db.close?.(); });

  app.shop = { db, auth, orders, razorpay, twilio, notifier, reminders, presence };
  return app;
}
