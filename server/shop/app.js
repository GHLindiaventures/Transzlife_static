// Builds the shop API as a Fastify app (used by server/index.js and the tests).
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { createDb, isHosted } from '../db/index.js';
import { createAuth } from './auth.js';
import { createRazorpay } from './razorpay.js';
import { createTwilio } from './twilio.js';
import { createNotifier } from './notify.js';
import { createOrders } from './orders.js';
import shopRoutes from './routes.js';
import adminRoutes from '../admin/routes.js';
import catalogPublic from './catalog.js';
import enquiryRoutes from './enquiries.js';
import { writeOffExpired } from './batches.js';
import trackRoutes from './track.js';
import { createReminders } from './reminders.js';
import reviewRoutes from './reviews.js';
import contentRoutes from './content.js';
import opsWebhooks, { createOps } from './ops.js';
import seoRoutes from './seo.js';
import customerReturnRoutes from './returns.js';
import presenceRoutes, { createPresence } from './presence.js';
import { createHealth } from '../admin/health.js';
import { createCourier } from './courier.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildShopApp({ env = process.env, db, fastifyOptions = {}, logger = true } = {}) {
  const app = Fastify({
    logger: logger && { level: env.LOG_LEVEL || 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] },
    trustProxy: 1,               // one proxy (Render); server/client-ip.js has already reduced X-Forwarded-For to the trusted address
    bodyLimit: 64 * 1024,
    ...fastifyOptions,
  });
  const log = app.log;
  const hosted = isHosted(env);
  db ??= await createDb(env, { log });
  const razorpay = createRazorpay(env);
  const twilio = createTwilio(env, { log });
  const auth = createAuth({ db, env, log, twilio });
  const notifier = createNotifier({ db, twilio, env, log });
  const orders = createOrders({ db, razorpay, log, notifier });
  const reminders = createReminders({ db, twilio, env, log });
  const presence = createPresence();
  const ops = createOps({ db, twilio, env, log });
  const courier = createCourier({ db, notifier, env, log });
  const health = createHealth({
    db, razorpay, twilio,
    media: { configured: !!(env.AWS_ENDPOINT_URL_S3 && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) },
    env, log,
  });

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
    if (hosted) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');   // HTTPS only
    if (req.url.startsWith('/api/')) {
      if (!reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    return payload;
  });

  app.addHook('onResponse', async (req, reply) => {
    health.recordRequest({ statusCode: reply.statusCode, durationMs: reply.elapsedTime || 0 });
  });
  app.addHook('onError', async (req, reply, err) => {
    await health.recordError(req, err);
  });

  await app.register(shopRoutes, { db, auth, orders, razorpay, notifier, ops, courier, log });
  await app.register(adminRoutes, { db, razorpay, twilio, notifier, reminders, presence, ops, health, courier, auth: { mode: auth.mode }, log, env });
  await app.register(trackRoutes, { db, log });
  await app.register(reviewRoutes, { db, env, log });
  await app.register(customerReturnRoutes, { db, env, log });
  await app.register(presenceRoutes, { presence });
  await app.register(contentRoutes, { db });
  await app.register(opsWebhooks, { ops, env, log });
  await app.register(seoRoutes, { db, env });
  await app.register(catalogPublic, { db });
  await app.register(enquiryRoutes, { db, log });

  // free stock held by payments that were never completed, and record job heartbeats
  const trackJob = (key, label, intervalMin, fn) => {
    const t0 = Date.now();
    return fn()
      .then(() => health.recordHeartbeat(key, label, intervalMin, 'ok', Date.now() - t0))
      .catch((e) => {
        log.error(e, `[${key}] sweep failed`);
        return health.recordHeartbeat(key, label, intervalMin, 'error', Date.now() - t0, e.message);
      });
  };
  let tick = 0;
  const sweep = setInterval(() => {
    tick += 1;
    trackJob('orders.release', 'Expired-payment stock release', 5, () => orders.releaseExpired());
    trackJob('batches.expiry', 'Expired-batch write-off', 5, () => writeOffExpired(db, log));
    trackJob('reminders.sweep', 'Cart & refill reminders', 5, () => reminders.sweep());
    trackJob('analytics.prune', 'Analytics & session clean-up', 5, () => reminders.prune());
    trackJob('ops.sweep', 'COD check & daily summary', 5, () => ops.sweep());
    trackJob('courier.overdue', 'Overdue delivery check', 5, () => courier.flagOverdueShipments());
    if (tick % 2 === 0) health.sweep().catch((e) => log.error(e, '[health] sweep failed'));
  }, 5 * 60_000);
  sweep.unref();
  app.addHook('onClose', async () => { clearInterval(sweep); await db.close?.(); });

  app.shop = { db, auth, orders, razorpay, twilio, notifier, reminders, presence, ops, health, courier };
  return app;
}
