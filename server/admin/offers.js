// Pricing & offers (staff).
//   GET    /api/admin/pricing                 products with MRP, regular price, live offer price, badge; offers; packs
//   PATCH  /api/admin/pricing/:id             { price?, mrp?, badge? }   (paise; badge = config or null)
//   POST   /api/admin/offers                  create an offer / flash sale
//   PATCH  /api/admin/offers/:id              edit (incl. switch on / off)
//   DELETE /api/admin/offers/:id              only if it never ran (otherwise switch it off: orders refer to it)
//   POST   /api/admin/offers/preview          prices an offer would give, before saving
//   PUT    /api/admin/packs                   pack sizes and their discounts
// Rules: selling price never above the MRP; an offer only lowers prices; every change is audited.
import { z } from 'zod';
import { BADGES, BADGE_TONES, MANUAL_BADGES, OFFER_BADGES, activeOffers, autoBadgeFacts, badgeProblem, effectivePrice, priceWith, appliesTo, resolveBadge } from '../shop/offers.js';

const rs = (p) => `₹${(p / 100).toLocaleString('en-IN')}`;

const badgeSchema = z.object({
  key: z.enum(MANUAL_BADGES),
  text: z.string().trim().max(18, 'Keep the badge to 18 characters.').optional(),
  tone: z.enum(Object.keys(BADGE_TONES)).optional(),
  enabled: z.boolean(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  auto: z.boolean().optional(),               // false = never show the automatic best seller / trending badge
}).refine((b) => b.key !== 'custom' || (b.text && b.text.length >= 2), { message: 'Write the badge text.' })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { message: 'The badge must end after it starts.' });

const offerSchema = z.object({
  name: z.string().trim().min(3, 'Give the offer a name customers will see, e.g. "Diwali offer".').max(60),
  kind: z.enum(['sale', 'flash']),
  productIds: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(200),
  discountType: z.enum(['percent', 'flat', 'price']),
  value: z.number().int().positive(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  active: z.boolean().optional().default(true),
  showCountdown: z.boolean().optional().default(false),
  badge: z.enum(OFFER_BADGES).nullable().optional(),
}).refine((o) => o.endsAt > o.startsAt, { message: 'The offer must end after it starts.', path: ['endsAt'] })
  .refine((o) => o.discountType !== 'percent' || (o.value >= 1 && o.value <= 90), { message: 'A percentage offer must be between 1% and 90%.', path: ['value'] })
  .refine((o) => o.kind !== 'flash' || Date.parse(o.endsAt) - Date.parse(o.startsAt) <= 7 * 86400000, { message: 'A flash sale can run for at most 7 days. Use a regular sale for longer.', path: ['endsAt'] });

const offerOut = (o, names, now = Date.now()) => ({
  id: o.id, name: o.name, kind: o.kind, productIds: o.product_ids, products: o.product_ids.length ? o.product_ids.map((id) => names.get(id) || id) : ['All products'],
  discountType: o.discount_type, value: o.value, startsAt: o.starts_at, endsAt: o.ends_at, active: o.active, showCountdown: o.show_countdown, badge: o.badge,
  status: !o.active ? 'off' : Date.parse(o.ends_at) <= now ? 'ended' : Date.parse(o.starts_at) > now ? 'scheduled' : 'live',
  createdBy: o.created_by, updatedAt: o.updated_at,
});

export default async function offerRoutes(app, { db, G, parse, audit }) {
  const q = db.query;
  const fail = (message, status = 400) => Object.assign(new Error(message), { status });

  /** Per product: what an offer would make it cost, and products it would not change. */
  async function previewOffer(o) {
    const products = (await q('SELECT id, name, price, mrp FROM products WHERE active OR id = ANY($1) ORDER BY sort_order', [o.productIds])).rows;
    const unknown = o.productIds.filter((id) => !products.some((p) => p.id === id));
    if (unknown.length) throw fail(`Unknown product: ${unknown.join(', ')}`);
    const fake = { product_ids: o.productIds, discount_type: o.discountType, value: o.value };
    return products.filter((p) => appliesTo(fake, p.id)).map((p) => {
      const regular = Math.min(p.price, p.mrp), price = priceWith(fake, regular);
      return { id: p.id, name: p.name, mrp: p.mrp, regular, price, offPct: Math.round((1 - price / p.mrp) * 100), noEffect: price >= regular };
    });
  }

  app.get('/api/admin/pricing', G('view'), async () => {
    const products = (await q(`SELECT p.id, p.name, p.short, p.price, p.mrp, p.active, p.badge, p.badge_config, p.sort_order FROM products p ORDER BY p.sort_order, p.name`)).rows;
    const live = await activeOffers(q);
    const facts = await autoBadgeFacts(q);
    const names = new Map(products.map((p) => [p.id, p.name]));
    const offers = (await q('SELECT * FROM offers ORDER BY (ends_at > now()) DESC, starts_at DESC LIMIT 200')).rows;
    const used = new Map((await q(`SELECT ref_id, COUNT(DISTINCT order_id)::int AS orders, SUM(amount)::bigint AS given FROM order_discounts WHERE kind = 'offer' GROUP BY ref_id`)).rows
      .map((r) => [r.ref_id, { orders: r.orders, given: Number(r.given) }]));
    const packs = (await q('SELECT qty, label, discount_pct FROM pack_options ORDER BY qty')).rows.map((k) => ({ qty: Number(k.qty), label: k.label, discountPct: Number(k.discount_pct) }));
    return {
      products: products.map((p) => {
        const eff = effectivePrice(p, live);
        const shown = resolveBadge(p, eff.offer, facts);
        return {
          id: p.id, name: p.name, short: p.short, active: p.active, mrp: p.mrp, price: p.price, effective: eff.price,
          offer: eff.offer ? { id: eff.offer.id, name: eff.offer.name, endsAt: eff.offer.ends_at } : null,
          badge: p.badge_config, shownBadge: shown, badgeProblem: badgeProblem(p, eff.offer),
          auto: { bestSeller: facts.bestSellers.has(p.id), trending: facts.trending.has(p.id) },
        };
      }),
      offers: offers.map((o) => ({ ...offerOut(o, names), used: used.get(o.id) || { orders: 0, given: 0 } })),
      packs, badges: BADGES, tones: BADGE_TONES, manualBadges: MANUAL_BADGES, offerBadges: OFFER_BADGES,
    };
  });

  app.patch('/api/admin/pricing/:id', G('products.edit'), async (req, reply) => {
    const body = parse(z.object({
      price: z.number().int().min(100, 'The price must be at least ₹1.').max(10_000_000).optional(),
      mrp: z.number().int().min(100).max(10_000_000).optional(),
      badge: badgeSchema.nullable().optional(),
    }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const p = (await t.query('SELECT id, name, price, mrp, badge_config FROM products WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!p) throw fail('Product not found.', 404);
      const next = { price: body.price ?? p.price, mrp: body.mrp ?? p.mrp };
      if (next.price > next.mrp) throw fail(`The selling price (${rs(next.price)}) cannot be more than the MRP (${rs(next.mrp)}).`);
      let badge = p.badge_config;
      if (body.badge !== undefined) {
        badge = body.badge;
        // NEW ARRIVAL counts its 30 days from when it was switched on
        if (badge?.key === 'new_arrival' && badge.enabled && !badge.startsAt) {
          badge = { ...badge, startsAt: p.badge_config?.key === 'new_arrival' && p.badge_config.startsAt ? p.badge_config.startsAt : new Date().toISOString() };
        }
      }
      await t.query('UPDATE products SET price = $2, mrp = $3, badge_config = $4, updated_at = now() WHERE id = $1', [p.id, next.price, next.mrp, badge == null ? null : JSON.stringify(badge)]);
      await audit(t.query, req, 'product.pricing', 'product', p.id, { price: p.price, mrp: p.mrp, badge: p.badge_config }, { price: next.price, mrp: next.mrp, badge });
      return { ok: true };
    });
  });

  app.post('/api/admin/offers/preview', G('view'), async (req, reply) => {
    const body = parse(offerSchema, req.body, reply); if (!body) return;
    return { prices: await previewOffer(body) };
  });

  async function saveOffer(req, reply, id) {
    const body = parse(offerSchema, req.body, reply); if (!body) return null;
    const prices = await previewOffer(body);
    if (!prices.length) throw fail('Choose at least one product that is on sale.');
    if (prices.every((p) => p.noEffect)) throw fail('This offer would not lower any price. Check the discount.');
    const before = id ? (await q('SELECT * FROM offers WHERE id = $1', [id])).rows[0] : null;
    if (id && !before) throw fail('Offer not found.', 404);
    const vals = [body.name, body.kind, body.productIds, body.discountType, body.value, body.startsAt, body.endsAt, body.active, body.showCountdown, body.badge ?? null];
    const row = id
      ? (await q(`UPDATE offers SET name=$2, kind=$3, product_ids=$4, discount_type=$5, value=$6, starts_at=$7, ends_at=$8, active=$9, show_countdown=$10, badge=$11, updated_at=now()
                  WHERE id = $1 RETURNING *`, [id, ...vals])).rows[0]
      : (await q(`INSERT INTO offers (name, kind, product_ids, discount_type, value, starts_at, ends_at, active, show_countdown, badge, created_by)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [...vals, req.staff.email])).rows[0];
    await audit(q, req, id ? 'offer.update' : 'offer.create', 'offer', row.id, before ? { name: before.name, value: before.value, active: before.active } : null,
      { name: row.name, kind: row.kind, type: row.discount_type, value: row.value, from: row.starts_at, to: row.ends_at, active: row.active });
    return { offer: offerOut(row, new Map(prices.map((p) => [p.id, p.name]))), prices, warnings: prices.filter((p) => p.noEffect).map((p) => `${p.name}: no change (already at or below this price)`) };
  }

  app.post('/api/admin/offers', G('products.edit'), (req, reply) => saveOffer(req, reply, null));
  app.patch('/api/admin/offers/:id', G('products.edit'), (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return undefined;
    return saveOffer(req, reply, id);
  });

  app.delete('/api/admin/offers/:id', G('products.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const o = (await q('SELECT * FROM offers WHERE id = $1', [id])).rows[0];
    if (!o) return reply.code(404).send({ error: 'Offer not found.' });
    if (Date.parse(o.starts_at) <= Date.now()) return reply.code(409).send({ error: 'This offer has already run, so orders refer to it. Switch it off instead.' });
    await q('DELETE FROM offers WHERE id = $1', [id]);
    await audit(q, req, 'offer.delete', 'offer', id, { name: o.name }, null);
    return { ok: true };
  });

  app.put('/api/admin/packs', G('settings'), async (req, reply) => {
    const body = parse(z.object({
      packs: z.array(z.object({ qty: z.number().int().min(1).max(12), label: z.string().trim().min(2).max(30), discountPct: z.number().min(0).max(50) })).min(1).max(6),
    }), req.body, reply); if (!body) return;
    const one = body.packs.find((k) => k.qty === 1);
    if (!one) throw fail('Keep a "Pack of 1" option.');
    if (one.discountPct !== 0) throw fail('A single pack has no pack discount (use an offer instead).');
    if (new Set(body.packs.map((k) => k.qty)).size !== body.packs.length) throw fail('Each pack size can appear only once.');
    const before = (await q('SELECT qty, label, discount_pct FROM pack_options ORDER BY qty')).rows;
    await db.tx(async (t) => {
      await t.query('DELETE FROM pack_options WHERE NOT (qty = ANY($1))', [body.packs.map((k) => k.qty)]);
      for (const k of body.packs) {
        await t.query(`INSERT INTO pack_options (qty, label, discount_pct) VALUES ($1,$2,$3) ON CONFLICT (qty) DO UPDATE SET label = EXCLUDED.label, discount_pct = EXCLUDED.discount_pct`,
          [k.qty, k.label, k.discountPct]);
      }
      await audit(t.query, req, 'settings.packs', 'settings', null, before, body.packs);
    });
    return { ok: true };
  });
}
