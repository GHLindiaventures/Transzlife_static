// Public blog API: only published posts, never drafts, scheduled-but-not-yet-live or archived ones.
//   GET /api/blog/posts?category=&tag=&concern=&q=&page=&limit=   newest first; featured first on page 1 if asked
//   GET /api/blog/posts/:slug                                       one post (rendered HTML) + related posts,
//                                                                   or { redirect } when the address moved
//   GET /api/blog/categories                                        categories that have public posts
// The article HTML is produced by server/cms/render.js from the editor document (safe by construction).
import { z } from 'zod';
import { importLegacyArticles } from './legacy.js';
import { PUBLIC, SLUG, SUMMARY_COLUMNS, SUMMARY_FROM, postPath, seoOf, summaryOut } from './posts.js';

const listQuery = z.object({
  category: z.string().regex(SLUG).max(80).optional(),
  tag: z.string().regex(SLUG).max(80).optional(),
  concern: z.string().regex(SLUG).max(80).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(60),
});
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
const CACHE = 'public, max-age=60';

export default async function blogPublicRoutes(app, { db, log }) {
  const q = db.query;
  await importLegacyArticles(db, { log: app.log || log });

  app.get('/api/blog/posts', async (req, reply) => {
    const r = listQuery.safeParse(req.query || {});
    if (!r.success) return reply.code(400).send({ error: 'Invalid filter.', code: 'invalid' });
    const f = r.data;
    const where = [PUBLIC];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (f.category) add('c.slug = ?', f.category);
    if (f.concern) add('p.concern = ?', f.concern);
    if (f.tag) add('EXISTS (SELECT 1 FROM cms_post_tags pt JOIN cms_tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ?)', f.tag);
    if (f.q) { params.push(like(f.q)); where.push(`(p.title ILIKE $${params.length} OR p.excerpt ILIKE $${params.length})`); }
    const total = Number((await q(`SELECT COUNT(*) AS n FROM ${SUMMARY_FROM} WHERE ${where.join(' AND ')}`, params)).rows[0].n);
    params.push(f.limit, (f.page - 1) * f.limit);
    const rows = (await q(`SELECT ${SUMMARY_COLUMNS} FROM ${SUMMARY_FROM} WHERE ${where.join(' AND ')}
      ORDER BY p.published_at DESC, p.title LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
    reply.header('Cache-Control', CACHE);
    return { posts: rows.map(summaryOut), total, page: f.page, pages: Math.max(1, Math.ceil(total / f.limit)) };
  });

  app.get('/api/blog/categories', async (req, reply) => {
    const rows = (await q(`SELECT c.slug, c.name, c.description, COUNT(p.id) AS posts
        FROM cms_categories c JOIN cms_posts p ON p.category_id = c.id AND ${PUBLIC}
       GROUP BY c.id ORDER BY c.sort, c.name`)).rows;
    reply.header('Cache-Control', CACHE);
    return { categories: rows.map((c) => ({ slug: c.slug, name: c.name, description: c.description, posts: Number(c.posts) })) };
  });

  app.get('/api/blog/posts/:slug', async (req, reply) => {
    const slug = String(req.params.slug || '');
    const p = SLUG.test(slug) && slug.length <= 120 ? (await q(`
      SELECT ${SUMMARY_COLUMNS}, p.content_html, p.disclaimer, p.seo, p.category_id,
             a.slug AS author_slug, a.name AS author_name, a.title AS author_title, a.bio AS author_bio, a.avatar_url AS author_avatar
        FROM ${SUMMARY_FROM} LEFT JOIN cms_authors a ON a.id = p.author_id
       WHERE p.slug = $1 AND ${PUBLIC}`, [slug])).rows[0] : null;
    if (!p) {
      // a moved article: tell the page where it lives now (the server also answers the HTML page with a 301)
      const moved = SLUG.test(slug) ? (await q(`UPDATE cms_redirects SET hits = hits + 1, last_hit_at = now()
        WHERE from_path = $1 RETURNING to_path`, [postPath(slug)])).rows[0] : null;
      if (moved) return { redirect: moved.to_path };
      return reply.code(404).send({ error: 'Article not found.', code: 'not_found' });
    }
    const tags = (await q(`SELECT t.slug, t.name FROM cms_post_tags pt JOIN cms_tags t ON t.id = pt.tag_id WHERE pt.post_id = $1 ORDER BY t.name`, [p.id])).rows;
    // keep reading: same concern first, then same category, then the newest
    const related = (await q(`SELECT ${SUMMARY_COLUMNS} FROM ${SUMMARY_FROM} WHERE ${PUBLIC} AND p.id <> $1
      ORDER BY (p.concern IS NOT DISTINCT FROM $2 AND $2::text IS NOT NULL) DESC, (p.category_id IS NOT DISTINCT FROM $3::uuid AND $3::uuid IS NOT NULL) DESC, p.published_at DESC
      LIMIT 3`, [p.id, p.concern, p.category_id])).rows;
    reply.header('Cache-Control', CACHE);
    return {
      post: {
        ...summaryOut(p), html: p.content_html, disclaimer: p.disclaimer || null, tags, seo: seoOf(p.seo),
        author: p.author_name ? { slug: p.author_slug, name: p.author_name, title: p.author_title, bio: p.author_bio, avatar: p.author_avatar } : null,
      },
      related: related.map(summaryOut),
    };
  });
}
