// Website text content (staff).
//   GET /api/admin/site-docs          list of documents (key, label, group, locked, updatedAt, updatedBy)
//   GET /api/admin/site-docs/:key     one document's JSON
//   PUT /api/admin/site-docs/:key     { data }  replaces it (same shape as before: an object or a list)
// Page copy needs 'content.site' (owner, manager, content manager). The documents in SHOP_DOCS also
// drive the shop (business phone / address, product links, the product menu), so changing them needs
// 'products.edit' (owner, manager); content managers can read them but not change them.
import { z } from 'zod';
import { DOCS } from '../../src/content/registry.js';
import { can } from './auth.js';

export const SHOP_DOCS = new Set(['store.SITE', 'site.STORE_ID', 'site.PRODUCTS']);
const kind = (v) => (Array.isArray(v) ? 'array' : typeof v);

export default async function siteDocAdminRoutes(app, { db, G, parse, audit }) {
  const q = db.query;
  const known = (key, reply) => (DOCS[key] ? true : (reply.code(404).send({ error: 'Unknown document.' }), false));

  app.get('/api/admin/site-docs', G(['view', 'content.site']), async (req) => {
    const rows = (await q('SELECT key, updated_by, updated_at FROM site_docs')).rows;
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    return { docs: Object.entries(DOCS).map(([key, d]) => ({
      key, label: d.label, group: d.group, locked: SHOP_DOCS.has(key) && !can(req.staff, 'products.edit'),
      updatedAt: by[key]?.updated_at || null, updatedBy: by[key]?.updated_by || null,
    })) };
  });

  app.get('/api/admin/site-docs/:key', G(['view', 'content.site']), async (req, reply) => {
    if (!known(req.params.key, reply)) return;
    const row = (await q('SELECT data FROM site_docs WHERE key = $1', [req.params.key])).rows[0];
    return { key: req.params.key, label: DOCS[req.params.key].label, data: row ? row.data : null };
  });

  app.put('/api/admin/site-docs/:key', { ...G('content.site'), bodyLimit: 4 * 1024 * 1024 }, async (req, reply) => {
    if (!known(req.params.key, reply)) return;
    if (SHOP_DOCS.has(req.params.key) && !can(req.staff, 'products.edit')) {
      return reply.code(403).send({ error: 'This document also controls the shop. Ask the owner or a manager to change it.', code: 'forbidden' });
    }
    const b = parse(z.object({ data: z.any() }), req.body, reply); if (!b) return;
    const base = DOCS[req.params.key].target;
    if (b.data === null || typeof b.data !== 'object' || kind(b.data) !== kind(base)) {
      return reply.code(400).send({ error: `This document must be ${kind(base) === 'array' ? 'a list' : 'an object'}, as before.` });
    }
    const before = (await q('SELECT data FROM site_docs WHERE key = $1', [req.params.key])).rows[0];
    await q(`INSERT INTO site_docs (key, data, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())
             ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [req.params.key, JSON.stringify(b.data), req.staff.email]);
    await audit(q, req, 'content.site_doc', 'site_doc', req.params.key, before ? { bytes: JSON.stringify(before.data).length } : null, { bytes: JSON.stringify(b.data).length });
    return { ok: true };
  });
}
