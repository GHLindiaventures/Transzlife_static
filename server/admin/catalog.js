// Admin catalogue: products (content, label declarations, visibility), photos, batches & expiry,
// completeness score. Prices in paise. Every change is audited.
import { z } from 'zod';
import { INGREDIENTS } from '../../src/store/data/ingredients.js';
import { createMedia, MAX_UPLOAD_MB } from '../shop/media.js';
import { TODAY_IST } from '../shop/batches.js';

const str = (max) => z.string().trim().max(max);
const list = (max, len = 300) => z.array(str(len)).max(max);
const contentSchema = z.object({
  highlights: list(8, 80), summary: str(600), description: list(6, 1500), benefits: list(10, 200),
  ingredients: z.array(z.string().max(60)).max(40), routine: z.array(z.object({ label: str(30), value: str(80) })).max(6),
  howToUse: list(10, 300), whoFor: list(8, 200), precautions: list(12, 300),
  faqs: z.array(z.tuple([str(200), str(1000)])).max(15), brochure: z.string().max(300).nullable(),
}).partial();
const complianceSchema = z.object({
  netQuantity: str(60), manufacturer: str(120), manufacturerAddress: str(300), licenceNo: str(80),
  countryOfOrigin: str(60), shelfLifeMonths: z.number().int().min(1).max(120).nullable(), storage: str(200),
  consumerCare: str(200), certifications: list(10, 60),
}).partial();
const productPatch = z.object({
  name: str(120).min(2), short: str(60), tagline: str(160), format: str(40), size: str(40),
  price: z.number().int().min(100).max(10_000_000), mrp: z.number().int().min(100).max(10_000_000),
  active: z.boolean(), gstRate: z.number().min(0).max(28).nullable(), hsnCode: z.union([z.string().trim().regex(/^\d{4,8}$/, 'HSN code is 4 to 8 digits.'), z.literal(''), z.null()]),
  lowStockAt: z.number().int().min(0).max(100000), badge: str(30).nullable(), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(), concerns: z.array(z.string().max(40)).max(10), sortOrder: z.number().int().min(0).max(10000),
  content: contentSchema, compliance: complianceSchema,
}).partial();

/** What a complete product listing needs. Score = share of checks passed. */
export function completeness(p, mediaCount, batchedUnits) {
  const c = p.content || {}, k = p.compliance || {};
  const checks = [
    ['Name and short name', !!(p.name && p.short)], ['Tagline', !!p.tagline], ['At least 2 photos', mediaCount >= 2],
    ['Summary (60+ characters)', (c.summary || '').length >= 60], ['Description', (c.description || []).some((d) => d.length > 40)],
    ['3+ highlights', (c.highlights || []).length >= 3], ['Ingredients', (c.ingredients || []).length >= 1],
    ['How to use', (c.howToUse || []).length >= 1 || (c.routine || []).length >= 1], ['Precautions', (c.precautions || []).length >= 1],
    ['3+ FAQs', (c.faqs || []).length >= 3], ['GST rate', p.gst_rate != null], ['HSN code', !!p.hsn_code],
    ['Net quantity', !!k.netQuantity], ['Manufacturer name and address', !!(k.manufacturer && k.manufacturerAddress)],
    ['Licence number', !!k.licenceNo], ['Shelf life', !!k.shelfLifeMonths], ['Consumer care contact', !!k.consumerCare],
    ['Stock in a batch with expiry date', batchedUnits > 0],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { score: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[™®]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export default async function catalogRoutes(app, { db, G, parse, audit, env, log }) {
  const media = createMedia(env, { log });

  // raw photo uploads (only for the media route; everything else stays JSON-only)
  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, (req, body, done) => done(null, body));

  const summaries = async () => {
    const batches = (await db.query(`
      SELECT product_id, COUNT(*) FILTER (WHERE qty_remaining > 0 AND written_off_at IS NULL) AS live,
             COALESCE(SUM(qty_remaining) FILTER (WHERE written_off_at IS NULL AND expiry_date > ${TODAY_IST}), 0) AS units,
             MIN(expiry_date) FILTER (WHERE qty_remaining > 0 AND written_off_at IS NULL AND expiry_date > ${TODAY_IST}) AS next_expiry
        FROM batches GROUP BY product_id`)).rows;
    const mediaRows = (await db.query('SELECT product_id, COUNT(*) AS n, MIN(COALESCE(thumb_url, url)) FILTER (WHERE sort = 0) AS first, (ARRAY_AGG(COALESCE(thumb_url, url) ORDER BY sort, created_at))[1] AS thumb FROM product_media GROUP BY product_id')).rows;
    const sales = (await db.query(`
      SELECT i.product_id, (o.created_at AT TIME ZONE 'Asia/Kolkata')::date - (now() AT TIME ZONE 'Asia/Kolkata')::date AS d, SUM(i.pack * i.qty)::int AS units
        FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status NOT IN ('pending_payment', 'cancelled') AND o.created_at > now() - interval '30 days'
       GROUP BY 1, 2`)).rows;
    return { batches, mediaRows, sales };
  };

  app.get('/api/admin/products', G('view'), async () => {
    const products = (await db.query(`
      SELECT p.*, i.on_hand, i.reserved, i.on_hand - i.reserved AS available, i.low_stock_at
        FROM products p LEFT JOIN inventory i ON i.product_id = p.id ORDER BY p.sort_order, p.name`)).rows;
    const { batches, mediaRows, sales } = await summaries();
    return {
      products: products.map((p) => {
        const b = batches.find((x) => x.product_id === p.id), m = mediaRows.find((x) => x.product_id === p.id);
        const mine = sales.filter((s) => s.product_id === p.id);
        const sold30 = mine.reduce((s, x) => s + x.units, 0);
        const spark = Array.from({ length: 14 }, (_, i) => mine.filter((s) => Number(s.d) === i - 13).reduce((a, x) => a + x.units, 0));
        const perDay = sold30 / 30;
        return {
          id: p.id, name: p.name, short: p.short, format: p.format, size: p.size, price: p.price, mrp: p.mrp, active: p.active,
          gst_rate: p.gst_rate == null ? null : Number(p.gst_rate), hsn_code: p.hsn_code, updated_at: p.updated_at,
          on_hand: p.on_hand, reserved: p.reserved, available: p.available, low_stock_at: p.low_stock_at,
          thumb: m?.thumb || null, photos: Number(m?.n || 0), sold_30d: sold30, spark,
          days_left: perDay > 0 ? Math.floor(p.available / perDay) : null,
          batches: Number(b?.live || 0), batched_units: Number(b?.units || 0), next_expiry: b?.next_expiry || null,
          completeness: completeness(p, Number(m?.n || 0), Number(b?.units || 0)),
        };
      }),
    };
  });

  async function loadFull(id) {
    const p = (await db.query(`SELECT p.*, i.on_hand, i.reserved, i.on_hand - i.reserved AS available, i.low_stock_at
                                 FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = $1`, [id])).rows[0];
    if (!p) return null;
    const mediaRows = (await db.query('SELECT id, url, thumb_url, alt, width, height, sort, storage_key IS NOT NULL AS uploaded FROM product_media WHERE product_id = $1 ORDER BY sort, created_at', [id])).rows;
    const batches = (await db.query(`
      SELECT b.*, (b.expiry_date - ${TODAY_IST}) AS days_to_expiry,
             (SELECT COALESCE(SUM(a.qty), 0) FROM order_item_batches a WHERE a.batch_id = b.id)::int AS shipped
        FROM batches b WHERE b.product_id = $1 ORDER BY (b.written_off_at IS NOT NULL OR b.qty_remaining = 0), b.expiry_date`, [id])).rows;
    const batchedUnits = batches.filter((b) => !b.written_off_at && b.days_to_expiry > 0).reduce((s, b) => s + b.qty_remaining, 0);
    return {
      product: {
        id: p.id, name: p.name, short: p.short || '', tagline: p.tagline || '', format: p.format || '', size: p.size || '',
        price: p.price, mrp: p.mrp, active: p.active, gstRate: p.gst_rate == null ? null : Number(p.gst_rate), hsnCode: p.hsn_code || '',
        badge: p.badge, accent: p.accent, tint: p.tint, concerns: p.concerns || [], sortOrder: p.sort_order,
        content: p.content || {}, compliance: p.compliance || {}, updatedAt: p.updated_at,
        onHand: p.on_hand, reserved: p.reserved, available: p.available, lowStockAt: p.low_stock_at,
      },
      media: mediaRows, batches, unbatched: Math.max(0, p.on_hand - batchedUnits),
      completeness: completeness(p, mediaRows.length, batchedUnits),
    };
  }

  app.get('/api/admin/products/:id', G('view'), async (req, reply) => {
    const full = await loadFull(req.params.id);
    if (!full) return reply.code(404).send({ error: 'Product not found.' });
    return full;
  });

  app.get('/api/admin/ingredients', G('view'), async () => ({
    ingredients: INGREDIENTS.map((i) => ({ id: i.id, name: i.name, latin: i.latin || '', part: i.part || '', type: i.type || '' })),
  }));

  // New product: starts hidden (not on sale) until it's ready
  app.post('/api/admin/products', G('products.edit'), async (req, reply) => {
    const body = parse(z.object({
      name: str(120).min(2, 'Enter the product name.'), format: str(40).optional().default(''), size: str(40).optional().default(''),
      price: z.number().int().min(100, 'Enter the price.').max(10_000_000), mrp: z.number().int().min(100, 'Enter the MRP.').max(10_000_000),
    }), req.body, reply); if (!body) return;
    if (body.price > body.mrp) throw fail('Price cannot be more than the MRP.');
    let id = slug(body.name) || 'product';
    for (let n = 2; (await db.query('SELECT 1 FROM products WHERE id = $1', [id])).rows.length; n++) id = `${slug(body.name)}-${n}`;
    await db.tx(async (t) => {
      const sort = Number((await t.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS s FROM products')).rows[0].s);
      await t.query(`INSERT INTO products (id, name, short, format, size, price, mrp, active, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)`,
        [id, body.name, body.name.replace(/™|®/g, ''), body.format, body.size, body.price, body.mrp, sort]);
      await t.query('INSERT INTO inventory (product_id, on_hand) VALUES ($1, 0)', [id]);
      await audit(t.query, req, 'product.create', 'product', id, null, body);
    });
    return { ok: true, id };
  });

  app.patch('/api/admin/products/:id', G('products.edit'), async (req, reply) => {
    const body = parse(productPatch, req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const p = (await t.query('SELECT p.*, i.low_stock_at FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = $1 FOR UPDATE OF p', [req.params.id])).rows[0];
      if (!p) throw fail('Product not found.', 404);
      const next = {
        name: body.name ?? p.name, short: body.short ?? p.short, tagline: body.tagline ?? p.tagline, format: body.format ?? p.format, size: body.size ?? p.size,
        price: body.price ?? p.price, mrp: body.mrp ?? p.mrp, active: body.active ?? p.active,
        gst_rate: body.gstRate === undefined ? p.gst_rate : body.gstRate, hsn_code: body.hsnCode === undefined ? p.hsn_code : (body.hsnCode || null),
        badge: body.badge === undefined ? p.badge : body.badge, accent: body.accent === undefined ? p.accent : body.accent,
        tint: body.tint === undefined ? p.tint : body.tint, concerns: body.concerns ?? p.concerns, sort_order: body.sortOrder ?? p.sort_order,
        content: body.content ? { ...(p.content || {}), ...body.content } : p.content,
        compliance: body.compliance ? { ...(p.compliance || {}), ...body.compliance } : p.compliance,
      };
      if (next.price > next.mrp) throw fail('Price cannot be more than the MRP.');
      await t.query(`UPDATE products SET name=$2, short=$3, tagline=$4, format=$5, size=$6, price=$7, mrp=$8, active=$9, gst_rate=$10, hsn_code=$11,
                       badge=$12, accent=$13, tint=$14, concerns=$15, sort_order=$16, content=$17, compliance=$18, updated_at=now() WHERE id=$1`,
        [p.id, next.name, next.short, next.tagline, next.format, next.size, next.price, next.mrp, next.active, next.gst_rate, next.hsn_code,
          next.badge, next.accent, next.tint, next.concerns, next.sort_order, JSON.stringify(next.content), JSON.stringify(next.compliance)]);
      if (body.lowStockAt !== undefined) await t.query('UPDATE inventory SET low_stock_at = $2 WHERE product_id = $1', [p.id, body.lowStockAt]);
      // audit only the fields that changed
      const before = {}, after = {};
      const cmp = { ...next, low_stock_at: body.lowStockAt ?? p.low_stock_at };
      for (const [k, v] of Object.entries(cmp)) {
        const old = k === 'gst_rate' ? (p[k] == null ? null : Number(p[k])) : p[k];
        const nv = k === 'gst_rate' ? (v == null ? null : Number(v)) : v;
        if (JSON.stringify(old ?? null) !== JSON.stringify(nv ?? null)) {
          before[k] = ['content', 'compliance'].includes(k) ? '(edited)' : old;
          after[k] = ['content', 'compliance'].includes(k) ? Object.keys(body[k] || {}).join(', ') : nv;
        }
      }
      if (Object.keys(after).length) await audit(t.query, req, 'product.update', 'product', p.id, before, after);
      return { ok: true };
    });
  });

  // ---- photos ------------------------------------------------------------
  app.post('/api/admin/products/:id/media', { ...G('products.edit'), bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Upload a JPG, PNG or WebP photo.' });
    const p = (await db.query('SELECT id, name FROM products WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return reply.code(404).send({ error: 'Product not found.' });
    const count = Number((await db.query('SELECT COUNT(*) AS n FROM product_media WHERE product_id = $1', [p.id])).rows[0].n);
    if (count >= 12) throw fail('A product can have up to 12 photos.');
    const up = await media.uploadProductImage(p.id, req.body, req.headers['content-type'].split(';')[0]);
    const row = (await db.query(
      `INSERT INTO product_media (product_id, url, thumb_url, storage_key, alt, width, height, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [p.id, up.url, up.thumbUrl, up.key, p.name, up.width, up.height, count])).rows[0];
    await audit(db.query, req, 'product.photo_add', 'product', p.id, null, { photo: up.key });
    return { ok: true, id: row.id, url: up.url, thumbUrl: up.thumbUrl };
  });

  app.patch('/api/admin/products/:id/media', G('products.edit'), async (req, reply) => {
    const body = parse(z.object({ order: z.array(z.string().uuid()).max(12).optional(), alt: z.record(z.string().uuid(), str(160)).optional() }), req.body, reply); if (!body) return;
    await db.tx(async (t) => {
      for (const [i, mid] of (body.order || []).entries()) await t.query('UPDATE product_media SET sort = $3 WHERE id = $1 AND product_id = $2', [mid, req.params.id, i]);
      for (const [mid, alt] of Object.entries(body.alt || {})) await t.query('UPDATE product_media SET alt = $3 WHERE id = $1 AND product_id = $2', [mid, req.params.id, alt]);
    });
    if (body.order) await audit(db.query, req, 'product.photo_order', 'product', req.params.id, null, { order: body.order.length });
    return { ok: true };
  });

  app.delete('/api/admin/products/:id/media/:mediaId', G('products.edit'), async (req, reply) => {
    const m = (await db.query('SELECT * FROM product_media WHERE id = $1 AND product_id = $2', [req.params.mediaId, req.params.id])).rows[0];
    if (!m) return reply.code(404).send({ error: 'Photo not found.' });
    await db.query('DELETE FROM product_media WHERE id = $1', [m.id]);
    await media.remove(m.storage_key);
    await audit(db.query, req, 'product.photo_remove', 'product', req.params.id, { photo: m.storage_key || m.url }, null);
    return { ok: true };
  });

  // ---- batches -----------------------------------------------------------
  app.post('/api/admin/products/:id/batches', G('stock.edit'), async (req, reply) => {
    const body = parse(z.object({
      batchNo: str(40).min(1, 'Enter the batch number.'), mfgDate: z.string().date('Enter the manufacturing date.'),
      expiryDate: z.string().date('Enter the expiry date.'), qty: z.number().int().min(1, 'Enter how many units.').max(1_000_000),
      notes: str(300).optional().default(''),
    }), req.body, reply); if (!body) return;
    if (body.expiryDate <= body.mfgDate) throw fail('The expiry date must be after the manufacturing date.');
    const today = new Date().toISOString().slice(0, 10);
    if (body.mfgDate > today) throw fail('The manufacturing date cannot be in the future.');
    if (body.expiryDate <= today) throw fail('This batch has already expired, so it cannot be added to stock.');
    try {
      return await db.tx(async (t) => {
        const inv = (await t.query('SELECT on_hand FROM inventory WHERE product_id = $1 FOR UPDATE', [req.params.id])).rows[0];
        if (!inv) throw fail('Product not found.', 404);
        const b = (await t.query(
          `INSERT INTO batches (product_id, batch_no, mfg_date, expiry_date, qty_received, qty_remaining, notes) VALUES ($1,$2,$3,$4,$5,$5,$6) RETURNING id`,
          [req.params.id, body.batchNo.toUpperCase(), body.mfgDate, body.expiryDate, body.qty, body.notes || null])).rows[0];
        await t.query('UPDATE inventory SET on_hand = on_hand + $2 WHERE product_id = $1', [req.params.id, body.qty]);
        await t.query(`INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,'restock',$3)`, [req.params.id, body.qty, `batch ${body.batchNo.toUpperCase()}`]);
        await audit(t.query, req, 'batch.receive', 'product', req.params.id, null, { batch: body.batchNo.toUpperCase(), qty: body.qty, expiry: body.expiryDate });
        return { ok: true, id: b.id, onHand: inv.on_hand + body.qty };
      });
    } catch (e) {
      if (e.code === '23505') throw fail('This product already has a batch with that number.', 409);
      throw e;
    }
  });

  // write off what's left of a batch (damaged, recalled, expired early)
  app.post('/api/admin/batches/:id/write-off', G('stock.edit'), async (req, reply) => {
    const body = parse(z.object({ reason: str(200).min(3, 'Give a reason.') }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const b = (await t.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!b) throw fail('Batch not found.', 404);
      if (b.written_off_at || b.qty_remaining === 0) throw fail('Nothing left in this batch to write off.');
      const inv = (await t.query('SELECT on_hand, reserved FROM inventory WHERE product_id = $1 FOR UPDATE', [b.product_id])).rows[0];
      const take = Math.min(b.qty_remaining, inv.on_hand - inv.reserved);
      if (take < b.qty_remaining) throw fail(`${b.qty_remaining - take} unit(s) are held for unpaid orders. Try again once those are paid or released.`);
      await t.query('UPDATE inventory SET on_hand = on_hand - $2 WHERE product_id = $1', [b.product_id, take]);
      await t.query('UPDATE batches SET qty_remaining = 0, written_off_at = now(), notes = concat_ws(E\'\\n\', notes, $2::text) WHERE id = $1', [b.id, `Written off: ${body.reason}`]);
      await t.query(`INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,'write_off',$3)`, [b.product_id, -take, `batch ${b.batch_no}: ${body.reason}`]);
      await audit(t.query, req, 'batch.write_off', 'product', b.product_id, { batch: b.batch_no, remaining: b.qty_remaining }, { reason: body.reason });
      return { ok: true, units: take };
    });
  });

  // recall view: which orders / customers received this batch
  app.get('/api/admin/batches/:id', G('view'), async (req, reply) => {
    const b = (await db.query(`SELECT b.*, p.name AS product, (b.expiry_date - ${TODAY_IST}) AS days_to_expiry FROM batches b JOIN products p ON p.id = b.product_id WHERE b.id = $1`, [req.params.id])).rows[0];
    if (!b) return reply.code(404).send({ error: 'Batch not found.' });
    const orders = (await db.query(`
      SELECT o.order_number, o.status, o.created_at, c.id AS customer_id, c.name, c.phone, a.qty
        FROM order_item_batches a JOIN order_items i ON i.id = a.order_item_id JOIN orders o ON o.id = i.order_id JOIN customers c ON c.id = o.customer_id
       WHERE a.batch_id = $1 ORDER BY o.created_at DESC`, [b.id])).rows;
    return { batch: b, orders };
  });
}
