// Admin insights and helpers: home-page overview, alerts, order stage counts, packing slips, search.
// Times are in India Standard Time. Sales count orders that are not awaiting payment or cancelled.
import { z } from 'zod';
import { createInsights, summarise } from '../insights.js';
import { resolveRange } from './range.js';

const COUNTED = `o.status NOT IN ('pending_payment', 'cancelled')`;
const IST = `'Asia/Kolkata'`;
export const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

// order stage tabs (Flipkart-style pipeline)
export const STAGES = {
  all: null,
  awaiting_payment: ['pending_payment'],
  to_pack: ['confirmed'],
  ready_to_ship: ['packed'],
  in_transit: ['shipped', 'out_for_delivery'],
  delivered: ['delivered'],
  returns: ['rto', 'returned'],
  cancelled: ['cancelled', 'refunded'],
};

export default async function reportRoutes(app, { db, G, parse, env }) {
  const insights = createInsights(env);
  const num = (v) => Number(v || 0);

  /** Things that need someone today: drives the "Needs your attention" strip and the bell. */
  async function attention() {
    const o = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'confirmed') AS to_pack,
             COUNT(*) FILTER (WHERE status = 'confirmed' AND created_at < now() - interval '24 hours') AS to_pack_late,
             COUNT(*) FILTER (WHERE status = 'packed') AS ready_to_ship,
             COUNT(*) FILTER (WHERE status = 'pending_payment') AS awaiting_payment,
             COUNT(*) FILTER (WHERE status IN ('rto', 'returned') AND updated_at > now() - interval '7 days') AS returns_week,
             COUNT(*) FILTER (WHERE status = 'cancelled' AND payment_status = 'paid') AS refund_due
        FROM orders`)).rows[0];
    const stock = (await db.query(`
      SELECT p.id, p.name, i.on_hand - i.reserved AS available, i.low_stock_at
        FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE p.active AND i.on_hand - i.reserved <= i.low_stock_at ORDER BY available`)).rows;
    const offersSoon = (await db.query(`
      SELECT name, starts_at, ends_at, CASE WHEN starts_at > now() THEN 'starts' ELSE 'ends' END AS what FROM offers
       WHERE active AND ((starts_at <= now() AND ends_at > now() AND ends_at < now() + interval '48 hours')
                      OR (starts_at > now() AND starts_at < now() + interval '24 hours')) ORDER BY LEAST(starts_at, ends_at)`)).rows;
    const reviewsPending = num((await db.query(`SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'`)).rows[0].n);
    const failed = num((await db.query(`SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND created_at > now() - interval '7 days'`)).rows[0].n);
    // batches still in stock that expire within 90 days (sell these first; plan a discount or write-off)
    const expiring = (await db.query(`
      SELECT b.batch_no, b.qty_remaining, p.name, b.expiry_date - (now() AT TIME ZONE 'Asia/Kolkata')::date AS days
        FROM batches b JOIN products p ON p.id = b.product_id
       WHERE b.written_off_at IS NULL AND b.qty_remaining > 0 AND b.expiry_date - (now() AT TIME ZONE 'Asia/Kolkata')::date BETWEEN 1 AND 90
       ORDER BY b.expiry_date`)).rows;
    const items = [];
    const add = (key, count, label, to, tone = 'info', detail) => count > 0 && items.push({ key, count, label, to, tone, detail });
    add('to_pack', num(o.to_pack), num(o.to_pack) === 1 ? 'order to pack' : 'orders to pack', '/admin/orders?stage=to_pack', num(o.to_pack_late) ? 'warn' : 'info',
      num(o.to_pack_late) ? `${num(o.to_pack_late)} waiting over 24 hours` : null);
    add('ready_to_ship', num(o.ready_to_ship), 'packed, ready to ship', '/admin/orders?stage=ready_to_ship');
    add('refund_due', num(o.refund_due), num(o.refund_due) === 1 ? 'cancelled order needs a refund' : 'cancelled orders need a refund', '/admin/orders?stage=cancelled', 'bad');
    const out = stock.filter((s) => s.available <= 0), low = stock.filter((s) => s.available > 0);
    add('out_of_stock', out.length, out.length === 1 ? 'product out of stock' : 'products out of stock', '/admin/products?filter=out', 'bad', out.map((s) => s.name).join(', '));
    add('low_stock', low.length, low.length === 1 ? 'product running low' : 'products running low', '/admin/products?filter=low', 'warn', low.map((s) => `${s.name} (${s.available})`).join(', '));
    const certs = (await db.query(`SELECT name, expires_on - (now() AT TIME ZONE 'Asia/Kolkata')::date AS days FROM certificates
                                     WHERE expires_on IS NOT NULL AND expires_on - (now() AT TIME ZONE 'Asia/Kolkata')::date <= 60 ORDER BY expires_on`)).rows;
    const expiredCerts = certs.filter((c) => c.days < 0), dueCerts = certs.filter((c) => c.days >= 0);
    add('certs_expired', expiredCerts.length, expiredCerts.length === 1 ? 'licence or certificate has expired' : 'licences or certificates have expired', '/admin/compliance', 'bad', expiredCerts.map((c) => c.name).join(' · '));
    add('certs_due', dueCerts.length, dueCerts.length === 1 ? 'licence or certificate expires within 60 days' : 'licences or certificates expire within 60 days', '/admin/compliance', 'warn', dueCerts.map((c) => `${c.name} (${c.days} days)`).join(' · '));
    const soon = expiring.filter((e) => e.days <= 30);
    add('expiring_30', soon.length, soon.length === 1 ? 'batch expires within 30 days' : 'batches expire within 30 days', '/admin/products?filter=expiring', 'bad',
      soon.map((e) => `${e.name.replace(/^TranzLife /, '')} ${e.batch_no}: ${e.qty_remaining} left, ${e.days} days`).join(' · '));
    const later = expiring.filter((e) => e.days > 30);
    add('expiring_90', later.length, later.length === 1 ? 'batch expires within 90 days' : 'batches expire within 90 days', '/admin/products?filter=expiring', 'warn',
      later.map((e) => `${e.name.replace(/^TranzLife /, '')} ${e.batch_no} (${e.days} days)`).join(' · '));
    const ret = (await db.query(`SELECT COUNT(*) FILTER (WHERE status = 'requested') AS requested, COUNT(*) FILTER (WHERE status = 'received') AS received FROM returns`)).rows[0];
    add('returns_received', num(ret.received), num(ret.received) === 1 ? 'return received, needs a decision' : 'returns received, need a decision', '/admin/returns?status=received', 'warn');
    add('returns_requested', num(ret.requested), num(ret.requested) === 1 ? 'return on its way back' : 'returns on their way back', '/admin/returns?status=requested', 'info');
    add('returns', num(o.returns_week), 'returned to us this week', '/admin/orders?stage=returns', 'muted');
    add('awaiting_payment', num(o.awaiting_payment), 'awaiting online payment', '/admin/orders?stage=awaiting_payment', 'muted');
    const ending = offersSoon.filter((o) => o.what === 'ends'), starting = offersSoon.filter((o) => o.what === 'starts');
    add('offers_ending', ending.length, ending.length === 1 ? 'offer ends within 48 hours' : 'offers end within 48 hours', '/admin/pricing', 'info', ending.map((o) => o.name).join(', '));
    add('offers_starting', starting.length, starting.length === 1 ? 'offer starts within 24 hours' : 'offers start within 24 hours', '/admin/pricing', 'muted', starting.map((o) => o.name).join(', '));
    add('reviews', reviewsPending, reviewsPending === 1 ? 'review waiting for a check' : 'reviews waiting for a check', '/admin/reviews', 'info');
    add('failed_messages', failed, failed === 1 ? 'customer message failed' : 'customer messages failed', '/admin/settings', 'warn');
    return items;
  }

  app.get('/api/admin/alerts', G('view'), async () => ({ items: await attention() }));

  // ---- Overview: KPIs vs previous period, trend, pipeline, best sellers, mixes, Tulsi topics ----
  app.get('/api/admin/overview', G('view'), async (req) => {
    // shared date ranges (server/admin/range.js): today / 7d / 30d / 90d / 365d / month / custom
    const rr = await resolveRange(db, req.query);
    const range = rr.key, days = rr.days;
    const b = { cur_from: rr.from, cur_to: rr.to, prev_from: rr.prevFrom, prev_to: rr.prevTo };

    const kpis = async (from, to) => {
      const r = (await db.query(`
        SELECT COALESCE(SUM(o.total), 0)::bigint AS revenue, COUNT(*) AS orders,
               COUNT(DISTINCT o.customer_id) AS buyers,
               COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.status <> 'failed' AND r.created_at >= $1 AND r.created_at < $2), 0)::bigint AS refunded
          FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2`, [from, to])).rows[0];
      const nc = (await db.query(`SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL AND name IS NOT NULL AND created_at >= $1 AND created_at < $2`, [from, to])).rows[0];
      const ret = (await db.query(`SELECT COUNT(DISTINCT order_id) AS n FROM order_events WHERE to_status IN ('rto','returned') AND created_at >= $1 AND created_at < $2`, [from, to])).rows[0];
      const revenue = num(r.revenue), orders = num(r.orders);
      return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0, newCustomers: num(nc.n), buyers: num(r.buyers), refunded: num(r.refunded), returns: num(ret.n) };
    };
    const [current, previous] = [await kpis(b.cur_from, b.cur_to), await kpis(b.prev_from, b.prev_to)];

    // trend: hourly for today, daily otherwise; previous period aligned point by point
    const unit = days <= 1 ? 'hour' : 'day';
    const points = days <= 1 ? 24 : days;
    const series = async (from) => (await db.query(`
      SELECT g.i, COALESCE(SUM(o.total), 0)::bigint AS revenue, COUNT(o.id) AS orders
        FROM generate_series(0, $3 - 1) AS g(i)
        LEFT JOIN orders o ON ${COUNTED}
         AND o.created_at >= $1::timestamptz + make_interval(${unit}s => g.i)
         AND o.created_at <  $1::timestamptz + make_interval(${unit}s => g.i + 1)
         AND o.created_at < $2
       GROUP BY g.i ORDER BY g.i`, [from, b.cur_to, points])).rows;
    const [cur, prev] = [await series(b.cur_from), await series(b.prev_from)];
    const labels = (await db.query(`
      SELECT g.i, to_char(($1::timestamptz + make_interval(${unit}s => g.i)) AT TIME ZONE ${IST}, $2) AS label
        FROM generate_series(0, $3 - 1) AS g(i) ORDER BY g.i`, [b.cur_from, unit === 'hour' ? 'HH24:00' : 'DD Mon', points])).rows;
    const trend = labels.map((l, i) => ({ label: l.label, revenue: num(cur[i]?.revenue), orders: num(cur[i]?.orders), prevRevenue: num(prev[i]?.revenue), prevOrders: num(prev[i]?.orders) }));

    const pipeline = (await db.query(`
      SELECT status, COUNT(*) AS n FROM orders o WHERE o.created_at >= $1 AND o.created_at < $2 GROUP BY status`, [b.cur_from, b.cur_to])).rows
      .reduce((m, r) => ({ ...m, [r.status]: num(r.n) }), {});

    const best = (await db.query(`
      SELECT i.product_id AS id, MAX(i.name) AS name, SUM(i.pack * i.qty)::int AS units, SUM(i.line_total)::bigint AS revenue
        FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY i.product_id ORDER BY revenue DESC LIMIT 6`, [b.cur_from, b.cur_to])).rows
      .map((r) => ({ ...r, revenue: num(r.revenue) }));

    const pay = (await db.query(`
      SELECT CASE WHEN o.payment_method = 'cod' THEN 'cod' ELSE 'prepaid' END AS kind, COUNT(*) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue
        FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY 1`, [b.cur_from, b.cur_to])).rows
      .reduce((m, r) => ({ ...m, [r.kind]: { orders: num(r.orders), revenue: num(r.revenue) } }), { cod: { orders: 0, revenue: 0 }, prepaid: { orders: 0, revenue: 0 } });

    // new vs returning: was this the customer's first counted order?
    const mix = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE first) AS first_orders, COUNT(*) FILTER (WHERE NOT first) AS repeat_orders
        FROM (SELECT o.created_at >= $1 AND o.created_at < $2 AS in_range,
                     NOT EXISTS (SELECT 1 FROM orders p WHERE p.customer_id = o.customer_id AND p.created_at < o.created_at
                                 AND p.status NOT IN ('pending_payment', 'cancelled')) AS first
                FROM orders o WHERE ${COUNTED}) x WHERE in_range`, [b.cur_from, b.cur_to])).rows[0];

    // what customers ask the Tulsi chat about (anonymous topic counts, stored by server/insights.js)
    let tulsi = null;
    try {
      const fromDay = new Date(b.cur_from).toISOString().slice(0, 10);
      const sum = summarise(await insights.read(), { from: fromDay });
      tulsi = { conversations: sum.conversations, topics: sum.topics.slice(0, 6).map((t) => ({ name: t.name, n: t.n, hasProduct: t.hasProduct })) };
    } catch { tulsi = null; }

    return {
      range, from: b.cur_from, to: b.cur_to, current, previous, trend, pipeline, best, payments: pay,
      customers: { first: num(mix.first_orders), repeat: num(mix.repeat_orders) },
      tulsi, attention: await attention(),
    };
  });

  // ---- Order stage counts for the tabs ----
  app.get('/api/admin/orders/counts', G('view'), async () => {
    const by = (await db.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')).rows.reduce((m, r) => ({ ...m, [r.status]: num(r.n) }), {});
    const counts = {};
    for (const [stage, statuses] of Object.entries(STAGES)) counts[stage] = statuses ? statuses.reduce((s, st) => s + (by[st] || 0), 0) : Object.values(by).reduce((a, n) => a + n, 0);
    return { counts };
  });

  // ---- Packing slips for several orders (printed together) ----
  app.get('/api/admin/orders/slips', G('view'), async (req, reply) => {
    const numbers = String(req.query.numbers || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (!numbers.length) return reply.code(400).send({ error: 'Choose at least one order.' });
    const orders = (await db.query(`
      SELECT o.id, o.order_number, o.created_at, o.payment_method, o.payment_status, o.total, o.subtotal, o.discount, o.shipping, o.ship_address, o.staff_note
        FROM orders o WHERE o.order_number = ANY($1) ORDER BY o.created_at`, [numbers])).rows;
    const items = (await db.query('SELECT id, order_id, name, size, pack, qty, line_total FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orders.map((o) => o.id)])).rows;
    // batch numbers per item (printed on the slip so a recall can be traced to the parcel)
    const allocs = (await db.query(`SELECT a.order_item_id, b.batch_no, b.expiry_date, a.qty FROM order_item_batches a JOIN batches b ON b.id = a.batch_id
                                     WHERE a.order_item_id = ANY($1) ORDER BY b.expiry_date`, [items.map((i) => i.id)])).rows;
    return {
      slips: orders.map((o) => ({
        number: o.order_number, createdAt: o.created_at, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
        total: o.total, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, note: o.staff_note,
        address: typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : o.ship_address,
        items: items.filter((i) => i.order_id === o.id).map(({ order_id, id, ...i }) => ({
          ...i, batches: allocs.filter((a) => a.order_item_id === id).map((a) => ({ batchNo: a.batch_no, expiry: a.expiry_date, qty: a.qty })),
        })),
      })),
    };
  });

  // ---- Global search (Ctrl+K): orders, customers, products ----
  app.get('/api/admin/search', G('view'), async (req, reply) => {
    const q = parse(z.string().trim().min(2).max(60), req.query.q, reply); if (q == null) return;
    const term = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    const digits = q.replace(/\D/g, '');
    const [orders, customers, products] = await Promise.all([
      db.query(`SELECT o.order_number, o.status, o.total, c.name FROM orders o JOIN customers c ON c.id = o.customer_id
                 WHERE o.order_number ILIKE $1 OR c.name ILIKE $1 OR c.phone ILIKE $2 OR o.phone ILIKE $2
                 ORDER BY o.created_at DESC LIMIT 6`, [term, digits.length >= 3 ? `%${digits}%` : term]),
      db.query(`SELECT id, name, phone, email FROM customers WHERE deleted_at IS NULL AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $2)
                 ORDER BY created_at DESC LIMIT 5`, [term, digits.length >= 3 ? `%${digits}%` : term]),
      db.query(`SELECT p.id, p.name, p.size, i.on_hand - i.reserved AS available FROM products p LEFT JOIN inventory i ON i.product_id = p.id
                 WHERE p.name ILIKE $1 OR p.id ILIKE $1 ORDER BY p.name LIMIT 5`, [term]),
    ]);
    return { orders: orders.rows, customers: customers.rows, products: products.rows };
  });
}
