// Returns (customer side).
//   GET  /api/orders/:number/returns   can I return something from this order? (per item) + returns already made on it
//   GET  /api/returns                  all my returns with their status history
//   POST /api/returns/photos           one photo (JPG / PNG / WebP body) -> { id, url, thumbUrl }
//   POST /api/orders/:number/returns   { items: [{ orderItemId, qty }], reason, note, photoIds }
//
// Rules (all enforced here, never only in the browser): the order is mine and delivered; returns are switched on
// (Settings > returns_enabled); each product is returnable (products.returnable) and still inside its window
// (products.return_days, else the shop-wide return_window_days, counted from the delivery); quantities never
// exceed what was bought minus what is already in a return. Damaged / wrong / expired claims need a photo
// when photo storage is available. Staff then take it through review, pickup, inspection and refund
// (server/admin/returns.js).
import { z } from 'zod';
import { createMedia, MAX_UPLOAD_MB } from './media.js';
import { loadSettings } from './pricing.js';
import { RETURN_REASONS, PHOTO_REASONS, returnLabel, logReturnEvent } from '../admin/returns.js';

const MAX_PHOTOS = 5;
const DAY = 86_400_000;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const dateLabel = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default async function customerReturnRoutes(app, { db, env, log }) {
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

  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, (req, body, done) => done(null, body));

  /** packs of each order item already in a (non-rejected) return */
  const alreadyReturned = async (query, orderId) => Object.fromEntries((await query(`
    SELECT ri.order_item_id, SUM(ri.qty)::int AS qty FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.order_id = $1 AND r.status <> 'rejected' GROUP BY ri.order_item_id`, [orderId])).rows.map((r) => [Number(r.order_item_id), r.qty]));

  /** The policy applied to one order: which lines can be returned now, and if not, why not. */
  async function assess(query, order) {
    const s = await loadSettings(query);
    const enabled = s.returns_enabled !== false;
    const windowDays = Number(s.return_window_days ?? 7);
    const deliveredAt = (await query(`SELECT MAX(created_at) AS at FROM order_events WHERE order_id = $1 AND to_status = 'delivered'`, [order.id])).rows[0].at;
    const done = await alreadyReturned(query, order.id);
    const rows = (await query(`
      SELECT i.id, i.product_id, i.name, i.size, i.pack, i.qty, i.unit_price, p.returnable, p.return_days
        FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.order_id = $1 ORDER BY i.id`, [order.id])).rows;
    const now = Date.now();
    const items = rows.map((i) => {
      const days = i.return_days ?? windowDays;
      const remaining = i.qty - (done[Number(i.id)] || 0);
      const deadline = deliveredAt ? new Date(new Date(deliveredAt).getTime() + days * DAY) : null;
      let why = null;
      if (!enabled) why = 'Returns are not open right now.';
      else if (order.status !== 'delivered' || !deliveredAt) why = order.status === 'returned' ? 'Already returned.' : 'Available once the order is delivered.';
      else if (i.returnable === false) why = 'This product cannot be returned (see the return policy).';
      else if (days <= 0) why = 'This product cannot be returned (see the return policy).';
      else if (remaining <= 0) why = 'Already part of a return request.';
      else if (deadline && now > deadline.getTime()) why = `The ${days}-day return window closed on ${dateLabel(deadline)}.`;
      return { orderItemId: Number(i.id), productId: i.product_id, name: i.name, size: i.size, pack: i.pack, bought: i.qty, returnable: why ? 0 : remaining,
        unitPrice: i.unit_price, windowDays: days, returnBy: deadline && !why ? deadline.toISOString() : null, why };
    });
    return { enabled, windowDays, deliveredAt, canReturn: items.some((i) => i.returnable > 0), items };
  }

  const returnOut = (r, items, events, photos) => ({
    id: r.id, number: r.return_number, orderNumber: r.order_number, status: r.status, label: returnLabel(r), reason: r.reason, reasonLabel: RETURN_REASONS[r.reason] || r.reason,
    note: r.reason_note || '', rejectReason: r.reject_reason || null, resolution: r.resolution, refundAmount: r.refund_amount, pickupAt: r.pickup_at,
    createdAt: r.created_at, updatedAt: r.resolved_at || r.received_at || r.created_at,
    items: items.filter((i) => i.return_id === r.id).map((i) => ({ name: i.name, size: i.size, pack: i.pack, qty: i.qty })),
    history: events.filter((e) => e.return_id === r.id).map((e) => ({ status: e.status, note: e.note, at: e.created_at })),
    photos: photos.filter((p) => p.return_id === r.id).map((p) => ({ url: p.url, thumb: p.thumb_url || p.url })),
  });

  async function loadReturns(where, params) {
    const rows = (await q(`SELECT r.*, o.order_number FROM returns r JOIN orders o ON o.id = r.order_id WHERE ${where} ORDER BY r.created_at DESC LIMIT 100`, params)).rows;
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const items = (await q(`SELECT ri.return_id, ri.qty, i.name, i.size, i.pack FROM return_items ri JOIN order_items i ON i.id = ri.order_item_id WHERE ri.return_id = ANY($1) ORDER BY ri.id`, [ids])).rows;
    const events = (await q('SELECT return_id, status, note, created_at FROM return_events WHERE return_id = ANY($1) ORDER BY created_at, id', [ids])).rows;
    const photos = (await q('SELECT return_id, url, thumb_url FROM return_photos WHERE return_id = ANY($1) ORDER BY created_at', [ids])).rows;
    return rows.map((r) => returnOut(r, items, events, photos));
  }

  app.get('/api/orders/:number/returns', { preHandler: signedIn }, async (req, reply) => {
    const o = (await q('SELECT * FROM orders WHERE order_number = $1 AND customer_id = $2', [String(req.params.number).slice(0, 20), req.customer.id])).rows[0];
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    return {
      policy: await assess(q, o), reasons: RETURN_REASONS, photoReasons: media.enabled ? PHOTO_REASONS : [], maxPhotos: MAX_PHOTOS,
      returns: await loadReturns('r.order_id = $1', [o.id]),
    };
  });

  app.get('/api/returns', { preHandler: signedIn }, async (req) => ({
    returns: await loadReturns('o.customer_id = $1', [req.customer.id]),
  }));

  app.post('/api/returns/photos', { preHandler: signedIn, bodyLimit: MAX_UPLOAD_MB * 1024 * 1024, ...tight(30) }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Upload a JPG, PNG or WebP photo.' });
    const pending = Number((await q(`SELECT COUNT(*) AS n FROM return_photos WHERE customer_id = $1 AND return_id IS NULL AND created_at > now() - interval '1 day'`, [req.customer.id])).rows[0].n);
    if (pending >= 15) return reply.code(429).send({ error: 'Too many photos uploaded today. Please submit your return request first.' });
    const up = await media.uploadProductImage(req.customer.id, req.body, String(req.headers['content-type']).split(';')[0], 'returns');
    const row = (await q('INSERT INTO return_photos (customer_id, url, thumb_url, storage_key) VALUES ($1,$2,$3,$4) RETURNING id', [req.customer.id, up.url, up.thumbUrl, up.key])).rows[0];
    return { id: row.id, url: up.url, thumbUrl: up.thumbUrl };
  });

  app.post('/api/orders/:number/returns', { preHandler: signedIn, ...tight(10) }, async (req, reply) => {
    const body = parse(z.object({
      items: z.array(z.object({ orderItemId: z.number().int().positive(), qty: z.number().int().min(1).max(100) })).min(1, 'Choose at least one product to return.').max(30),
      reason: z.enum(Object.keys(RETURN_REASONS), { message: 'Choose a reason for the return.' }),
      note: z.string().trim().max(500).optional().default(''),
      photoIds: z.array(z.string().uuid()).max(MAX_PHOTOS, `Add up to ${MAX_PHOTOS} photos.`).optional().default([]),
    }), req.body, reply); if (!body) return;
    if (body.reason === 'other' && body.note.length < 5) return reply.code(400).send({ error: 'Please tell us a little more about why you are returning it.', code: 'invalid' });

    return db.tx(async (t) => {
      const o = (await t.query('SELECT * FROM orders WHERE order_number = $1 AND customer_id = $2 FOR UPDATE', [String(req.params.number).slice(0, 20), req.customer.id])).rows[0];
      if (!o) throw fail('Order not found.', 404);
      const policy = await assess(t.query, o);
      if (!policy.enabled) throw fail('Returns are not open right now. Please contact us.', 409);
      if (o.status !== 'delivered') throw fail('A return can be requested once the order has been delivered.', 409);
      const byId = new Map(policy.items.map((i) => [i.orderItemId, i]));
      const seen = new Set();
      for (const it of body.items) {
        const line = byId.get(it.orderItemId);
        if (!line) throw fail('That product is not part of this order.');
        if (seen.has(it.orderItemId)) throw fail('Each product can be listed once.');
        seen.add(it.orderItemId);
        if (line.why) throw fail(`${line.name}: ${line.why}`, 409);
        if (it.qty > line.returnable) throw fail(`You can return at most ${line.returnable} of ${line.name}.`);
      }
      if (media.enabled && PHOTO_REASONS.includes(body.reason) && body.photoIds.length === 0) throw fail('Please add a photo of the product or parcel so we can process this quickly.');
      let photos = [];
      if (body.photoIds.length) {
        photos = (await t.query('SELECT id FROM return_photos WHERE id = ANY($1) AND customer_id = $2 AND return_id IS NULL', [body.photoIds, req.customer.id])).rows;
        if (photos.length !== new Set(body.photoIds).size) throw fail('One of the photos is no longer available. Please add it again.');
      }
      const n = (await t.query(`SELECT nextval('return_number_seq') AS n`)).rows[0].n;
      const number = `RET-${String(n).padStart(6, '0')}`;
      const r = (await t.query(`INSERT INTO returns (return_number, order_id, status, reason, reason_note, source) VALUES ($1,$2,'requested',$3,$4,'customer') RETURNING id`,
        [number, o.id, body.reason, body.note || null])).rows[0];
      for (const it of body.items) await t.query('INSERT INTO return_items (return_id, order_item_id, qty) VALUES ($1,$2,$3)', [r.id, it.orderItemId, it.qty]);
      if (photos.length) await t.query('UPDATE return_photos SET return_id = $1 WHERE id = ANY($2)', [r.id, photos.map((p) => p.id)]);
      await logReturnEvent(t.query, r.id, 'requested', `Requested by the customer: ${RETURN_REASONS[body.reason]}`, 'customer');
      await t.query('INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$2,$3,$4)',
        [o.id, o.status, `Return ${number} requested by the customer: ${RETURN_REASONS[body.reason]}${body.note ? ` (${body.note})` : ''}`, 'customer']);
      return { ok: true, id: r.id, number };
    });
  });
}
