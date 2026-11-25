// Visitors & engagement (first-party tracking, see server/shop/track.js). India time.
//   GET  /api/admin/traffic?range=today|7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
//   GET  /api/admin/carts?status=abandoned|checkout|active|bought&page=
//   POST /api/admin/carts/:id/remind              SMS / WhatsApp, opted-in customers only
//   POST /api/admin/customers/:id/remind-reorder
// "Visitors" are browsers that accepted analytics; page views also count visitors who did not
// (anonymously). Orders and revenue always come from the orders table.
import { z } from 'zod';

const IST = `'Asia/Kolkata'`;
const COUNTED = `o.status NOT IN ('pending_payment', 'cancelled')`;
export const TRANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
const num = (v) => Number(v || 0);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PAGE = 25;

export default async function trafficRoutes(app, { db, G, parse, audit, reminders }) {
  /** Current window + the same length just before it. Custom ranges are whole IST days, max 366. */
  async function window(q) {
    let range = TRANGES[q.range] || q.range === 'custom' ? q.range : '30d';
    if (range === 'custom') {
      const f = ymd.safeParse(q.from), t = ymd.safeParse(q.to);
      if (!f.success || !t.success || q.from > q.to) range = '30d';
      else {
        const b = (await db.query(`
          SELECT ($1::date)::timestamp AT TIME ZONE ${IST} AS cur_from,
                 LEAST(($2::date + 1)::timestamp AT TIME ZONE ${IST}, now()) AS cur_to,
                 ($2::date - $1::date + 1) AS days`, [q.from, q.to])).rows[0];
        if (num(b.days) > 366) range = '30d';
        else {
          const p = (await db.query(`SELECT $1::timestamptz - make_interval(days => $2) AS prev_from`, [b.cur_from, num(b.days)])).rows[0];
          return { range, days: num(b.days), from: b.cur_from, to: b.cur_to, prevFrom: p.prev_from, prevTo: b.cur_from, fromDate: q.from, toDate: q.to };
        }
      }
    }
    const days = TRANGES[range];
    const b = (await db.query(`
      SELECT (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => $1 - 1)) AT TIME ZONE ${IST} AS cur_from, now() AS cur_to,
             (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => 2 * $1 - 1)) AT TIME ZONE ${IST} AS prev_from,
             now() - make_interval(days => $1) AS prev_to`, [days])).rows[0];
    return { range, days, from: b.cur_from, to: b.cur_to, prevFrom: b.prev_from, prevTo: b.prev_to };
  }

  async function kpis(from, to) {
    const v = (await db.query(`
      SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT visitor_id) FILTER (WHERE is_new) AS new_visitors,
             COUNT(*) AS visits, COALESCE(SUM(pages), 0) AS pages,
             COUNT(*) FILTER (WHERE pages <= 1) AS bounces
        FROM visits WHERE started_at >= $1 AND started_at < $2`, [from, to])).rows[0];
    const e = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE name = 'page_view') AS page_views,
             COUNT(*) FILTER (WHERE name = 'page_view' AND visitor_id IS NULL) AS anon_views,
             COUNT(*) FILTER (WHERE name = 'share') AS shares,
             COUNT(*) FILTER (WHERE name = 'add_to_cart') AS adds,
             COUNT(*) FILTER (WHERE name = 'wishlist_add') AS wishlist_adds
        FROM events WHERE created_at >= $1 AND created_at < $2`, [from, to])).rows[0];
    const o = (await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0)::bigint AS revenue, COUNT(DISTINCT customer_id) AS buyers,
             COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS tracked_buyers
        FROM orders o WHERE ${COUNTED} AND created_at >= $1 AND created_at < $2`, [from, to])).rows[0];
    const shareVisits = num((await db.query(`SELECT COUNT(*) AS n FROM visits WHERE source = 'share' AND started_at >= $1 AND started_at < $2`, [from, to])).rows[0].n);
    const c = (await db.query(`
      SELECT COUNT(*) AS n, COALESCE(SUM(value), 0)::bigint AS value FROM carts
       WHERE item_count > 0 AND order_id IS NULL AND updated_at < now() - interval '1 hour' AND updated_at >= $1 AND updated_at < $2`, [from, to])).rows[0];
    const visitors = num(v.visitors), visits = num(v.visits);
    return {
      visitors, newVisitors: num(v.new_visitors), returningVisitors: Math.max(0, visitors - num(v.new_visitors)), visits,
      pagesPerVisit: visits ? num(v.pages) / visits : 0, bounceRate: visits ? num(v.bounces) / visits : 0,
      pageViews: num(e.page_views), anonViews: num(e.anon_views), shares: num(e.shares), shareVisits, adds: num(e.adds), wishlistAdds: num(e.wishlist_adds),
      orders: num(o.orders), revenue: num(o.revenue), buyers: num(o.buyers),
      conversion: visitors ? Math.min(1, num(o.tracked_buyers) / visitors) : 0,
      abandoned: num(c.n), abandonedValue: num(c.value),
    };
  }

  app.get('/api/admin/traffic', G('view'), async (req) => {
    const w = await window(req.query);
    const P = [w.from, w.to];
    const unit = w.days <= 1 ? 'hour' : 'day';
    const [current, previous] = [await kpis(w.from, w.to), await kpis(w.prevFrom, w.prevTo)];

    const series = (await db.query(`
      WITH b AS (SELECT generate_series(date_trunc('${unit}', $1::timestamptz AT TIME ZONE ${IST}), date_trunc('${unit}', $2::timestamptz AT TIME ZONE ${IST}), interval '1 ${unit}') AS b)
      SELECT b.b AS start, to_char(b.b, $3) AS label,
             (SELECT COUNT(DISTINCT visitor_id) FROM visits v WHERE date_trunc('${unit}', v.started_at AT TIME ZONE ${IST}) = b.b) AS visitors,
             (SELECT COUNT(*) FROM events e WHERE e.name = 'page_view' AND date_trunc('${unit}', e.created_at AT TIME ZONE ${IST}) = b.b) AS views,
             (SELECT COUNT(*) FROM orders o WHERE ${COUNTED} AND date_trunc('${unit}', o.created_at AT TIME ZONE ${IST}) = b.b) AS orders
        FROM b ORDER BY b.b`, [w.from, w.to, unit === 'hour' ? 'HH24:00' : 'DD Mon'])).rows
      .map((r) => ({ label: r.label, visitors: num(r.visitors), views: num(r.views), orders: num(r.orders) }));

    // funnel: tracked visitors who reached each step
    const f = (await db.query(`
      SELECT COUNT(DISTINCT v.visitor_id) AS visited,
             COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'page_view' AND e.product_id IS NOT NULL) AS viewed,
             COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'add_to_cart') AS carted,
             COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'begin_checkout') AS checkout
        FROM visits v LEFT JOIN events e ON e.visit_id = v.id
       WHERE v.started_at >= $1 AND v.started_at < $2`, P)).rows[0];
    const bought = num((await db.query(`SELECT COUNT(DISTINCT visitor_id) AS n FROM orders o WHERE ${COUNTED} AND visitor_id IS NOT NULL AND created_at >= $1 AND created_at < $2`, P)).rows[0].n);
    const funnel = [
      ['visited', 'Visited the site', num(f.visited)], ['viewed', 'Viewed a product', num(f.viewed)],
      ['carted', 'Added to cart', num(f.carted)], ['checkout', 'Started checkout', num(f.checkout)], ['bought', 'Placed an order', bought],
    ].map(([key, label, n]) => ({ key, label, n }));

    const statuses = (await db.query(`SELECT status, COUNT(*) AS n, COALESCE(SUM(total), 0)::bigint AS value FROM orders WHERE created_at >= $1 AND created_at < $2 GROUP BY status`, P)).rows
      .map((r) => ({ status: r.status, n: num(r.n), value: num(r.value) }));

    const sources = (await db.query(`
      SELECT v.source, MAX(v.medium) AS medium, COUNT(DISTINCT v.visitor_id) AS visitors, COUNT(*) AS visits,
             COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue
        FROM visits v LEFT JOIN orders o ON o.visit_id = v.id AND ${COUNTED}
       WHERE v.started_at >= $1 AND v.started_at < $2 GROUP BY v.source ORDER BY visitors DESC LIMIT 12`, P)).rows
      .map((r) => ({ source: r.source, medium: r.medium, visitors: num(r.visitors), visits: num(r.visits), orders: num(r.orders), revenue: num(r.revenue) }));
    const campaigns = (await db.query(`
      SELECT v.campaign, v.source, COUNT(DISTINCT v.visitor_id) AS visitors, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue
        FROM visits v LEFT JOIN orders o ON o.visit_id = v.id AND ${COUNTED}
       WHERE v.campaign IS NOT NULL AND v.started_at >= $1 AND v.started_at < $2 GROUP BY 1, 2 ORDER BY visitors DESC LIMIT 10`, P)).rows
      .map((r) => ({ campaign: r.campaign, source: r.source, visitors: num(r.visitors), orders: num(r.orders), revenue: num(r.revenue) }));

    const pages = (await db.query(`
      SELECT split_part(path, '?', 1) AS path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
        FROM events WHERE name = 'page_view' AND created_at >= $1 AND created_at < $2 AND path IS NOT NULL
       GROUP BY 1 ORDER BY views DESC LIMIT 12`, P)).rows.map((r) => ({ path: r.path, views: num(r.views), visitors: num(r.visitors) }));
    const landing = (await db.query(`
      SELECT landing_path AS path, COUNT(*) AS visits, COUNT(*) FILTER (WHERE pages <= 1) AS bounces
        FROM visits WHERE started_at >= $1 AND started_at < $2 AND landing_path IS NOT NULL
       GROUP BY 1 ORDER BY visits DESC LIMIT 10`, P)).rows.map((r) => ({ path: r.path, visits: num(r.visits), bounceRate: num(r.visits) ? num(r.bounces) / num(r.visits) : 0 }));
    const devices = (await db.query(`SELECT COALESCE(device, 'unknown') AS name, COUNT(DISTINCT visitor_id) AS n FROM visits WHERE started_at >= $1 AND started_at < $2 GROUP BY 1 ORDER BY n DESC`, P)).rows
      .map((r) => ({ name: r.name, n: num(r.n) }));
    const browsers = (await db.query(`SELECT COALESCE(browser, 'Other') AS name, COUNT(DISTINCT visitor_id) AS n FROM visits WHERE started_at >= $1 AND started_at < $2 GROUP BY 1 ORDER BY n DESC LIMIT 6`, P)).rows
      .map((r) => ({ name: r.name, n: num(r.n) }));

    // per product: interest -> purchase
    const products = (await db.query(`
      SELECT p.id, p.name, p.active,
             COUNT(e.id) FILTER (WHERE e.name = 'page_view') AS views,
             COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'page_view') AS viewers,
             COUNT(e.id) FILTER (WHERE e.name = 'page_view' AND (e.props->>'oos') = 'true') AS oos_views,
             COUNT(e.id) FILTER (WHERE e.name = 'product_click') AS clicks,
             COUNT(e.id) FILTER (WHERE e.name = 'add_to_cart') AS adds,
             COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'add_to_cart') AS adders,
             COUNT(e.id) FILTER (WHERE e.name = 'wishlist_add') AS wishlist,
             COUNT(e.id) FILTER (WHERE e.name = 'share') AS shares,
             (SELECT COUNT(*) FROM wishlists wl WHERE wl.product_id = p.id) AS saved_now,
             (SELECT COALESCE(SUM(i.pack * i.qty), 0) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = p.id AND ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2) AS units,
             (SELECT COUNT(DISTINCT o.id) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = p.id AND ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2) AS orders
        FROM products p LEFT JOIN events e ON e.product_id = p.id AND e.created_at >= $1 AND e.created_at < $2
       GROUP BY p.id ORDER BY views DESC, p.sort_order`, P)).rows
      .map((r) => {
        const x = Object.fromEntries(Object.entries(r).map(([k, val]) => [k, ['id', 'name', 'active'].includes(k) ? val : num(val)]));
        return { ...x, savedNow: x.saved_now, oosViews: x.oos_views, viewToCart: x.viewers ? Math.min(1, x.adders / x.viewers) : 0, cartToOrder: x.adders ? Math.min(1, x.orders / x.adders) : 0 };
      });

    const engagement = (await db.query(`
      SELECT name, COUNT(*) AS n FROM events WHERE created_at >= $1 AND created_at < $2
         AND name IN ('share','chat_open','brochure_download','whatsapp_click','search','compare_add','wishlist_add','payment_failed') GROUP BY name`, P)).rows
      .reduce((m, r) => ({ ...m, [r.name]: num(r.n) }), {});
    const shareMethods = (await db.query(`SELECT COALESCE(props->>'method', 'other') AS method, COUNT(*) AS n FROM events WHERE name = 'share' AND created_at >= $1 AND created_at < $2 GROUP BY 1 ORDER BY n DESC`, P)).rows
      .map((r) => ({ method: r.method, n: num(r.n) }));
    const searches = (await db.query(`
      SELECT lower(props->>'q') AS q, COUNT(*) AS n, MIN(COALESCE((props->>'results')::int, 0)) AS min_results
        FROM events WHERE name = 'search' AND created_at >= $1 AND created_at < $2 AND COALESCE(props->>'q', '') <> ''
       GROUP BY 1 ORDER BY n DESC LIMIT 12`, P)).rows.map((r) => ({ q: r.q, n: num(r.n), noResults: num(r.min_results) === 0 }));

    // signed-in customers who showed interest (product views / cart) but have not ordered since
    const interested = (await db.query(`
      WITH i AS (
        SELECT e.customer_id, MAX(e.created_at) AS last_at, MIN(e.created_at) AS first_at,
               COUNT(*) FILTER (WHERE e.name = 'page_view') AS views, COUNT(*) FILTER (WHERE e.name = 'add_to_cart') AS adds,
               ARRAY_AGG(DISTINCT e.product_id) FILTER (WHERE e.product_id IS NOT NULL) AS products
          FROM events e WHERE e.customer_id IS NOT NULL AND e.created_at >= $1 AND e.created_at < $2
           AND (e.product_id IS NOT NULL OR e.name IN ('add_to_cart', 'begin_checkout'))
         GROUP BY e.customer_id)
      SELECT i.*, c.name, c.marketing_consent, k.value AS cart_value, k.id AS cart_id
        FROM i JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
        LEFT JOIN carts k ON k.customer_id = c.id AND k.item_count > 0 AND k.order_id IS NULL
       WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = i.customer_id AND ${COUNTED} AND o.created_at >= i.first_at)
       ORDER BY i.adds DESC, i.last_at DESC LIMIT 20`, P)).rows;
    const names = new Map((await db.query('SELECT id, name FROM products')).rows.map((r) => [r.id, r.name]));

    return {
      range: w.range, unit, from: w.from, to: w.to, fromDate: w.fromDate, toDate: w.toDate,
      current, previous, series, funnel, statuses, sources, campaigns, pages, landing, devices, browsers, products,
      engagement, shareMethods, searches,
      interested: interested.map((r) => ({ id: r.customer_id, name: r.name, lastAt: r.last_at, views: num(r.views), adds: num(r.adds), consent: r.marketing_consent,
        cartValue: r.cart_value == null ? null : num(r.cart_value), cartId: r.cart_id, products: (r.products || []).map((id) => names.get(id) || id) })),
      remindersReady: !!reminders?.ready,
    };
  });

  // ---- carts ----
  const CART_STATUS = {
    abandoned: `k.item_count > 0 AND k.order_id IS NULL AND k.updated_at < now() - interval '1 hour'`,
    checkout: `k.item_count > 0 AND k.order_id IS NULL AND k.checkout_at IS NOT NULL`,
    active: `k.item_count > 0 AND k.order_id IS NULL AND k.updated_at >= now() - interval '1 hour'`,
    bought: `k.order_id IS NOT NULL`,
  };
  app.get('/api/admin/carts', G('view'), async (req) => {
    const status = CART_STATUS[req.query.status] ? req.query.status : 'abandoned';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const signedIn = req.query.who === 'customers' ? ' AND k.customer_id IS NOT NULL' : '';
    const where = `WHERE ${CART_STATUS[status]}${signedIn}`;
    const counts = (await db.query(`SELECT ${Object.entries(CART_STATUS).map(([k, sql]) => `COUNT(*) FILTER (WHERE ${sql}) AS ${k}`).join(', ')},
                                           COALESCE(SUM(k.value) FILTER (WHERE ${CART_STATUS.abandoned}), 0)::bigint AS abandoned_value FROM carts k`)).rows[0];
    const total = num((await db.query(`SELECT COUNT(*) AS n FROM carts k ${where}`)).rows[0].n);
    const rows = (await db.query(`
      SELECT k.id, k.items, k.item_count, k.value, k.started_at, k.updated_at, k.checkout_at, k.reminded_at,
             c.id AS customer_id, c.name AS customer, c.marketing_consent, o.order_number,
             (SELECT v.source FROM visits v WHERE v.visitor_id = k.visitor_id ORDER BY v.started_at DESC LIMIT 1) AS source
        FROM carts k LEFT JOIN customers c ON c.id = k.customer_id AND c.deleted_at IS NULL LEFT JOIN orders o ON o.id = k.order_id
        ${where} ORDER BY k.updated_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`)).rows;
    const names = new Map((await db.query('SELECT id, name FROM products')).rows.map((r) => [r.id, r.name]));
    return {
      status, page, total, pages: Math.max(1, Math.ceil(total / PAGE)), remindersReady: !!reminders?.ready,
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, num(v)])),
      rows: rows.map((r) => {
        const items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
        return { ...r, value: num(r.value), items: items.map((i) => ({ ...i, name: names.get(i.id) || i.id })) };
      }),
    };
  });

  app.post('/api/admin/carts/:id/remind', G('customers.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const r = await reminders.sendCart(id, req.staff.email);
    if (!r.sent) return reply.code(409).send({ error: r.error });
    await audit(db.query, req, 'customer.cart_reminder', 'cart', id, null, null);
    return { ok: true };
  });

  app.post('/api/admin/customers/:id/remind-reorder', G('customers.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const r = await reminders.sendReorder(id, req.staff.email);
    if (!r.sent) return reply.code(409).send({ error: r.error });
    await audit(db.query, req, 'customer.reorder_reminder', 'customer', id, null, null);
    return { ok: true };
  });
}
