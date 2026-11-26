// Website text content (staff).
//   GET /api/admin/site-docs          list of documents (key, label, group, updatedAt, updatedBy)
//   GET /api/admin/site-docs/:key     one document's JSON
//   PUT /api/admin/site-docs/:key     { data }  replaces it (same shape as before: an object or a list)
import { z } from 'zod';
import { DOCS } from '../../src/content/registry.js';

const kind = (v) => (Array.isArray(v) ? 'array' : typeof v);

export default async function siteDocAdminRoutes(app, { db, G, parse, audit }) {
  const q = db.query;
  const known = (key, reply) => (DOCS[key] ? true : (reply.code(404).send({ error: 'Unknown document.' }), false));

  app.get('/api/admin/site-docs', G('view'), async () => {
    const rows = (await q('SELECT key, updated_by, updated_at FROM site_docs')).rows;
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    return { docs: Object.entries(DOCS).map(([key, d]) => ({ key, label: d.label, group: d.group, updatedAt: by[key]?.updated_at || null, updatedBy: by[key]?.updated_by || null })) };
  });

  app.get('/api/admin/site-docs/:key', G('view'), async (req, reply) => {
    if (!known(req.params.key, reply)) return;
    const row = (await q('SELECT data FROM site_docs WHERE key = $1', [req.params.key])).rows[0];
    return { key: req.params.key, label: DOCS[req.params.key].label, data: row ? row.data : null };
  });

  app.put('/api/admin/site-docs/:key', { ...G('products.edit'), bodyLimit: 4 * 1024 * 1024 }, async (req, reply) => {
    if (!known(req.params.key, reply)) return;
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
