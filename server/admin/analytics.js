// Analytics & reports (India time). Sales count orders that are not awaiting payment or cancelled.
//   GET /api/admin/analytics?range=30d|90d|365d
//   GET /api/admin/analytics.csv?range=…&report=sales|products|customers
import { RETURN_REASONS } from './returns.js';

const IST = `'Asia/Kolkata'`;
const COUNTED = `o.status NOT IN ('pending_payment', 'cancelled')`;
export const ARANGES = { '30d': [30, 'day'], '90d': [90, 'week'], '365d': [365, 'month'] };
const num = (v) => Number(v || 0);

export default async function analyticsRoutes(app, { db, G }) {
  async function compute(rangeKey) {
    const [days, unit] = ARANGES[rangeKey] || ARANGES['30d'];
    const b = (await db.query(`
      SELECT (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => $1 - 1)) AT TIME ZONE ${IST} AS cur_from,
             (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => 2 * $1 - 1)) AT TIME ZONE ${IST} AS prev_from`, [days])).rows[0];
    const W = `o.created_at >= $1`;

    // ---- series (bucketed) with first-order vs repeat split ----
    const series = (await db.query(`
      WITH ord AS (
        SELECT o.*, NOT EXISTS (SELECT 1 FROM orders p WHERE p.customer_id = o.customer_id AND p.created_at < o.created_at
                                AND p.status NOT IN ('pending_payment','cancelled')) AS first
          FROM orders o WHERE ${COUNTED} AND ${W}),
      buckets AS (
        SELECT generate_series(date_trunc('${unit}', $1::timestamptz AT TIME ZONE ${IST}), date_trunc('${unit}', now() AT TIME ZONE ${IST}), interval '1 ${unit}') AS b)
      SELECT to_char(bk.b, $2) AS label, bk.b::date AS start,
             COALESCE(SUM(ord.total), 0)::bigint AS revenue, COUNT(ord.id) AS orders,
             COUNT(ord.id) FILTER (WHERE ord.first) AS first_orders, COUNT(ord.id) FILTER (WHERE NOT ord.first) AS repeat_orders
        FROM buckets bk LEFT JOIN ord ON date_trunc('${unit}', ord.created_at AT TIME ZONE ${IST}) = bk.b
       GROUP BY bk.b ORDER BY bk.b`, [b.cur_from, unit === 'month' ? 'Mon YY' : unit === 'week' ? '"Wk of" DD Mon' : 'DD Mon'])).rows
      .map((r) => ({ label: r.label, start: r.start, revenue: num(r.revenue), orders: num(r.orders), first: num(r.first_orders), repeat: num(r.repeat_orders) }));

    // ---- totals now vs previous period ----
    const totals = async (from, to) => {
      const r = (await db.query(`
        SELECT COALESCE(SUM(total), 0)::bigint AS revenue, COUNT(*) AS orders, COUNT(DISTINCT customer_id) AS buyers
          FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2`, [from, to])).rows[0];
      const all = (await db.query(`
        SELECT COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled, COUNT(*) FILTER (WHERE status = 'rto') AS rto,
               COUNT(*) FILTER (WHERE status IN ('shipped','out_for_delivery','delivered','rto','returned')) AS shipped, COUNT(*) AS placed
          FROM orders o WHERE o.created_at >= $1 AND o.created_at < $2 AND status <> 'pending_payment'`, [from, to])).rows[0];
      const refunds = num((await db.query(`SELECT COALESCE(SUM(amount), 0) AS n FROM refunds WHERE status <> 'failed' AND created_at >= $1 AND created_at < $2`, [from, to])).rows[0].n);
      const repeat = (await db.query(`
        SELECT COUNT(*) FILTER (WHERE lifetime >= 2) AS repeaters, COUNT(*) AS buyers FROM (
          SELECT o.customer_id, (SELECT COUNT(*) FROM orders x WHERE x.customer_id = o.customer_id AND x.status NOT IN ('pending_payment','cancelled') AND x.created_at < $2) AS lifetime
            FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY o.customer_id) t`, [from, to])).rows[0];
      const revenue = num(r.revenue), orders = num(r.orders);
      return {
        revenue, orders, aov: orders ? Math.round(revenue / orders) : 0, buyers: num(r.buyers), refunds, netRevenue: revenue - refunds,
        cancelRate: num(all.placed) ? num(all.cancelled) / num(all.placed) : 0, rtoRate: num(all.shipped) ? num(all.rto) / num(all.shipped) : 0,
        repeatRate: num(repeat.buyers) ? num(repeat.repeaters) / num(repeat.buyers) : 0,
      };
    };
    const now = (await db.query('SELECT now() AS t')).rows[0].t;
    const [current, previous] = [await totals(b.cur_from, now), await totals(b.prev_from, b.cur_from)];

    // ---- products ----
    const products = (await db.query(`
      SELECT i.product_id AS id, MAX(i.name) AS name, SUM(i.pack * i.qty)::int AS units, SUM(i.line_total)::bigint AS revenue, COUNT(DISTINCT o.id) AS orders,
             COALESCE((SELECT SUM(ri.qty * oi.pack) FROM return_items ri JOIN returns r ON r.id = ri.return_id AND r.status <> 'rejected'
                        JOIN order_items oi ON oi.id = ri.order_item_id WHERE oi.product_id = i.product_id AND r.created_at >= $1), 0)::int AS returned
        FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${COUNTED} AND ${W}
       GROUP BY i.product_id ORDER BY revenue DESC`, [b.cur_from])).rows
      .map((p) => ({ ...p, revenue: num(p.revenue), orders: num(p.orders), returnRate: p.units ? p.returned / p.units : 0 }));

    // ---- where customers are ----
    const geo = async (field) => (await db.query(`
      SELECT COALESCE(NULLIF(o.ship_address->>'${field}', ''), 'Unknown') AS name, COUNT(*) AS orders, SUM(o.total)::bigint AS revenue
        FROM orders o WHERE ${COUNTED} AND ${W} GROUP BY 1 ORDER BY revenue DESC LIMIT 8`, [b.cur_from])).rows.map((r) => ({ name: r.name, orders: num(r.orders), revenue: num(r.revenue) }));
    const [states, cities] = [await geo('state'), await geo('city')];

    // ---- payments: COD vs prepaid, with RTO (returned to origin) rates ----
    const payments = (await db.query(`
      SELECT CASE WHEN o.payment_method = 'cod' THEN 'cod' ELSE 'prepaid' END AS kind, o.payment_method AS method,
             COUNT(*) FILTER (WHERE ${COUNTED}) AS orders, COALESCE(SUM(o.total) FILTER (WHERE ${COUNTED}), 0)::bigint AS revenue,
             COUNT(*) FILTER (WHERE o.status = 'rto') AS rto,
             COUNT(*) FILTER (WHERE o.status IN ('shipped','out_for_delivery','delivered','rto','returned')) AS shipped
        FROM orders o WHERE ${W} AND o.status <> 'pending_payment' GROUP BY 1, 2`, [b.cur_from])).rows;
    const pay = { cod: { orders: 0, revenue: 0, rto: 0, shipped: 0 }, prepaid: { orders: 0, revenue: 0, rto: 0, shipped: 0 }, methods: {} };
    for (const r of payments) {
      for (const k of ['orders', 'revenue', 'rto', 'shipped']) pay[r.kind][k] += num(r[k]);
      pay.methods[r.method] = { orders: num(r.orders), revenue: num(r.revenue) };
    }
    for (const k of ['cod', 'prepaid']) pay[k].rtoRate = pay[k].shipped ? pay[k].rto / pay[k].shipped : 0;

    // ---- returns by reason ----
    const returns = (await db.query(`SELECT reason, COUNT(*) AS n FROM returns WHERE created_at >= $1 AND status <> 'rejected' GROUP BY reason ORDER BY n DESC`, [b.cur_from])).rows
      .map((r) => ({ reason: r.reason, label: RETURN_REASONS[r.reason] || r.reason, n: num(r.n) }));

    // ---- top customers in the period ----
    const topCustomers = (await db.query(`
      SELECT c.id, c.name, COUNT(o.id) AS orders, SUM(o.total)::bigint AS spent FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE ${COUNTED} AND ${W} AND c.deleted_at IS NULL GROUP BY c.id ORDER BY spent DESC LIMIT 8`, [b.cur_from])).rows.map((r) => ({ ...r, orders: num(r.orders), spent: num(r.spent) }));

    return { range: rangeKey in ARANGES ? rangeKey : '30d', unit, from: b.cur_from, series, current, previous, products, states, cities, payments: pay, returns, topCustomers };
  }

  app.get('/api/admin/analytics', G('view'), async (req) => compute(String(req.query.range || '30d')));

  app.get('/api/admin/analytics.csv', G('view'), async (req, reply) => {
    const a = await compute(String(req.query.range || '30d'));
    const report = ['sales', 'products', 'customers'].includes(req.query.report) ? req.query.report : 'sales';
    const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const rs = (p) => (p / 100).toFixed(2);
    const rows = report === 'sales'
      ? [['Period', 'Revenue (₹)', 'Orders', 'First orders', 'Repeat orders'], ...a.series.map((s) => [s.label, rs(s.revenue), s.orders, s.first, s.repeat])]
      : report === 'products'
        ? [['Product', 'Units', 'Orders', 'Revenue (₹)', 'Units returned', 'Return rate %'], ...a.products.map((p) => [p.name, p.units, p.orders, rs(p.revenue), p.returned, (p.returnRate * 100).toFixed(1)])]
        : [['Customer', 'Orders in period', 'Spent in period (₹)'], ...a.topCustomers.map((c) => [c.name, c.orders, rs(c.spent)])];
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="tranzlife-${report}-${a.range}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  });
}
