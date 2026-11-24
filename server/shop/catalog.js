// Public catalogue for the shop: GET /api/products. Same shape as src/store/data/products.js
// (prices in rupees), so the site can swap the database version in without changing its pages.
// Stock is shown only as in / low / out, never exact numbers.

export function toPublic(p, media) {
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
    stock: available <= 0 ? 'out' : available <= (p.low_stock_at ?? 10) ? 'low' : 'in',
  };
}

export async function loadCatalog(q, { includeInactive = false } = {}) {
  const products = (await q(`
    SELECT p.*, i.on_hand - i.reserved AS available, i.low_stock_at
      FROM products p LEFT JOIN inventory i ON i.product_id = p.id
     ${includeInactive ? '' : 'WHERE p.active'} ORDER BY p.sort_order, p.name`)).rows;
  const media = (await q('SELECT product_id, url, thumb_url, alt FROM product_media ORDER BY sort, created_at')).rows;
  return products.map((p) => toPublic(p, media.filter((m) => m.product_id === p.id)));
}

export default async function catalogPublic(app, { db }) {
  app.get('/api/products', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache');                     // small list: always fresh, so staff edits show at once
    return { products: await loadCatalog(db.query) };
  });
  app.get('/api/products/:id', async (req, reply) => {
    const one = (await loadCatalog(db.query)).find((p) => p.id === req.params.id);
    if (!one) return reply.code(404).send({ error: 'Product not found.' });
    reply.header('Cache-Control', 'no-cache');
    return { product: one };
  });
}
