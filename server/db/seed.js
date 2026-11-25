// First-run data: the site's catalogue (src/store/data/products.js), pack offers and shipping rules.
// Only inserts what is missing. It never overwrites a price or stock level changed later
// (by the admin dashboard or by hand), so it is safe to run on every start.
// NOTE: prices are the site's placeholders until the client sends the approved list.
import { PRODUCTS, PACKS } from '../../src/store/data/products.js';
import { SITE } from '../../src/store/data/site.js';
import { INGREDIENTS } from '../../src/store/data/ingredients.js';

const SEED_STOCK = 100;   // placeholder opening stock per product

export async function seed(db, log = console) {
  let added = 0;
  await db.tx(async (t) => {
    for (const p of PRODUCTS) {
      const r = await t.query(
        `INSERT INTO products (id, name, format, size, price, mrp) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.format ?? null, p.size ?? null, Math.round(p.price * 100), Math.round(p.mrp * 100)]);
      if (r.affectedRows ?? r.rowCount) {
        added++;
        await t.query('INSERT INTO inventory (product_id, on_hand) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, SEED_STOCK]);
        await t.query(`INSERT INTO stock_movements (product_id, change, reason) VALUES ($1,$2,'seed')`, [p.id, SEED_STOCK]);
      }
    }
    // product content + built-in photos: copied once, so later edits in the dashboard are kept
    for (const [i, p] of PRODUCTS.entries()) {
      const content = {
        highlights: p.highlights || [], summary: p.summary || '', description: p.description || [], benefits: p.benefits || [],
        ingredients: p.ingredients || [], routine: p.routine || [], howToUse: p.howToUse || [], whoFor: p.whoFor || [],
        precautions: p.precautions || [], faqs: p.faqs || [], brochure: p.brochure || null,
      };
      const r = await t.query(
        `UPDATE products SET short = $2, tagline = $3, badge = $4, accent = $5, tint = $6, concerns = $7, sort_order = $8, content = $9,
                compliance = $10::jsonb || compliance
          WHERE id = $1 AND content = '{}'::jsonb`,
        [p.id, p.short ?? null, p.tagline ?? null, p.badge ?? null, p.accent ?? null, p.tint ?? null, p.concerns || [], (i + 1) * 10, JSON.stringify(content),
          JSON.stringify(p.compliance || {})]);
      if ((r.affectedRows ?? r.rowCount) && !(await t.query('SELECT 1 FROM product_media WHERE product_id = $1 LIMIT 1', [p.id])).rows.length) {
        for (const [k, url] of (p.images || []).entries()) {
          await t.query('INSERT INTO product_media (product_id, url, alt, sort) VALUES ($1,$2,$3,$4)', [p.id, url, p.name, k]);
        }
      }
    }
    // ingredient library: copied once; later edits in the dashboard are kept
    for (const [i, g] of INGREDIENTS.entries()) {
      await t.query(
        `INSERT INTO ingredients (id, name, alt, latin, type, part, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [g.id, g.name, g.alt ?? null, g.latin ?? null, g.type || 'herb', g.part ?? null, g.note ?? null, (i + 1) * 10]);
    }
    for (const k of PACKS) {
      await t.query('INSERT INTO pack_options (qty, label, discount_pct) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [k.qty, k.label, k.off * 100]);
    }
    const settings = {
      free_shipping_above: SITE.freeShippingAbove * 100,   // paise
      shipping_fee: SITE.shippingFee * 100,                // paise
      prepaid_discount_pct: SITE.prepaidDiscount * 100,    // %
      max_qty_per_line: 10,
    };
    for (const [key, value] of Object.entries(settings)) {
      await t.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT DO NOTHING', [key, JSON.stringify(value)]);
    }
  });
  if (added) (log.info ?? log.log).call(log, `[db] seeded ${added} products`);
}
