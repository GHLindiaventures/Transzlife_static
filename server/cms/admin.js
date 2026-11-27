// Blog CMS (staff). Every route needs a content.* permission (owner, content manager).
//   GET /api/admin/cms/posts?status=&category=&q=&page=   all posts incl. drafts, with counts per status
//   GET /api/admin/cms/categories                          every category with its post count
import { z } from 'zod';
import { SLUG, SUMMARY_COLUMNS, SUMMARY_FROM, summaryOut } from './posts.js';

const STATUSES = ['draft', 'scheduled', 'published', 'archived'];
const PAGE = 25;
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;

export default async function cmsAdminRoutes(app, { db, G, parse }) {
  const q = db.query;

  app.get('/api/admin/cms/posts', G('content.view'), async (req, reply) => {
    const f = parse(z.object({
      status: z.enum(STATUSES).optional(),
      category: z.string().regex(SLUG).max(80).optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).max(1000).optional().default(1),
    }), req.query, reply); if (!f) return;
    const where = ['TRUE'];
    const params = [];
    if (f.status) { params.push(f.status); where.push(`p.status = $${params.length}`); }
    if (f.category) { params.push(f.category); where.push(`c.slug = $${params.length}`); }
    if (f.q) { params.push(like(f.q)); where.push(`(p.title ILIKE $${params.length} OR p.slug ILIKE $${params.length})`); }
    const total = Number((await q(`SELECT COUNT(*) AS n FROM ${SUMMARY_FROM} WHERE ${where.join(' AND ')}`, params)).rows[0].n);
    params.push(PAGE, (f.page - 1) * PAGE);
    const rows = (await q(`SELECT ${SUMMARY_COLUMNS} FROM ${SUMMARY_FROM} WHERE ${where.join(' AND ')}
      ORDER BY p.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of (await q('SELECT status, COUNT(*) AS n FROM cms_posts GROUP BY status')).rows) counts[r.status] = Number(r.n);
    return {
      posts: rows.map((r) => ({ ...summaryOut(r), id: r.id, status: r.status, editedAt: r.updated_at, createdAt: r.created_at })),
      counts, total, page: f.page, pages: Math.max(1, Math.ceil(total / PAGE)),
    };
  });

  app.get('/api/admin/cms/categories', G('content.view'), async () => ({
    categories: (await q(`SELECT c.id, c.slug, c.name, c.description, c.sort, COUNT(p.id) AS posts
        FROM cms_categories c LEFT JOIN cms_posts p ON p.category_id = c.id GROUP BY c.id ORDER BY c.sort, c.name`)).rows
      .map((c) => ({ ...c, posts: Number(c.posts) })),
  }));
}
