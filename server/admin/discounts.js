// Discount & campaign performance (staff). Shared date ranges (range.js); counted orders only
// (not awaiting payment, not cancelled). Every rupee of discount comes from order_discounts, written
// at checkout by server/shop/orders.js (offer / pack / prepaid).
//   GET /api/admin/discounts?range=…
import { resolveRange } from './range.js';

const COUNTED = `o.status NOT IN ('pending_payment', 'cancelled')`;
const IST = `'Asia/Kolkata'`;
const num = (v) => Number(v || 0);

export default async function discountRoutes(app, { db, G }) {
  const q = db.query;

  async function totals(from, to) {
    const r = (await q(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM order_discounts d WHERE d.order_id = o.id)) AS discounted,
             COALESCE(SUM(o.total) FILTER (WHERE EXISTS (SELECT 1 FROM order_discounts d WHERE d.order_id = o.id)), 0)::bigint AS discounted_revenue
        FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2`, [from, to])).rows[0];
    const by = (await q(`
      SELECT d.kind, COALESCE(SUM(d.amount), 0)::bigint AS amount FROM order_discounts d JOIN orders o ON o.id = d.order_id
       WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY d.kind`, [from, to])).rows
      .reduce((m, x) => ({ ...m, [x.kind]: num(x.amount) }), { offer: 0, pack: 0, prepaid: 0 });
    const given = by.offer + by.pack + by.prepaid, revenue = num(r.revenue), orders = num(r.orders), disc = num(r.discounted);
    return {
      orders, revenue, given, byKind: by, gross: revenue + given, rate: revenue + given ? given / (revenue + given) : 0,
      discountedOrders: disc, discountedShare: orders ? disc / orders : 0,
      aovDiscounted: disc ? Math.round(num(r.discounted_revenue) / disc) : 0,
      aovFull: orders - disc ? Math.round((revenue - num(r.discounted_revenue)) / (orders - disc)) : 0,
    };
  }

  app.get('/api/admin/discounts', G('view'), async (req) => {
    const rr = await resolveRange(db, req.query);
    const P = [rr.from, rr.to];
    const [current, previous] = [await totals(rr.from, rr.to), await totals(rr.prevFrom, rr.prevTo)];
    const unit = rr.unit === 'hour' ? 'hour' : rr.unit === 'month' ? 'month' : rr.unit === 'week' ? 'week' : 'day';

    // paid + discount per bucket (stacked: together they are the value before discounts)
    const series = (await q(`
      WITH b AS (SELECT generate_series(date_trunc('${unit}', $1::timestamptz AT TIME ZONE ${IST}), date_trunc('${unit}', $2::timestamptz AT TIME ZONE ${IST}), interval '1 ${unit}') AS b),
      o AS (SELECT o.id, o.total, date_trunc('${unit}', o.created_at AT TIME ZONE ${IST}) AS b FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2)
      SELECT to_char(b.b, $3) AS label,
             COALESCE((SELECT SUM(o.total) FROM o WHERE o.b = b.b), 0)::bigint AS paid,
             COALESCE((SELECT SUM(d.amount) FROM order_discounts d JOIN o ON o.id = d.order_id WHERE o.b = b.b), 0)::bigint AS discount
        FROM b ORDER BY b.b`, [...P, unit === 'hour' ? 'HH24:00' : unit === 'month' ? 'Mon YY' : unit === 'week' ? '"Wk of" DD Mon' : 'DD Mon'])).rows
      .map((x) => ({ label: x.label, paid: num(x.paid), discount: num(x.discount) }));

    // offers that ran (at least partly) in the range: results, and the days before as a baseline
    const offers = (await q(`
      SELECT f.* FROM offers f WHERE f.starts_at < $2 AND f.ends_at > $1 ORDER BY f.starts_at DESC`, P)).rows;
    const offerRows = [];
    for (const f of offers) {
      const s = (await q(`
        SELECT COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(i.pack * i.qty), 0)::int AS units, COALESCE(SUM(i.line_total), 0)::bigint AS revenue
          FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.offer_id = $1 AND ${COUNTED}`, [f.id])).rows[0];
      const given = num((await q(`SELECT COALESCE(SUM(d.amount), 0)::bigint AS n FROM order_discounts d JOIN orders o ON o.id = d.order_id
                                   WHERE d.kind = 'offer' AND d.ref_id = $1 AND ${COUNTED}`, [f.id])).rows[0].n);
      // lift: units per day of the covered products while the offer ran vs the same number of days just before it
      const end = Math.min(Date.parse(f.ends_at), Date.now());
      const days = Math.max(1, (end - Date.parse(f.starts_at)) / 86400000);
      const covered = f.product_ids.length ? f.product_ids : (await q('SELECT array_agg(id) AS ids FROM products')).rows[0].ids || [];
      const units = async (from, to) => num((await q(`
        SELECT COALESCE(SUM(i.pack * i.qty), 0) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${COUNTED} AND i.product_id = ANY($3) AND o.created_at >= $1 AND o.created_at < $2`, [from, to, covered])).rows[0].n);
      const during = await units(f.starts_at, new Date(end).toISOString());
      const before = await units(new Date(Date.parse(f.starts_at) - days * 86400000).toISOString(), f.starts_at);
      offerRows.push({
        id: f.id, name: f.name, kind: f.kind, startsAt: f.starts_at, endsAt: f.ends_at, active: f.active,
        status: !f.active ? 'off' : Date.parse(f.ends_at) <= Date.now() ? 'ended' : Date.parse(f.starts_at) > Date.now() ? 'scheduled' : 'live',
        discountType: f.discount_type, value: f.value, products: f.product_ids,
        orders: num(s.orders), units: s.units, revenue: num(s.revenue), given,
        perRupee: given ? num(s.revenue) / given : null,                       // revenue earned per ₹1 of discount
        unitsPerDay: during / days, unitsPerDayBefore: before / days,
        lift: before ? during / before - 1 : null,
      });
    }

    const packs = (await q(`
      SELECT i.pack, COUNT(DISTINCT o.id) AS orders, SUM(i.pack * i.qty)::int AS units, SUM(i.line_total)::bigint AS revenue
        FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2
       GROUP BY i.pack ORDER BY i.pack`, P)).rows;
    const packGiven = (await q(`
      SELECT d.ref_id AS pack, SUM(d.amount)::bigint AS given FROM order_discounts d JOIN orders o ON o.id = d.order_id
       WHERE d.kind = 'pack' AND ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY 1`, P)).rows;

    const prepaid = (await q(`
      SELECT CASE WHEN o.payment_method = 'cod' THEN 'cod' ELSE 'prepaid' END AS kind, COUNT(*) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue,
             COUNT(*) FILTER (WHERE o.status = 'rto') AS rto,
             COUNT(*) FILTER (WHERE o.status IN ('shipped','out_for_delivery','delivered','rto','returned')) AS shipped
        FROM orders o WHERE ${COUNTED} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY 1`, P)).rows
      .reduce((m, x) => ({ ...m, [x.kind]: { orders: num(x.orders), revenue: num(x.revenue), rtoRate: num(x.shipped) ? num(x.rto) / num(x.shipped) : 0 } }),
        { cod: { orders: 0, revenue: 0, rtoRate: 0 }, prepaid: { orders: 0, revenue: 0, rtoRate: 0 } });

    // campaigns: where the visits that ended in an order came from (UTM tags, shared links, search, social)
    const campaigns = (await q(`
      SELECT v.source, COALESCE(v.medium, '') AS medium, COALESCE(v.campaign, '') AS campaign,
             COUNT(DISTINCT v.visitor_id) AS visitors, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue,
             COALESCE(SUM((SELECT SUM(d.amount) FROM order_discounts d WHERE d.order_id = o.id)), 0)::bigint AS given
        FROM visits v LEFT JOIN orders o ON o.visit_id = v.id AND ${COUNTED}
       WHERE v.started_at >= $1 AND v.started_at < $2
       GROUP BY 1, 2, 3 ORDER BY revenue DESC, visitors DESC LIMIT 25`, P)).rows
      .map((x) => ({ source: x.source, medium: x.medium || null, campaign: x.campaign || null, visitors: num(x.visitors), orders: num(x.orders), revenue: num(x.revenue), given: num(x.given),
        conversion: num(x.visitors) ? Math.min(1, num(x.orders) / num(x.visitors)) : 0, perVisitor: num(x.visitors) ? num(x.revenue) / num(x.visitors) : 0 }));

    return {
      range: rr.key, unit, from: rr.from, to: rr.to, current, previous, series, offers: offerRows, prepaid, campaigns,
      packs: packs.map((k) => ({ pack: Number(k.pack), orders: num(k.orders), units: k.units, revenue: num(k.revenue), given: num(packGiven.find((g) => Number(g.pack) === Number(k.pack))?.given) })),
    };
  });
}
