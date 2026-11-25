// Review moderation (staff).
//   GET  /api/admin/reviews?status=pending|approved|rejected|removed|reported&product=&rating=&q=&page=
//   GET  /api/admin/reviews/counts
//   POST /api/admin/reviews/:id/status   { status: approved|rejected|removed, reason? }
//   POST /api/admin/reviews/bulk         { ids, status, reason? }
//   POST /api/admin/reviews/:id/reply    { reply }   ('' removes the reply)
//   GET  /api/admin/presence             people on the site right now (live, in memory)
// Rejecting needs a content reason (spam, offensive, personal info, off topic, medical claim, not
// genuine). There is deliberately no "negative" reason: unhappy reviews stay up (IS 19000:2022).
import { z } from 'zod';
import { REJECT_REASONS, HOLD_LABELS, refreshRating } from '../shop/reviews.js';
import { createMedia } from '../shop/media.js';

const PAGE = 25;
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;

export default async function adminReviewRoutes(app, { db, G, parse, audit, env, log, presence }) {
  const q = db.query;
  const media = createMedia(env, { log });
  const STATUS = {
    pending: `r.status = 'pending'`, approved: `r.status = 'approved'`, rejected: `r.status = 'rejected'`, removed: `r.status = 'removed'`,
    reported: `r.report_count > 0 AND r.status IN ('approved', 'pending')`,
  };

  app.get('/api/admin/reviews/counts', G('view'), async () => {
    const c = (await q(`SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending FROM reviews`)).rows[0];
    return { pending: Number(c.pending) };
  });

  app.get('/api/admin/reviews', G('view'), async (req) => {
    const status = STATUS[req.query.status] ? req.query.status : 'pending';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const where = [STATUS[status]], params = [];
    if (req.query.product) { params.push(String(req.query.product)); where.push(`r.product_id = $${params.length}`); }
    if (/^[1-5]$/.test(String(req.query.rating || ''))) { params.push(Number(req.query.rating)); where.push(`r.rating = $${params.length}`); }
    if (req.query.photos === '1') where.push('EXISTS (SELECT 1 FROM review_media m WHERE m.review_id = r.id)');
    if (req.query.q) { params.push(like(String(req.query.q).trim().slice(0, 80))); where.push(`(r.body ILIKE $${params.length} OR r.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
    const w = `WHERE ${where.join(' AND ')}`;
    const from = 'FROM reviews r JOIN customers c ON c.id = r.customer_id JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id';
    const total = Number((await q(`SELECT COUNT(*) AS n ${from} ${w}`, params)).rows[0].n);
    const rows = (await q(`
      SELECT r.*, c.name AS customer, p.name AS product, o.order_number ${from} ${w}
       ORDER BY ${status === 'pending' ? 'r.updated_at ASC' : 'r.updated_at DESC'} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params)).rows;
    const ids = rows.map((r) => r.id);
    const photos = ids.length ? (await q('SELECT review_id, url, thumb_url FROM review_media WHERE review_id = ANY($1) ORDER BY sort', [ids])).rows : [];
    const reports = ids.length ? (await q(`SELECT review_id, reason, COUNT(*) AS n FROM review_votes WHERE kind = 'report' AND review_id = ANY($1) GROUP BY 1, 2`, [ids])).rows : [];
    const counts = (await q(`SELECT ${Object.entries(STATUS).map(([k, sql]) => `COUNT(*) FILTER (WHERE ${sql.replace(/r\./g, '')}) AS ${k}`).join(', ')} FROM reviews`)).rows[0];
    const products = (await q(`SELECT id, name, rating_avg, rating_count, rating_hist,
                                 (SELECT COUNT(*) FROM reviews x WHERE x.product_id = p.id AND x.rating <= 2 AND x.status = 'approved' AND x.created_at > now() - interval '30 days') AS low_30d
                                 FROM products p ORDER BY sort_order`)).rows;
    return {
      status, page, total, pages: Math.max(1, Math.ceil(total / PAGE)), rejectReasons: REJECT_REASONS, holdLabels: HOLD_LABELS,
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
      products: products.map((p) => ({ id: p.id, name: p.name, avg: Number(p.rating_avg), count: p.rating_count, hist: p.rating_hist.map(Number), low30d: Number(p.low_30d) })),
      rows: rows.map((r) => ({
        id: r.id, product_id: r.product_id, product: r.product, customer_id: r.customer_id, customer: r.customer, order_number: r.order_number,
        verified: r.verified, rating: r.rating, title: r.title, body: r.body, display_name: r.display_name, status: r.status,
        hold_reasons: r.hold_reasons, reject_reason: r.reject_reason, helpful: r.helpful_count, reports: reports.filter((x) => x.review_id === r.id).map((x) => ({ reason: x.reason, n: Number(x.n) })),
        reply: r.reply, reply_at: r.reply_at, reply_by: r.reply_by, created_at: r.created_at, updated_at: r.updated_at, moderated_by: r.moderated_by,
        photos: photos.filter((m) => m.review_id === r.id).map((m) => ({ url: m.url, thumb: m.thumb_url || m.url })),
      })),
    };
  });

  const statusBody = z.object({ status: z.enum(['approved', 'rejected', 'removed']), reason: z.enum(Object.keys(REJECT_REASONS)).optional() })
    .refine((b) => b.status === 'approved' || b.reason, { message: 'Choose why this review is being rejected or removed.' });

  async function setStatus(t, req, id, { status, reason }) {
    const r = (await t.query('SELECT id, product_id, status, rating, report_count FROM reviews WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!r) throw Object.assign(new Error('Review not found.'), { status: 404 });
    if (r.status === 'removed') throw Object.assign(new Error('A removed review cannot be changed.'), { status: 409 });
    await t.query(`UPDATE reviews SET status = $2, reject_reason = $3, moderated_by = $4, updated_at = now(),
                          hold_reasons = CASE WHEN $2 = 'approved' THEN '{}' ELSE hold_reasons END,
                          report_count = CASE WHEN $2 = 'approved' THEN 0 ELSE report_count END,
                          approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END WHERE id = $1`,
    [id, status, status === 'approved' ? null : reason, req.staff.email]);
    if (status === 'approved') await t.query(`DELETE FROM review_votes WHERE review_id = $1 AND kind = 'report'`, [id]);   // reports were looked at
    await refreshRating(t.query, r.product_id);
    await audit(t.query, req, `review.${status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'remove'}`, 'review', id,
      { status: r.status }, { status, reason: reason || undefined, rating: r.rating });
    return r;
  }
  // removed reviews lose their photos from storage too
  async function dropPhotos(id) {
    const keys = (await q('SELECT storage_key FROM review_media WHERE review_id = $1', [id])).rows.map((x) => x.storage_key).filter(Boolean);
    for (const k of keys) await media.remove(k);
    await q('DELETE FROM review_media WHERE review_id = $1', [id]);
  }

  app.post('/api/admin/reviews/:id/status', G('products.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(statusBody, req.body, reply); if (!body) return;
    await db.tx((t) => setStatus(t, req, id, body));
    if (body.status === 'removed') await dropPhotos(id);
    return { ok: true };
  });

  app.post('/api/admin/reviews/bulk', G('products.edit'), async (req, reply) => {
    const body = parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).and(statusBody), req.body, reply); if (!body) return;
    await db.tx(async (t) => { for (const id of body.ids) await setStatus(t, req, id, body); });
    if (body.status === 'removed') for (const id of body.ids) await dropPhotos(id);
    return { ok: true, count: body.ids.length };
  });

  app.post('/api/admin/reviews/:id/reply', G('orders.note'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({ reply: z.string().trim().max(1000) }), req.body, reply); if (!body) return;
    const r = (await q(`UPDATE reviews SET reply = NULLIF($2, ''), reply_at = CASE WHEN $2 = '' THEN NULL ELSE now() END, reply_by = CASE WHEN $2 = '' THEN NULL ELSE $3 END
                         WHERE id = $1 RETURNING id`, [id, body.reply, req.staff.email])).rows[0];
    if (!r) return reply.code(404).send({ error: 'Review not found.' });
    await audit(q, req, 'review.reply', 'review', id, null, { reply: body.reply.slice(0, 80) });
    return { ok: true };
  });

  app.get('/api/admin/presence', G('view'), async () => {
    const s = presence.snapshot();
    const names = new Map((await q('SELECT id, name FROM products')).rows.map((p) => [p.id, p.name]));
    const carts = (await q(`SELECT COUNT(*) AS n, COALESCE(SUM(value), 0)::bigint AS value FROM carts WHERE item_count > 0 AND order_id IS NULL AND updated_at > now() - interval '30 minutes'`)).rows[0];
    return { ...s, products: s.products.map((p) => ({ ...p, name: names.get(p.key) || p.key })), carts: { n: Number(carts.n), value: Number(carts.value) } };
  });
}
