// Ingredient library (shown on the website) and the compliance centre (licences / certificates
// with expiry reminders and private documents). Everything is audited.
import { z } from 'zod';
import { createMedia, MAX_UPLOAD_MB } from '../shop/media.js';

const str = (max) => z.string().trim().max(max);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
export const INGREDIENT_TYPES = ['herb', 'oil', 'nutrient', 'homeo'];
export const CERT_KINDS = { licence: 'Licence', certificate: 'Certificate', registration: 'Registration', test_report: 'Lab test report' };
const EXPIRY_WARN_DAYS = 60;

/** valid / expiring (within 60 days) / expired / no_expiry */
export const certStatus = (daysLeft) => (daysLeft == null ? 'no_expiry' : daysLeft < 0 ? 'expired' : daysLeft <= EXPIRY_WARN_DAYS ? 'expiring' : 'valid');

export default async function complianceRoutes(app, { db, G, parse, audit, env, log }) {
  const media = createMedia(env, { log });
  // PDFs for certificate documents (images are already accepted as raw uploads by catalog.js)
  app.addContentTypeParser('application/pdf', { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, (req, body, done) => done(null, body));

  // ======================================================================
  // Ingredient library
  // ======================================================================
  app.get('/api/admin/ingredients', G('view'), async () => {
    const rows = (await db.query('SELECT * FROM ingredients ORDER BY sort_order, name')).rows;
    const products = (await db.query(`SELECT id, name, content->'ingredients' AS ing FROM products`)).rows;
    return {
      ingredients: rows.map((g) => ({
        id: g.id, name: g.name, alt: g.alt || '', latin: g.latin || '', type: g.type, part: g.part || '', note: g.note || '',
        photo_url: g.photo_url, active: g.active, updated_at: g.updated_at,
        used_in: products.filter((p) => (Array.isArray(p.ing) ? p.ing : []).includes(g.id)).map((p) => ({ id: p.id, name: p.name })),
      })),
      types: INGREDIENT_TYPES,
    };
  });

  const ingBody = z.object({
    name: str(80).min(2, 'Enter the name.'), alt: str(80), latin: str(120), type: z.enum(INGREDIENT_TYPES),
    part: str(60), note: str(800), active: z.boolean(),
  }).partial();

  app.post('/api/admin/ingredients', G('products.edit'), async (req, reply) => {
    const body = parse(ingBody.required({ name: true }), req.body, reply); if (!body) return;
    let id = slug(body.name) || 'ingredient';
    for (let n = 2; (await db.query('SELECT 1 FROM ingredients WHERE id = $1', [id])).rows.length; n++) id = `${slug(body.name)}-${n}`;
    const sort = Number((await db.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS s FROM ingredients')).rows[0].s);
    await db.query(`INSERT INTO ingredients (id, name, alt, latin, type, part, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, body.name, body.alt || null, body.latin || null, body.type || 'herb', body.part || null, body.note || null, sort]);
    await audit(db.query, req, 'ingredient.create', 'ingredient', id, null, { name: body.name });
    return { ok: true, id };
  });

  app.patch('/api/admin/ingredients/:id', G('products.edit'), async (req, reply) => {
    const body = parse(ingBody, req.body, reply); if (!body) return;
    const g = (await db.query('SELECT * FROM ingredients WHERE id = $1', [req.params.id])).rows[0];
    if (!g) return reply.code(404).send({ error: 'Ingredient not found.' });
    const next = { name: body.name ?? g.name, alt: body.alt ?? g.alt, latin: body.latin ?? g.latin, type: body.type ?? g.type, part: body.part ?? g.part, note: body.note ?? g.note, active: body.active ?? g.active };
    await db.query(`UPDATE ingredients SET name=$2, alt=$3, latin=$4, type=$5, part=$6, note=$7, active=$8, updated_at=now() WHERE id=$1`,
      [g.id, next.name, next.alt || null, next.latin || null, next.type, next.part || null, next.note || null, next.active]);
    const changed = Object.keys(next).filter((k) => (next[k] ?? null) !== (g[k] ?? null));
    if (changed.length) await audit(db.query, req, 'ingredient.update', 'ingredient', g.id, Object.fromEntries(changed.map((k) => [k, g[k]])), Object.fromEntries(changed.map((k) => [k, next[k]])));
    return { ok: true };
  });

  app.post('/api/admin/ingredients/:id/photo', { ...G('products.edit'), bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Upload a JPG, PNG or WebP photo.' });
    const g = (await db.query('SELECT * FROM ingredients WHERE id = $1', [req.params.id])).rows[0];
    if (!g) return reply.code(404).send({ error: 'Ingredient not found.' });
    const up = await media.uploadProductImage(g.id, req.body, req.headers['content-type'].split(';')[0], 'ingredients');
    await db.query('UPDATE ingredients SET photo_url = $2, photo_key = $3, updated_at = now() WHERE id = $1', [g.id, up.url, up.key]);
    if (g.photo_key) await media.remove(g.photo_key);
    await audit(db.query, req, 'ingredient.photo', 'ingredient', g.id, g.photo_key ? { photo: g.photo_key } : null, { photo: up.key });
    return { ok: true, url: up.url };
  });

  app.delete('/api/admin/ingredients/:id/photo', G('products.edit'), async (req, reply) => {
    const g = (await db.query('SELECT * FROM ingredients WHERE id = $1', [req.params.id])).rows[0];
    if (!g) return reply.code(404).send({ error: 'Ingredient not found.' });
    await db.query('UPDATE ingredients SET photo_url = NULL, photo_key = NULL, updated_at = now() WHERE id = $1', [g.id]);
    if (g.photo_key) await media.remove(g.photo_key);
    await audit(db.query, req, 'ingredient.photo_remove', 'ingredient', g.id, { photo: g.photo_key }, null);
    return { ok: true };
  });

  app.delete('/api/admin/ingredients/:id', G('products.edit'), async (req, reply) => {
    const g = (await db.query('SELECT * FROM ingredients WHERE id = $1', [req.params.id])).rows[0];
    if (!g) return reply.code(404).send({ error: 'Ingredient not found.' });
    const users = (await db.query(`SELECT name FROM products WHERE content->'ingredients' ? $1`, [g.id])).rows;
    if (users.length) throw fail(`Used in ${users.map((u) => u.name).join(', ')}. Remove it from those products first, or hide it instead.`, 409);
    await db.query('DELETE FROM ingredients WHERE id = $1', [g.id]);
    if (g.photo_key) await media.remove(g.photo_key);
    await audit(db.query, req, 'ingredient.delete', 'ingredient', g.id, { name: g.name }, null);
    return { ok: true };
  });

  // ======================================================================
  // Compliance centre: licences, certificates, registrations, lab reports
  // ======================================================================
  const certOut = (c) => {
    const daysLeft = c.days_left == null ? null : Number(c.days_left);
    return {
      id: c.id, name: c.name, kind: c.kind, issuer: c.issuer || '', number: c.number || '', products: c.products || [],
      issuedOn: c.issued_on, expiresOn: c.expires_on, daysLeft, status: certStatus(daysLeft), showOnSite: c.show_on_site, notes: c.notes || '',
      document: c.document_key ? { name: c.document_name, type: c.document_type } : null, updatedAt: c.updated_at,
    };
  };
  const SELECT = `SELECT *, (expires_on - (now() AT TIME ZONE 'Asia/Kolkata')::date) AS days_left FROM certificates`;

  app.get('/api/admin/certificates', G('view'), async () => ({
    certificates: (await db.query(`${SELECT} ORDER BY expires_on NULLS LAST, name`)).rows.map(certOut),
    kinds: CERT_KINDS,
  }));

  const certBody = z.object({
    name: str(120).min(2, 'Enter the name, e.g. "AYUSH manufacturing licence".'), kind: z.enum(Object.keys(CERT_KINDS)),
    issuer: str(160), number: str(80), products: z.array(z.string().max(80)).max(30),
    issuedOn: z.string().date().nullable(), expiresOn: z.string().date().nullable(), showOnSite: z.boolean(), notes: str(1000),
  }).partial();
  const checkDates = (b, cur = {}) => {
    const issued = b.issuedOn === undefined ? cur.issued_on : b.issuedOn, expires = b.expiresOn === undefined ? cur.expires_on : b.expiresOn;
    const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
    if (issued && expires && iso(expires) <= iso(issued)) throw fail('The expiry date must be after the issue date.');
  };

  app.post('/api/admin/certificates', G('products.edit'), async (req, reply) => {
    const body = parse(certBody.required({ name: true, kind: true }), req.body, reply); if (!body) return;
    checkDates(body);
    const r = (await db.query(
      `INSERT INTO certificates (name, kind, issuer, number, products, issued_on, expires_on, show_on_site, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [body.name, body.kind, body.issuer || null, body.number || null, body.products || [], body.issuedOn || null, body.expiresOn || null, !!body.showOnSite, body.notes || null])).rows[0];
    await audit(db.query, req, 'certificate.create', 'certificate', r.id, null, { name: body.name, expires: body.expiresOn || null });
    return { ok: true, id: r.id };
  });

  app.patch('/api/admin/certificates/:id', G('products.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(certBody, req.body, reply); if (!body) return;
    const c = (await db.query('SELECT * FROM certificates WHERE id = $1', [id])).rows[0];
    if (!c) return reply.code(404).send({ error: 'Certificate not found.' });
    checkDates(body, c);
    // update only the fields that were sent (re-sending unchanged dates could shift them a day across time zones)
    const COLS = { name: 'name', kind: 'kind', issuer: 'issuer', number: 'number', products: 'products', issuedOn: 'issued_on', expiresOn: 'expires_on', showOnSite: 'show_on_site', notes: 'notes' };
    const sets = [], params = [id];
    for (const [k, col] of Object.entries(COLS)) {
      if (body[k] === undefined) continue;
      params.push(body[k] === '' ? null : body[k]);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length) await db.query(`UPDATE certificates SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
    await audit(db.query, req, 'certificate.update', 'certificate', id, { name: c.name, expires: c.expires_on }, { ...body });
    return { ok: true };
  });

  app.delete('/api/admin/certificates/:id', G('settings'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const c = (await db.query('SELECT * FROM certificates WHERE id = $1', [id])).rows[0];
    if (!c) return reply.code(404).send({ error: 'Certificate not found.' });
    await db.query('DELETE FROM certificates WHERE id = $1', [id]);
    await media.removeDocument(c.document_key);
    await audit(db.query, req, 'certificate.delete', 'certificate', id, { name: c.name, number: c.number }, null);
    return { ok: true };
  });

  // document upload (PDF / JPG / PNG, checked by its first bytes) into the private bucket
  app.post('/api/admin/certificates/:id/document', { ...G('products.edit'), bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 }, async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Upload a PDF, JPG or PNG file.' });
    const c = (await db.query('SELECT * FROM certificates WHERE id = $1', [id])).rows[0];
    if (!c) return reply.code(404).send({ error: 'Certificate not found.' });
    const type = req.headers['content-type'].split(';')[0];
    const key = await media.putDocument(req.body, type);
    const name = String(req.headers['x-file-name'] || 'document').replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'document';
    await db.query('UPDATE certificates SET document_key = $2, document_name = $3, document_type = $4, updated_at = now() WHERE id = $1', [id, key, name, type]);
    if (c.document_key) await media.removeDocument(c.document_key);
    await audit(db.query, req, 'certificate.document', 'certificate', id, c.document_key ? { document: c.document_name } : null, { document: name });
    return { ok: true };
  });

  // staff-only download, streamed through the server (the bucket is private)
  app.get('/api/admin/certificates/:id/document', G('view'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const c = (await db.query('SELECT document_key, document_name FROM certificates WHERE id = $1', [id])).rows[0];
    if (!c?.document_key) return reply.code(404).send({ error: 'No document uploaded.' });
    const doc = await media.getDocument(c.document_key);
    reply.header('Content-Type', doc.contentType);
    reply.header('Content-Disposition', `inline; filename="${c.document_name.replace(/"/g, '')}"`);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    return reply.send(doc.body);
  });
}
