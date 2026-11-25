// Customers: list with segments + lifetime value, full profile, staff notes.
// Segments (computed, never stored): prospect (signed up, no order), new (1 order), repeat (2),
// loyal (3+), at_risk (has ordered, but nothing in the last 60 days).
import { z } from 'zod';

const COUNTED = `status NOT IN ('pending_payment', 'cancelled')`;
const STATS = `
  SELECT c.id, c.name, c.phone, c.email, c.created_at, c.last_login_at, c.deleted_at,
         COUNT(o.id) FILTER (WHERE o.${COUNTED}) AS orders,
         COALESCE(SUM(o.total) FILTER (WHERE o.${COUNTED}), 0)::bigint AS spent,
         MIN(o.created_at) FILTER (WHERE o.${COUNTED}) AS first_order,
         MAX(o.created_at) FILTER (WHERE o.${COUNTED}) AS last_order,
         (ARRAY_AGG(o.ship_address->>'city' ORDER BY o.created_at DESC) FILTER (WHERE o.id IS NOT NULL))[1] AS city
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id`;
export const SEGMENT_SQL = `CASE WHEN s.orders = 0 THEN 'prospect'
  WHEN s.last_order < now() - interval '60 days' THEN 'at_risk'
  WHEN s.orders >= 3 THEN 'loyal' WHEN s.orders = 2 THEN 'repeat' ELSE 'new' END`;
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
const PAGE = 25;
const out = (r) => ({ ...r, orders: Number(r.orders), spent: Number(r.spent) });

export default async function customerRoutes(app, { db, G, parse, audit }) {
  app.get('/api/admin/customers', G('view'), async (req) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const params = [];
    let where = 'WHERE s.deleted_at IS NULL AND s.name IS NOT NULL';
    if (req.query.q) { params.push(like(String(req.query.q).trim().slice(0, 80))); where += ` AND (s.name ILIKE $${params.length} OR s.phone ILIKE $${params.length} OR s.email ILIKE $${params.length})`; }
    const base = `WITH s AS (${STATS} GROUP BY c.id), seg AS (SELECT s.*, ${SEGMENT_SQL} AS segment FROM s ${where})`;
    const counts = (await db.query(`${base} SELECT segment, COUNT(*) AS n FROM seg GROUP BY segment`, params)).rows
      .reduce((m, r) => ({ ...m, [r.segment]: Number(r.n) }), {});
    counts.all = Object.values(counts).reduce((a, n) => a + n, 0);
    const segParams = [...params];
    let segWhere = '';
    if (req.query.segment && req.query.segment !== 'all') { segParams.push(String(req.query.segment)); segWhere = `WHERE segment = $${segParams.length}`; }
    const sort = { ltv: 'spent DESC', orders: 'orders DESC, spent DESC', recent: 'last_order DESC NULLS LAST', joined: 'created_at DESC' }[req.query.sort] || 'created_at DESC';
    const total = Number((await db.query(`${base} SELECT COUNT(*) AS n FROM seg ${segWhere}`, segParams)).rows[0].n);
    const rows = (await db.query(`${base} SELECT * FROM seg ${segWhere} ORDER BY ${sort} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, segParams)).rows.map(out);
    return { rows, counts, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
  });

  app.get('/api/admin/customers/:id', G('view'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const s = (await db.query(`WITH s AS (${STATS} WHERE c.id = $1 GROUP BY c.id) SELECT s.*, ${SEGMENT_SQL} AS segment FROM s`, [id])).rows[0];
    if (!s) return reply.code(404).send({ error: 'Customer not found.' });
    const [orders, addresses, notes, favourites, returns, messages, refunds] = await Promise.all([
      db.query(`SELECT o.order_number, o.status, o.payment_method, o.payment_status, o.total, o.created_at,
                       (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id)::int AS items
                  FROM orders o WHERE o.customer_id = $1 ORDER BY o.created_at DESC`, [id]),
      db.query('SELECT name, phone, line1, line2, city, state, pin, is_default FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC', [id]),
      db.query('SELECT id, body, staff_email, created_at FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC', [id]),
      db.query(`SELECT i.product_id AS id, MAX(i.name) AS name, SUM(i.pack * i.qty)::int AS units FROM order_items i JOIN orders o ON o.id = i.order_id
                 WHERE o.customer_id = $1 AND o.${COUNTED} GROUP BY i.product_id ORDER BY units DESC LIMIT 4`, [id]),
      db.query(`SELECT r.id, r.return_number, r.status, r.reason, r.created_at, o.order_number FROM returns r JOIN orders o ON o.id = r.order_id
                 WHERE o.customer_id = $1 ORDER BY r.created_at DESC`, [id]),
      db.query(`SELECT n.event, n.channel, n.status, n.created_at, o.order_number FROM notifications n JOIN orders o ON o.id = n.order_id
                 WHERE o.customer_id = $1 ORDER BY n.created_at DESC LIMIT 20`, [id]),
      db.query(`SELECT COALESCE(SUM(r.amount), 0)::bigint AS n FROM refunds r JOIN orders o ON o.id = r.order_id WHERE o.customer_id = $1 AND r.status <> 'failed'`, [id]),
    ]);
    // browsing (only from browsers that accepted analytics), wishlist, open cart, reminders
    const [visits, timeline, wishlist, cart, reminders, consent, settings] = await Promise.all([
      db.query(`SELECT COUNT(*) AS visits, MIN(started_at) AS first_seen, MAX(last_at) AS last_seen, COALESCE(SUM(pages), 0) AS pages,
                       (ARRAY_AGG(device ORDER BY started_at DESC))[1] AS device, (ARRAY_AGG(source ORDER BY started_at))[1] AS first_source
                  FROM visits WHERE customer_id = $1`, [id]),
      db.query(`SELECT e.name, e.path, e.product_id, p.name AS product, e.props, e.created_at FROM events e LEFT JOIN products p ON p.id = e.product_id
                 WHERE e.customer_id = $1 AND (e.name <> 'page_view' OR e.product_id IS NOT NULL) ORDER BY e.created_at DESC LIMIT 30`, [id]),
      db.query('SELECT w.product_id AS id, p.name, w.created_at FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.customer_id = $1 ORDER BY w.created_at DESC', [id]),
      db.query(`SELECT id, items, item_count, value, updated_at, checkout_at, reminded_at FROM carts WHERE customer_id = $1 AND item_count > 0 AND order_id IS NULL
                 ORDER BY updated_at DESC LIMIT 1`, [id]),
      db.query('SELECT kind, channel, status, staff_email, created_at FROM marketing_messages WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10', [id]),
      db.query('SELECT marketing_consent, marketing_consent_at FROM customers WHERE id = $1', [id]),
      db.query(`SELECT value FROM settings WHERE key = 'reorder_days'`),
    ]);
    const reviews = (await db.query(`SELECT r.id, r.product_id, p.name AS product, r.rating, r.title, r.status, r.created_at FROM reviews r JOIN products p ON p.id = r.product_id
                                     WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [id])).rows;
    const v = visits.rows[0];
    const reorderDays = Number(settings.rows[0]?.value ?? 30) || 30;
    const openCart = cart.rows[0] ? { ...cart.rows[0], value: Number(cart.rows[0].value), items: typeof cart.rows[0].items === 'string' ? JSON.parse(cart.rows[0].items) : cart.rows[0].items } : null;
    const c = out(s);
    return {
      customer: { id: c.id, name: c.name, phone: c.phone, email: c.email, created_at: c.created_at, last_login_at: c.last_login_at, deleted_at: c.deleted_at },
      stats: { orders: c.orders, spent: c.spent, aov: c.orders ? Math.round(c.spent / c.orders) : 0, first_order: c.first_order, last_order: c.last_order,
        refunded: Number(refunds.rows[0].n), returns: returns.rows.filter((r) => r.status !== 'rejected').length, city: c.city },
      activity: { visits: Number(v.visits), pages: Number(v.pages), firstSeen: v.first_seen, lastSeen: v.last_seen, device: v.device, firstSource: v.first_source },
      timeline: timeline.rows, wishlist: wishlist.rows, cart: openCart, reminders: reminders.rows, reviews,
      marketingConsent: !!consent.rows[0]?.marketing_consent, marketingConsentAt: consent.rows[0]?.marketing_consent_at,
      reorderDue: c.last_order ? new Date(new Date(c.last_order).getTime() + reorderDays * 86400000).toISOString() : null, reorderDays,
      segment: s.segment, orders: orders.rows, addresses: addresses.rows, notes: notes.rows, favourites: favourites.rows, returns: returns.rows, messages: messages.rows,
    };
  });

  app.post('/api/admin/customers/:id/notes', G('orders.note'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({ body: z.string().trim().min(2, 'Write a note.').max(2000) }), req.body, reply); if (!body) return;
    const exists = (await db.query('SELECT 1 FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])).rows.length;
    if (!exists) return reply.code(404).send({ error: 'Customer not found.' });
    const n = (await db.query('INSERT INTO customer_notes (customer_id, staff_id, staff_email, body) VALUES ($1,$2,$3,$4) RETURNING id', [id, req.staff.id, req.staff.email, body.body])).rows[0];
    await audit(db.query, req, 'customer.note', 'customer', id, null, { note: body.body.slice(0, 80) });
    return { ok: true, id: n.id };
  });

  // notes can be removed by whoever wrote them, or an owner
  app.delete('/api/admin/customers/:id/notes/:noteId', G('orders.note'), async (req, reply) => {
    const n = (await db.query('SELECT * FROM customer_notes WHERE id = $1 AND customer_id = $2', [Number(req.params.noteId) || 0, req.params.id])).rows[0];
    if (!n) return reply.code(404).send({ error: 'Note not found.' });
    if (n.staff_id !== req.staff.id && req.staff.role !== 'owner') return reply.code(403).send({ error: 'Only the author or an owner can remove a note.' });
    await db.query('DELETE FROM customer_notes WHERE id = $1', [n.id]);
    await audit(db.query, req, 'customer.note_remove', 'customer', req.params.id, { note: n.body.slice(0, 80) }, null);
    return { ok: true };
  });
}
