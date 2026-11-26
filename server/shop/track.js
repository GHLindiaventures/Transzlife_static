// First-party analytics (no third-party scripts, no IP addresses, no fingerprinting).
//
//   POST /api/t              batch of events from the browser (src/store/lib/track.js)
//   PUT  /api/t/cart         the browser's cart, mirrored so abandoned carts can be seen
//   GET  /api/wishlist       signed-in customer's saved products
//   POST /api/wishlist       { productId, on }       save / remove one
//   POST /api/wishlist/merge { ids }                 favourites saved before signing in
//
// Consent: with analytics accepted the browser sends a random visitor id (v) and visit id (s).
// Without it, only page views are accepted, with no ids at all (counted, never linked to anyone).
// Bots are dropped by user agent; staff browsers and local development do not send anything.
// Purchases are never taken from the browser: they come from the orders table.
import { z } from 'zod';
import { quote } from './pricing.js';

export const EVENT_NAMES = [
  'page_view', 'product_click', 'add_to_cart', 'remove_from_cart', 'cart_view', 'begin_checkout', 'checkout_payment',
  'place_order_click', 'payment_failed', 'share', 'wishlist_add', 'wishlist_remove', 'search', 'chat_open',
  'brochure_download', 'whatsapp_click', 'compare_add', 'review_submit', 'review_helpful',
];

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp\/|telegrambot|embedly|quora link|pinterestbot|vkshare|w3c_validator|lighthouse|pagespeed|headless|phantomjs|puppeteer|playwright|selenium|python-requests|curl\/|wget|httpclient|axios|node-fetch|go-http|java\//i;
export const isBot = (ua) => !ua || ua.length < 20 || BOT.test(ua);

/** Coarse device / browser / OS from the user agent (nothing finer is kept). */
export function parseUa(ua = '') {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'tablet' : /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Other';
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu)\./i;
const SOCIAL = [[/facebook|fb\.com|fb\.me/i, 'facebook'], [/instagram/i, 'instagram'], [/whatsapp|wa\.me/i, 'whatsapp'],
  [/(^|\.)t\.co$|twitter|x\.com/i, 'x'], [/youtube|youtu\.be/i, 'youtube'], [/linkedin|lnkd/i, 'linkedin'], [/pinterest/i, 'pinterest'], [/reddit/i, 'reddit']];

/** Where a visit came from: a campaign tag wins, then a shared link, then the referring site. */
export function classify({ utm = {}, share, referrerHost }) {
  if (utm.source) return { source: utm.source.toLowerCase().slice(0, 60), medium: utm.medium?.toLowerCase().slice(0, 60) || null, campaign: utm.campaign?.slice(0, 100) || null };
  if (share) return { source: 'share', medium: 'referral', campaign: null };
  if (!referrerHost) return { source: 'direct', medium: null, campaign: null };
  const m = referrerHost.match(SEARCH);
  if (m) return { source: m[2].toLowerCase(), medium: 'organic', campaign: null };
  for (const [re, name] of SOCIAL) if (re.test(referrerHost)) return { source: name, medium: 'social', campaign: null };
  return { source: referrerHost.replace(/^www\./, '').slice(0, 80), medium: 'referral', campaign: null };
}

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const str = (n) => z.string().max(n);
const batch = z.object({
  v: z.string().uuid().optional(),
  s: z.string().uuid().optional(),
  ctx: z.object({
    landing: str(300).optional(),
    ref: str(300).optional(),
    share: z.boolean().optional(),
    utm: z.object({ source: str(60).optional(), medium: str(60).optional(), campaign: str(100).optional() }).optional(),
  }).optional(),
  events: z.array(z.object({
    id: z.string().uuid(),
    n: z.enum(EVENT_NAMES),
    p: str(300).optional(),
    pid: slug.optional(),
    props: z.record(z.string().max(60), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional(),
  })).min(1).max(40),
});
const cartBody = z.object({
  v: z.string().uuid(),
  items: z.array(z.object({ id: slug, pack: z.number().int().min(1).max(12), qty: z.number().int().min(1).max(10) })).max(30),
});

const productOf = (path) => path?.match(/^\/products\/([a-z0-9-]{1,80})\/?$/)?.[1] || null;
const cleanPath = (p) => (p ? String(p).split('#')[0].slice(0, 300) : null);
const hostOf = (url) => { try { return new URL(url).host.toLowerCase(); } catch { return null; } };

export default async function trackRoutes(app, { db, log }) {
  const quiet = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };
  const parse = (schema, data, reply) => {
    const r = schema.safeParse(data ?? {});
    if (r.success) return r.data;
    reply.code(400).send({ error: 'Invalid request.', code: 'invalid' });
    return null;
  };
  const ownHost = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();

  app.post('/api/t', quiet, async (req, reply) => {
    const ua = String(req.headers['user-agent'] || '');
    if (isBot(ua)) return reply.code(204).send();
    const body = parse(batch, req.body, reply); if (!body) return;
    const customerId = req.customer?.id ?? null;

    // products that are out of stock right now: views of them are lost demand
    const pids = [...new Set(body.events.map((e) => e.pid || (e.n === 'page_view' ? productOf(cleanPath(e.p)?.split('?')[0]) : null)).filter(Boolean))];
    const oos = pids.length ? new Set((await db.query(
      `SELECT p.id FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ANY($1) AND COALESCE(i.on_hand - i.reserved, 0) <= 0`, [pids])).rows.map((r) => r.id)) : new Set();
    const known = pids.length ? new Set((await db.query('SELECT id FROM products WHERE id = ANY($1)', [pids])).rows.map((r) => r.id)) : new Set();

    const rows = body.events.map((e) => {
      const path = cleanPath(e.p);
      let pid = e.pid || (e.n === 'page_view' ? productOf(path?.split('?')[0]) : null);
      if (pid && !known.has(pid)) pid = null;
      const props = { ...(e.props || {}) };
      if (pid && e.n === 'page_view' && oos.has(pid)) props.oos = true;
      return { ...e, path, pid, props };
    });

    // ---- no consent: anonymous page views only ----
    if (!body.v || !body.s) {
      for (const e of rows.filter((x) => x.n === 'page_view')) {
        await db.query(`INSERT INTO events (event_id, name, path, product_id, props) VALUES ($1, 'page_view', $2, $3, $4) ON CONFLICT (event_id) DO NOTHING`,
          [e.id, e.path, e.pid, JSON.stringify(e.props.oos ? { oos: true } : {})]);
      }
      return reply.code(204).send();
    }

    const { device, browser, os } = parseUa(ua);
    const v = (await db.query(`
      INSERT INTO visitors (id, customer_id, device) VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET last_seen = now(), device = EXCLUDED.device,
             customer_id = COALESCE(EXCLUDED.customer_id, visitors.customer_id)
      RETURNING (xmax = 0) AS inserted, customer_id`, [body.v, customerId, device])).rows[0];

    // a visit id is accepted only for the visitor that started it
    const existing = (await db.query('SELECT visitor_id FROM visits WHERE id = $1', [body.s])).rows[0];
    if (existing && existing.visitor_id !== body.v) return reply.code(204).send();
    const views = rows.filter((e) => e.n === 'page_view').length;
    if (!existing) {
      const ctx = body.ctx || {};
      let refHost = hostOf(ctx.ref);
      if (refHost && refHost === ownHost(req)) refHost = null;           // moving between our own pages
      const src = classify({ utm: ctx.utm, share: ctx.share, referrerHost: refHost });
      const isNew = v.inserted || !(await db.query('SELECT 1 FROM visits WHERE visitor_id = $1 LIMIT 1', [body.v])).rows.length;
      await db.query(`
        INSERT INTO visits (id, visitor_id, customer_id, is_new, landing_path, referrer_host, source, medium, campaign, device, browser, os, pages)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
        [body.s, body.v, customerId, isNew, cleanPath(ctx.landing)?.split('?')[0] || rows[0].path?.split('?')[0] || null, refHost,
          src.source, src.medium, src.campaign, device, browser, os, views]);
    } else {
      await db.query('UPDATE visits SET last_at = now(), pages = pages + $2, customer_id = COALESCE($3, customer_id) WHERE id = $1', [body.s, views, customerId]);
    }

    for (const e of rows) {
      await db.query(`INSERT INTO events (event_id, visitor_id, visit_id, customer_id, name, path, product_id, props)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (event_id) DO NOTHING`,
        [e.id, body.v, body.s, customerId, e.n, e.path, e.pid, JSON.stringify(e.props)]);
    }

    // signed in on this browser: their earlier anonymous activity now belongs to them
    if (customerId) {
      await db.query('UPDATE visits SET customer_id = $2 WHERE visitor_id = $1 AND customer_id IS NULL', [body.v, customerId]);
      await db.query('UPDATE events SET customer_id = $2 WHERE visitor_id = $1 AND customer_id IS NULL', [body.v, customerId]);
      await db.query('UPDATE carts SET customer_id = $2 WHERE visitor_id = $1', [body.v, customerId]);
    }
    if (rows.some((e) => e.n === 'begin_checkout')) {
      await db.query('UPDATE carts SET checkout_at = now() WHERE visitor_id = $1 AND item_count > 0 AND order_id IS NULL', [body.v]);
    }
    return reply.code(204).send();
  });

  app.put('/api/t/cart', quiet, async (req, reply) => {
    if (isBot(String(req.headers['user-agent'] || ''))) return reply.code(204).send();
    const body = parse(cartBody, req.body, reply); if (!body) return;
    if (!(await db.query('SELECT 1 FROM visitors WHERE id = $1', [body.v])).rows.length) return reply.code(204).send();
    let value = 0;
    if (body.items.length) {
      try { value = (await quote(db.query, body.items)).subtotal; } catch { value = 0; }   // e.g. a product was removed
    }
    const count = body.items.reduce((s, i) => s + i.qty, 0);
    // going from empty (or bought) to filled starts a new cart: a fresh reminder / checkout / order slot
    await db.query(`
      INSERT INTO carts (visitor_id, customer_id, items, item_count, value, started_at)
      VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 > 0 THEN now() END)
      ON CONFLICT (visitor_id) DO UPDATE SET
        items = EXCLUDED.items, item_count = EXCLUDED.item_count, value = EXCLUDED.value, updated_at = now(),
        customer_id = COALESCE(EXCLUDED.customer_id, carts.customer_id),
        started_at  = CASE WHEN EXCLUDED.item_count > 0 AND (carts.item_count = 0 OR carts.order_id IS NOT NULL) THEN now() ELSE carts.started_at END,
        order_id    = CASE WHEN EXCLUDED.item_count > 0 AND (carts.item_count = 0 OR carts.order_id IS NOT NULL) THEN NULL ELSE carts.order_id END,
        checkout_at = CASE WHEN EXCLUDED.item_count > 0 AND (carts.item_count = 0 OR carts.order_id IS NOT NULL) THEN NULL ELSE carts.checkout_at END,
        reminded_at = CASE WHEN EXCLUDED.item_count > 0 AND (carts.item_count = 0 OR carts.order_id IS NOT NULL) THEN NULL ELSE carts.reminded_at END`,
    [body.v, req.customer?.id ?? null, JSON.stringify(body.items), count, value]);
    return reply.code(204).send();
  });

  // ---- wishlist (signed in; signed-out visitors keep favourites in their browser) ----
  const signedIn = async (req, reply) => { if (!req.customer) return reply.code(401).send({ error: 'Please sign in to continue.', code: 'auth_required' }); };
  const listOf = async (id) => (await db.query('SELECT product_id FROM wishlists WHERE customer_id = $1 ORDER BY created_at', [id])).rows.map((r) => r.product_id);

  app.get('/api/wishlist', { preHandler: signedIn }, async (req) => ({ ids: await listOf(req.customer.id) }));

  app.post('/api/wishlist', { preHandler: signedIn }, async (req, reply) => {
    const body = parse(z.object({ productId: slug, on: z.boolean() }), req.body, reply); if (!body) return;
    if (body.on) {
      await db.query(`INSERT INTO wishlists (customer_id, product_id) SELECT $1, id FROM products WHERE id = $2 ON CONFLICT DO NOTHING`, [req.customer.id, body.productId]);
    } else {
      await db.query('DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2', [req.customer.id, body.productId]);
    }
    return { ids: await listOf(req.customer.id) };
  });

  app.post('/api/wishlist/merge', { preHandler: signedIn }, async (req, reply) => {
    const body = parse(z.object({ ids: z.array(slug).max(50) }), req.body, reply); if (!body) return;
    if (body.ids.length) {
      await db.query(`INSERT INTO wishlists (customer_id, product_id) SELECT $1, id FROM products WHERE id = ANY($2) ON CONFLICT DO NOTHING`, [req.customer.id, body.ids]);
    }
    return { ids: await listOf(req.customer.id) };
  });

  log?.debug?.('[track] routes ready');
}

/** Called by checkout: tag the order with the visit it came from and close the cart it emptied. */
export async function attributeOrder(db, order, customerId, track) {
  if (!track?.v) return;
  const visit = track.s ? (await db.query('SELECT id, source FROM visits WHERE id = $1 AND visitor_id = $2', [track.s, track.v])).rows[0] : null;
  await db.query('UPDATE orders SET visitor_id = $2, visit_id = $3, source = $4 WHERE id = $1 AND visitor_id IS NULL',
    [order.id, track.v, visit?.id ?? null, visit?.source ?? null]);
  // the cart counts as bought when every product in it is in this order ("Buy now" leaves the cart alone)
  const cart = (await db.query('SELECT id, items FROM carts WHERE visitor_id = $1 AND item_count > 0 AND order_id IS NULL', [track.v])).rows[0];
  if (!cart) return;
  const bought = new Set((await db.query('SELECT product_id FROM order_items WHERE order_id = $1', [order.id])).rows.map((r) => r.product_id));
  const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
  if (items.every((i) => bought.has(i.id))) {
    await db.query('UPDATE carts SET order_id = $2, customer_id = COALESCE(customer_id, $3) WHERE id = $1', [cart.id, order.id, customerId]);
  }
}
