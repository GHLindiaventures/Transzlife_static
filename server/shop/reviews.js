// Product reviews (customer side).
//   GET  /api/products/:id/reviews        approved reviews + rating summary (+ my review / can I review)
//   GET  /api/reviews/mine                products I can review (delivered) and my reviews
//   POST /api/reviews/photos              one photo (JPG / PNG / WebP body) -> { id, url, thumbUrl }
//   POST /api/reviews                     { productId, rating, title, body, photoIds } create or edit mine
//   POST /api/reviews/:id/helpful         { v? } toggle my "helpful" vote
//   POST /api/reviews/:id/report          { reason, v? }
//
// Rules: only signed-in customers with a DELIVERED order containing the product can review it
// (so every review is a verified purchase); one review per customer per product (editing sends it
// through the checks again). Clean reviews publish at once; suspicious ones are held for staff.
// A review is never held or hidden for being negative. Photos only (no video).
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createMedia, MAX_UPLOAD_MB } from './media.js';
import { isBot } from './track.js';

export const REJECT_REASONS = {
  spam: 'Spam or advertising', offensive: 'Offensive or abusive', personal_info: 'Shares personal information',
  off_topic: 'Not about this product', medical_claim: 'Makes a medical / cure claim', not_genuine: 'Not a genuine experience',
};
export const HOLD_LABELS = {
  link: 'Contains a link', contact: 'Contains a phone number or email', medical_claim: 'Possible medical / cure claim',
  language: 'Possible offensive language', duplicate: 'Same text as another review', burst: 'Several reviews in a short time',
  short_extreme: 'Very short with a 1★ or 5★ rating', reported: 'Reported by customers',
};
const REPORT_REASONS = ['Spam or advertising', 'Offensive or abusive', 'Not about this product', 'Shares private information'];
const REPORTS_TO_HOLD = 3;
const MAX_PHOTOS = 5;

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|co|io|shop|store|xyz|link|ly)\b)/i;
const PHONE = /(\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const CURE = /\b(cured?|cures|curing|reversed?|got rid of (my )?(diabetes|sugar|asthma|fatty liver)|no (more )?need (for|of) (insulin|medicines?|tablets?|inhaler)|stopp?ed (taking )?(my )?(insulin|medicines?|tablets?)|(diabetes|sugar|asthma|fatty liver|pcod|pcos)\s+(is\s+)?(gone|cured|disappeared|vanished))\b/i;
const RUDE = /\b(f+u+c+k\w*|shit\w*|bastard|bitch\w*|asshole|chutiya|madarchod|behenchod|bhosdi\w*|gandu|otha|thevidiya|punda)\b/i;

/** Why a review should wait for a person (empty = publish now). Never looks at the rating alone. */
export async function screen(q, { customerId, reviewId, rating, title, body }) {
  const text = `${title || ''} ${body}`;
  const holds = [];
  if (LINK.test(text)) holds.push('link');
  if (PHONE.test(text) || EMAIL.test(text)) holds.push('contact');
  if (CURE.test(text)) holds.push('medical_claim');
  if (RUDE.test(text)) holds.push('language');
  if (body.trim().length < 30 && (rating === 1 || rating === 5)) holds.push('short_extreme');
  const norm = body.toLowerCase().replace(/\s+/g, ' ').trim();
  const dup = (await q(`SELECT 1 FROM reviews WHERE lower(regexp_replace(trim(body), '\\s+', ' ', 'g')) = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`, [norm, reviewId ?? null])).rows.length;
  if (dup) holds.push('duplicate');
  const recent = Number((await q(`SELECT COUNT(*) AS n FROM reviews WHERE customer_id = $1 AND created_at > now() - interval '24 hours' AND ($2::uuid IS NULL OR id <> $2)`, [customerId, reviewId ?? null])).rows[0].n);
  if (recent >= 2) holds.push('burst');
  return holds;
}

/** Keeps products.rating_* in step with the approved reviews. */
export async function refreshRating(q, productId) {
  await q(`
    UPDATE products p SET
      rating_count = s.n, rating_avg = COALESCE(s.avg, 0),
      rating_hist = ARRAY[s.r1, s.r2, s.r3, s.r4, s.r5]
    FROM (SELECT COUNT(*)::int AS n, ROUND(AVG(rating)::numeric, 2) AS avg,
                 COUNT(*) FILTER (WHERE rating = 1)::int AS r1, COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
                 COUNT(*) FILTER (WHERE rating = 3)::int AS r3, COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
                 COUNT(*) FILTER (WHERE rating = 5)::int AS r5
            FROM reviews WHERE product_id = $1 AND status = 'approved') s
   WHERE p.id = $1`, [productId]);
}

/** "Priya Sharma" -> "Priya S." */
export const displayName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TranzLife customer';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

/** The delivered order that lets this customer review this product (null = not eligible). */
export async function deliveredOrder(q, customerId, productId) {
  return (await q(`
    SELECT o.id, o.order_number FROM orders o
      JOIN order_items i ON i.order_id = o.id AND i.product_id = $2
     WHERE o.customer_id = $1 AND EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'delivered')
     ORDER BY o.created_at DESC LIMIT 1`, [customerId, productId])).rows[0] || null;
}

export const reviewOut = (r, media = [], voted = false) => ({
  id: r.id, rating: r.rating, title: r.title || '', body: r.body, name: r.display_name, verified: r.verified,
  createdAt: r.created_at, updatedAt: r.updated_at, helpful: r.helpful_count, votedHelpful: voted,
  reply: r.reply ? { text: r.reply, at: r.reply_at } : null,
  media: media.filter((m) => m.review_id === r.id).map((m) => ({ type: 'image', url: m.url, thumb: m.thumb_url || m.url, width: m.width, height: m.height })),
});

export default async function reviewRoutes(app, { db, env, log }) {
  const media = createMedia(env, { log });
  const q = db.query;
  const tight = (max, minutes = 60) => ({ config: { rateLimit: { max, timeWindow: `${minutes} minutes` } } });
  const signedIn = async (req, reply) => { if (!req.customer) return reply.code(401).send({ error: 'Please sign in to continue.', code: 'auth_required' }); };
  const parse = (schema, data, reply) => {
    const r = schema.safeParse(data ?? {});
    if (r.success) return r.data;
    reply.code(400).send({ error: r.error.issues[0]?.message || 'Invalid request.', code: 'invalid' });
    return null;
  };
  const voterOf = (req, v) => (req.customer ? `c:${req.customer.id}` : v ? `v:${v}` : null);

  // photos arrive as the raw image body (this plugin's own parser; admin has its own)
  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, (req, body, done) => done(null, body));

  app.get('/api/products/:id/reviews', async (req, reply) => {
    const p = (await q('SELECT id, rating_avg, rating_count, rating_hist FROM products WHERE id = $1 AND active', [req.params.id])).rows[0];
    if (!p) return reply.code(404).send({ error: 'Product not found.' });
    const rows = (await q(`SELECT * FROM reviews WHERE product_id = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT 500`, [p.id])).rows;
    const ids = rows.map((r) => r.id);
    const photos = ids.length ? (await q('SELECT review_id, url, thumb_url, width, height FROM review_media WHERE review_id = ANY($1) ORDER BY sort', [ids])).rows : [];
    const voter = voterOf(req, typeof req.query.v === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.v) ? req.query.v : null);
    const voted = voter && ids.length ? new Set((await q(`SELECT review_id FROM review_votes WHERE voter = $1 AND kind = 'helpful' AND review_id = ANY($2)`, [voter, ids])).rows.map((x) => x.review_id)) : new Set();
    let mine = null, canReview = null;
    if (req.customer) {
      const m = (await q('SELECT * FROM reviews WHERE customer_id = $1 AND product_id = $2', [req.customer.id, p.id])).rows[0];
      if (m) {
        const mp = (await q('SELECT review_id, url, thumb_url, width, height, id FROM review_media WHERE review_id = $1 ORDER BY sort', [m.id])).rows;
        mine = { ...reviewOut(m, mp), status: m.status, photoIds: mp.map((x) => x.id) };
      }
      canReview = !!(await deliveredOrder(q, req.customer.id, p.id));
    }
    reply.header('Cache-Control', 'no-cache');
    return {
      summary: { avg: Number(p.rating_avg), total: p.rating_count, counts: (p.rating_hist || [0, 0, 0, 0, 0]).map(Number) },
      reviews: rows.map((r) => reviewOut(r, photos, voted.has(r.id))),
      mine, canReview, signedIn: !!req.customer,
    };
  });

  app.get('/api/reviews/mine', { preHandler: signedIn }, async (req) => {
    const toReview = (await q(`
      SELECT DISTINCT ON (i.product_id) i.product_id AS id, p.name, p.short, MAX(e.created_at) OVER (PARTITION BY i.product_id) AS delivered_at
        FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id AND p.active
        JOIN order_events e ON e.order_id = o.id AND e.to_status = 'delivered'
       WHERE o.customer_id = $1 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.customer_id = $1 AND r.product_id = i.product_id)
       ORDER BY i.product_id`, [req.customer.id])).rows;
    const mine = (await q(`SELECT r.id, r.product_id, p.name AS product, r.rating, r.status, r.created_at FROM reviews r JOIN products p ON p.id = r.product_id
                            WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [req.customer.id])).rows;
    return { toReview, mine };
  });

  app.post('/api/reviews/photos', { preHandler: signedIn, bodyLimit: MAX_UPLOAD_MB * 1024 * 1024, ...tight(30) }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Upload a JPG, PNG or WebP photo.' });
    const pending = Number((await q(`SELECT COUNT(*) AS n FROM review_media WHERE customer_id = $1 AND review_id IS NULL AND created_at > now() - interval '1 day'`, [req.customer.id])).rows[0].n);
    if (pending >= 15) return reply.code(429).send({ error: 'Too many photos uploaded today. Please post your review first.' });
    const up = await media.uploadProductImage(req.customer.id, req.body, String(req.headers['content-type']).split(';')[0], 'reviews');
    const row = (await q(`INSERT INTO review_media (customer_id, url, thumb_url, storage_key, width, height) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.customer.id, up.url, up.thumbUrl, up.key, up.width, up.height])).rows[0];
    return { id: row.id, url: up.url, thumbUrl: up.thumbUrl };
  });

  app.post('/api/reviews', { preHandler: signedIn, ...tight(10) }, async (req, reply) => {
    const body = parse(z.object({
      productId: z.string().regex(/^[a-z0-9-]{1,80}$/),
      rating: z.number().int().min(1, 'Please choose a star rating.').max(5),
      title: z.string().trim().max(80).optional().default(''),
      body: z.string().trim().min(20, 'Please write at least 20 characters about your experience.').max(2000),
      photoIds: z.array(z.string().uuid()).max(MAX_PHOTOS, `Add up to ${MAX_PHOTOS} photos.`).optional().default([]),
    }), req.body, reply); if (!body) return;
    const c = req.customer;
    const order = await deliveredOrder(q, c.id, body.productId);
    if (!order) return reply.code(403).send({ error: 'You can review a product once an order containing it has been delivered to you.', code: 'not_verified' });
    const existing = (await q('SELECT id, status FROM reviews WHERE customer_id = $1 AND product_id = $2', [c.id, body.productId])).rows[0];
    if (existing?.status === 'removed') return reply.code(403).send({ error: 'This review was removed by our team and cannot be posted again.', code: 'removed' });
    const holds = await screen(q, { customerId: c.id, reviewId: existing?.id, rating: body.rating, title: body.title, body: body.body });
    const status = holds.length ? 'pending' : 'approved';
    const name = displayName(c.name);
    const r = await db.tx(async (t) => {
      const row = existing
        ? (await t.query(`UPDATE reviews SET rating = $2, title = NULLIF($3, ''), body = $4, display_name = $5, order_id = $6, status = $7, hold_reasons = $8,
                            reject_reason = NULL, updated_at = now(), approved_at = CASE WHEN $7 = 'approved' THEN now() END, moderated_by = CASE WHEN $7 = 'approved' THEN 'auto' END
                           WHERE id = $1 RETURNING *`, [existing.id, body.rating, body.title, body.body, name, order.id, status, holds])).rows[0]
        : (await t.query(`INSERT INTO reviews (product_id, customer_id, order_id, rating, title, body, display_name, status, hold_reasons, approved_at, moderated_by)
                          VALUES ($1,$2,$3,$4,NULLIF($5, ''),$6,$7,$8,$9, CASE WHEN $8 = 'approved' THEN now() END, CASE WHEN $8 = 'approved' THEN 'auto' END) RETURNING *`,
        [body.productId, c.id, order.id, body.rating, body.title, body.body, name, status, holds])).rows[0];
      // photos: keep the ones listed (only this customer's), drop the rest
      await t.query(`UPDATE review_media SET review_id = NULL WHERE review_id = $1 AND NOT (id = ANY($2))`, [row.id, body.photoIds]);
      for (const [k, id] of body.photoIds.entries()) {
        await t.query('UPDATE review_media SET review_id = $1, sort = $2 WHERE id = $3 AND customer_id = $4', [row.id, k, id, c.id]);
      }
      await refreshRating(t.query, body.productId);
      return row;
    });
    const photos = (await q('SELECT review_id, url, thumb_url, width, height FROM review_media WHERE review_id = $1 ORDER BY sort', [r.id])).rows;
    return { review: { ...reviewOut(r, photos), status }, held: holds.length > 0 };
  });

  app.post('/api/reviews/:id/helpful', tight(60), async (req, reply) => {
    if (isBot(String(req.headers['user-agent'] || ''))) return reply.code(204).send();
    const body = parse(z.object({ v: z.string().uuid().optional() }), req.body, reply); if (!body) return;
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const voter = voterOf(req, body.v);
    if (!voter) return reply.code(401).send({ error: 'Sign in (or accept analytics) to mark reviews as helpful.', code: 'auth_required' });
    const r = (await q(`SELECT id, customer_id FROM reviews WHERE id = $1 AND status = 'approved'`, [id])).rows[0];
    if (!r) return reply.code(404).send({ error: 'Review not found.' });
    if (req.customer?.id === r.customer_id) return reply.code(400).send({ error: 'You cannot vote on your own review.' });
    const del = await q(`DELETE FROM review_votes WHERE review_id = $1 AND voter = $2 AND kind = 'helpful'`, [id, voter]);
    const on = !(del.affectedRows ?? del.rowCount);
    if (on) await q(`INSERT INTO review_votes (review_id, voter, kind) VALUES ($1,$2,'helpful') ON CONFLICT DO NOTHING`, [id, voter]);
    const n = (await q(`UPDATE reviews SET helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND kind = 'helpful') WHERE id = $1 RETURNING helpful_count`, [id])).rows[0].helpful_count;
    return { helpful: n, votedHelpful: on };
  });

  app.post('/api/reviews/:id/report', tight(20), async (req, reply) => {
    const body = parse(z.object({ reason: z.enum(REPORT_REASONS), v: z.string().uuid().optional() }), req.body, reply); if (!body) return;
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    // anonymous reporters: a one-way hash, never the IP address itself (one report per network)
    const voter = voterOf(req, body.v) || `a:${createHash('sha256').update(`${env.SESSION_SECRET}:${req.ip}`).digest('hex').slice(0, 24)}`;
    const r = (await q(`SELECT id, product_id FROM reviews WHERE id = $1 AND status = 'approved'`, [id])).rows[0];
    if (!r) return { ok: true };
    const ins = await q(`INSERT INTO review_votes (review_id, voter, kind, reason) VALUES ($1,$2,'report',$3) ON CONFLICT DO NOTHING`, [id, voter, body.reason]);
    if (ins.affectedRows ?? ins.rowCount) {
      const n = (await q(`UPDATE reviews SET report_count = report_count + 1 WHERE id = $1 RETURNING report_count`, [id])).rows[0].report_count;
      if (n >= REPORTS_TO_HOLD) {
        // enough independent reports: back to the queue until staff look at it
        await q(`UPDATE reviews SET status = 'pending', hold_reasons = array_append(array_remove(hold_reasons, 'reported'), 'reported') WHERE id = $1`, [id]);
        await refreshRating(q, r.product_id);
      }
    }
    return { ok: true };
  });
}
