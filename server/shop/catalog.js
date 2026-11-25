// Public catalogue for the shop: GET /api/products. Same shape as src/store/data/products.js
// (prices in rupees), so the site can swap the database version in without changing its pages.
// Stock is shown only as in / low / out, never exact numbers.

export const SOLD_MIN = 5;

export function toPublic(p, media, batch = null) {
  const c = p.content || {};
  const available = Number(p.available ?? 0);
  return {
    id: p.id, name: p.name, short: p.short || p.name, tagline: p.tagline || '', format: p.format || '', size: p.size || '',
    price: p.price / 100, mrp: p.mrp / 100, badge: p.badge || null, accent: p.accent || '#1f6b3c', tint: p.tint || '#eef4ea',
    concerns: p.concerns || [],
    images: media.length ? media.map((m) => m.url) : ['/assets/logo.png'],      // no photo yet: brand logo
    brochure: c.brochure || null,
    highlights: c.highlights || [], summary: c.summary || '', description: c.description || [], benefits: c.benefits || [],
    ingredients: c.ingredients || [], routine: c.routine || [], howToUse: c.howToUse || [], whoFor: c.whoFor || [],
    precautions: c.precautions || [], faqs: c.faqs || [],
    compliance: p.compliance || {},
    // the batch a customer receives next (soonest expiry still in stock): shown as "Use before"
    batch: batch ? { mfg: batch.mfg_date, expiry: batch.expiry_date } : null,
    stock: available <= 0 ? 'out' : available <= (p.low_stock_at ?? 10) ? 'low' : 'in',
    rating: { avg: Number(p.rating_avg || 0), count: Number(p.rating_count || 0) },
    // real orders in the last 30 days, shown only from SOLD_MIN (small numbers are not shown)
    sold30: Number(p.sold30 || 0) >= SOLD_MIN ? Number(p.sold30) : null,
  };
}

export async function loadCatalog(q, { includeInactive = false } = {}) {
  const products = (await q(`
    SELECT p.*, i.on_hand - i.reserved AS available, i.low_stock_at,
           (SELECT COUNT(DISTINCT o.id) FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE oi.product_id = p.id AND o.status NOT IN ('pending_payment', 'cancelled') AND o.created_at > now() - interval '30 days') AS sold30
      FROM products p LEFT JOIN inventory i ON i.product_id = p.id
     ${includeInactive ? '' : 'WHERE p.active'} ORDER BY p.sort_order, p.name`)).rows;
  const media = (await q('SELECT product_id, url, thumb_url, alt FROM product_media ORDER BY sort, created_at')).rows;
  const batches = (await q(`SELECT DISTINCT ON (product_id) product_id, mfg_date, expiry_date FROM batches
                             WHERE qty_remaining > 0 AND written_off_at IS NULL AND expiry_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
                             ORDER BY product_id, expiry_date, created_at`)).rows;
  return products.map((p) => toPublic(p, media.filter((m) => m.product_id === p.id), batches.find((b) => b.product_id === p.id)));
}

/** Ingredient library for the site (photos fall back to the built-in ones when none was uploaded). */
export async function loadIngredients(q) {
  return (await q('SELECT id, name, alt, latin, type, part, note, photo_url FROM ingredients WHERE active ORDER BY sort_order, name')).rows
    .map((g) => ({ id: g.id, name: g.name, alt: g.alt || '', latin: g.latin || '', type: g.type, part: g.part || '', note: g.note || '', ...(g.photo_url ? { photoUrl: g.photo_url } : {}) }));
}

export default async function catalogPublic(app, { db }) {
  app.get('/api/products', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache');                     // small list: always fresh, so staff edits show at once
    return { products: await loadCatalog(db.query) };
  });
  app.get('/api/ingredients', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache');
    return { ingredients: await loadIngredients(db.query) };
  });
  app.get('/api/products/:id', async (req, reply) => {
    const one = (await loadCatalog(db.query)).find((p) => p.id === req.params.id);
    if (!one) return reply.code(404).send({ error: 'Product not found.' });
    reply.header('Cache-Control', 'no-cache');
    return { product: one };
  });
}
