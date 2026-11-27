// Website content (staff): announcement bar and homepage sections.
//   GET    /api/admin/content                    everything below + a preview of what the site shows now
//   POST   /api/admin/announcements              { text, linkUrl?, startsAt?, endsAt?, active }
//   PATCH  /api/admin/announcements/:id
//   DELETE /api/admin/announcements/:id
//   PUT    /api/admin/announcements/order        { ids }   display order
//   PUT    /api/admin/announcements/style        { bg, fg, speed }   readable colours only (contrast ≥ 4.5)
//   PUT    /api/admin/home                       { sections: [{ key, visible, title?, subtitle?, productIds? }] } in display order
import { z } from 'zod';
import { SECTION_KEYS, PRODUCT_SECTIONS, contrast, loadSiteContent } from '../shop/content.js';
import { loadSettings } from '../shop/pricing.js';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.');
const when = z.string().datetime({ offset: true }).nullable().optional();
const link = z.string().trim().max(300).refine((v) => !v || /^\/[^/\\]/.test(v) || v === '/' || /^https:\/\/[^\s]+$/.test(v), {
  message: 'Use a page on this site (like /shop) or a full https:// link.',
}).optional();
const message = z.object({
  text: z.string().trim().min(3, 'Write the message.').max(90, 'Keep it under 90 characters so it reads at a glance.'),
  linkUrl: link, startsAt: when, endsAt: when, active: z.boolean().optional().default(true),
}).refine((m) => !m.startsAt || !m.endsAt || m.endsAt > m.startsAt, { message: 'It must end after it starts.', path: ['endsAt'] });

const out = (a, now = Date.now()) => ({
  id: a.id, text: a.text, linkUrl: a.link_url || '', startsAt: a.starts_at, endsAt: a.ends_at, active: a.active, sort: a.sort,
  status: !a.active ? 'off' : a.ends_at && Date.parse(a.ends_at) <= now ? 'ended' : a.starts_at && Date.parse(a.starts_at) > now ? 'scheduled' : 'live',
  createdBy: a.created_by, updatedAt: a.updated_at,
});

export default async function contentAdminRoutes(app, { db, G, parse, audit }) {
  const q = db.query;

  app.get('/api/admin/content', G(['view', 'content.site']), async () => {
    const settings = await loadSettings(q);
    return {
      announcements: (await q('SELECT * FROM announcements ORDER BY sort, created_at')).rows.map((a) => out(a)),
      style: settings.announcement_style || { bg: '#124a2c', fg: '#efc04a', speed: 'normal' },
      sections: (await q('SELECT key, title, subtitle, product_ids, visible, sort FROM home_sections ORDER BY sort, key')).rows
        .map((s) => ({ key: s.key, title: s.title || '', subtitle: s.subtitle || '', productIds: s.product_ids, visible: s.visible })),
      products: (await q('SELECT id, name, short, active FROM products ORDER BY sort_order, name')).rows,
      live: await loadSiteContent(q),
      tokens: { free_shipping: settings.free_shipping_above, prepaid: settings.prepaid_discount_pct },
    };
  });

  app.post('/api/admin/announcements', G('content.site'), async (req, reply) => {
    const b = parse(message, req.body, reply); if (!b) return;
    const sort = Number((await q('SELECT COALESCE(MAX(sort), 0) + 10 AS s FROM announcements')).rows[0].s);
    const a = (await q(`INSERT INTO announcements (text, link_url, starts_at, ends_at, active, sort, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.text, b.linkUrl || null, b.startsAt ?? null, b.endsAt ?? null, b.active, sort, req.staff.email])).rows[0];
    await audit(q, req, 'content.announcement_create', 'content', a.id, null, { text: b.text });
    return { announcement: out(a) };
  });

  app.patch('/api/admin/announcements/:id', G('content.site'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const b = parse(message, req.body, reply); if (!b) return;
    const before = (await q('SELECT * FROM announcements WHERE id = $1', [id])).rows[0];
    if (!before) return reply.code(404).send({ error: 'Message not found.' });
    const a = (await q(`UPDATE announcements SET text = $2, link_url = $3, starts_at = $4, ends_at = $5, active = $6, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, b.text, b.linkUrl || null, b.startsAt ?? null, b.endsAt ?? null, b.active])).rows[0];
    await audit(q, req, 'content.announcement_update', 'content', id, { text: before.text, active: before.active }, { text: a.text, active: a.active });
    return { announcement: out(a) };
  });

  app.delete('/api/admin/announcements/:id', G('content.site'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const a = (await q('DELETE FROM announcements WHERE id = $1 RETURNING text', [id])).rows[0];
    if (!a) return reply.code(404).send({ error: 'Message not found.' });
    await audit(q, req, 'content.announcement_delete', 'content', id, { text: a.text }, null);
    return { ok: true };
  });

  app.put('/api/admin/announcements/order', G('content.site'), async (req, reply) => {
    const b = parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }), req.body, reply); if (!b) return;
    await db.tx(async (t) => { for (const [i, id] of b.ids.entries()) await t.query('UPDATE announcements SET sort = $2 WHERE id = $1', [id, (i + 1) * 10]); });
    return { ok: true };
  });

  app.put('/api/admin/announcements/style', G('content.site'), async (req, reply) => {
    const b = parse(z.object({ bg: hex, fg: hex, speed: z.enum(['slow', 'normal', 'fast']) }), req.body, reply); if (!b) return;
    const ratio = contrast(b.bg, b.fg);
    if (ratio < 4.5) return reply.code(400).send({ error: `These colours are hard to read (contrast ${ratio.toFixed(1)}:1, needs at least 4.5:1). Pick a darker background or a lighter text colour.` });
    const before = (await loadSettings(q)).announcement_style;
    await q(`INSERT INTO settings (key, value) VALUES ('announcement_style', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(b)]);
    await audit(q, req, 'content.announcement_style', 'content', null, before, b);
    return { ok: true, contrast: Number(ratio.toFixed(2)) };
  });

  app.put('/api/admin/home', G('content.site'), async (req, reply) => {
    const b = parse(z.object({
      sections: z.array(z.object({
        key: z.enum(SECTION_KEYS), visible: z.boolean(),
        title: z.string().trim().max(60).optional(), subtitle: z.string().trim().max(140).optional(),
        productIds: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(30).optional(),
      })).length(SECTION_KEYS.length, 'Send every section once.'),
    }), req.body, reply); if (!b) return;
    if (new Set(b.sections.map((s) => s.key)).size !== SECTION_KEYS.length) return reply.code(400).send({ error: 'Send every section once.' });
    const known = new Set((await q('SELECT id FROM products')).rows.map((r) => r.id));
    for (const s of b.sections) {
      if (s.productIds?.some((id) => !known.has(id))) return reply.code(400).send({ error: 'Unknown product in a section.' });
      if (PRODUCT_SECTIONS.includes(s.key) && s.title !== undefined && s.key === 'products' && !s.title) return reply.code(400).send({ error: 'The products section needs a heading.' });
    }
    const before = (await q('SELECT key, visible, sort, product_ids FROM home_sections ORDER BY sort')).rows;
    await db.tx(async (t) => {
      for (const [i, s] of b.sections.entries()) {
        await t.query(`UPDATE home_sections SET visible = $2, sort = $3, title = COALESCE($4, title), subtitle = COALESCE($5, subtitle),
                              product_ids = COALESCE($6, product_ids), updated_at = now() WHERE key = $1`,
        [s.key, s.visible, (i + 1) * 10, PRODUCT_SECTIONS.includes(s.key) ? s.title ?? null : null, PRODUCT_SECTIONS.includes(s.key) ? s.subtitle ?? null : null,
          PRODUCT_SECTIONS.includes(s.key) ? s.productIds ?? null : null]);
      }
      await audit(t.query, req, 'content.home', 'content', null, before, b.sections.map((s) => ({ key: s.key, visible: s.visible })));
    });
    return { ok: true };
  });
}
