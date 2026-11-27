// Blog CMS (staff). Every route needs a content.* permission (owner, content manager); see auth.js.
//
// Articles
//   GET    /api/admin/cms/posts?status=&category=&q=&page=   all posts incl. drafts, with counts per status
//   POST   /api/admin/cms/posts                              { title? }  -> a new draft
//   GET    /api/admin/cms/posts/:id                          everything the editor needs (+ choices for the selects)
//   PATCH  /api/admin/cms/posts/:id                          save; { ...fields, baseUpdatedAt, autosave? }
//                                                            409 when it changed elsewhere since baseUpdatedAt
//   POST   /api/admin/cms/posts/:id/publish | unpublish | archive | restore | duplicate
//   DELETE /api/admin/cms/posts/:id                          not while it is published
//   POST   /api/admin/cms/posts/bulk                         { ids, action, categoryId? }
//   GET    /api/admin/cms/posts/:id/preview                  the article as the site would show it (any status)
// Categories, tags and bylines
//   GET/POST /api/admin/cms/categories, PATCH/DELETE /api/admin/cms/categories/:id   (same for tags and authors)
//
// Every save keeps a revision (autosaves at most one per 10 minutes), so earlier versions can be restored.
// Changing the address of a live article adds a redirect from the old address (and repoints older redirects,
// so there are never chains).
import { z } from 'zod';
import { can } from '../admin/auth.js';
import { cleanDoc, readingMinutes, renderDoc, safeUrl, slugify } from './render.js';
import { PUBLIC, SLUG, SUMMARY_COLUMNS, SUMMARY_FROM, postPath, seoOf, summaryOut } from './posts.js';

const STATUSES = ['draft', 'scheduled', 'published', 'archived'];
const PAGE = 25;
const AUTOSAVE_REVISION_MINUTES = 10;
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
const fail = (message, status = 400, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
const uuid = z.string().uuid();
const opt = (s) => s.nullable().optional();

const seoSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(320).optional(),
  focusKeyword: z.string().trim().max(80).optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
  canonical: z.string().trim().max(500).optional(),
  robots: z.object({ index: z.boolean(), follow: z.boolean() }).optional(),
  og: z.object({ title: z.string().trim().max(120).optional(), description: z.string().trim().max(320).optional(), image: z.string().trim().max(2000).optional() }).optional(),
  twitter: z.object({ title: z.string().trim().max(120).optional(), description: z.string().trim().max(320).optional(), image: z.string().trim().max(2000).optional() }).optional(),
}).strict();

const saveSchema = z.object({
  baseUpdatedAt: z.string().datetime({ offset: true }),
  autosave: z.boolean().optional().default(false),
  title: z.string().max(200).optional(),
  slug: z.string().trim().toLowerCase().max(120).regex(SLUG, 'Use lower-case letters, numbers and hyphens in the URL (like healthy-breakfast-ideas).').optional(),
  excerpt: z.string().max(600).optional(),
  content: z.object({ type: z.literal('doc'), content: z.array(z.any()).optional() }).passthrough().optional(),
  featuredImage: opt(z.string().trim().max(2000)),
  featuredImageAlt: z.string().trim().max(300).optional(),
  categoryId: opt(uuid),
  authorId: opt(uuid),
  concern: opt(z.string().regex(SLUG).max(80)),
  disclaimer: opt(z.string().trim().max(1000)),
  featured: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  seo: seoSchema.optional(),
}).strict();

export default async function cmsAdminRoutes(app, { db, G, parse, audit, env = {} }) {
  const q = db.query;
  const siteOrigin = (() => { try { return new URL(env.SITE_URL).origin; } catch { return ''; } })();
  const render = (content) => renderDoc(content, { siteOrigin });

  // ---------------------------------------------------------------- helpers
  async function uniqueSlug(t, base, excludeId = null) {
    const root = (slugify(base, 100) || 'article').replace(/-+$/, '');
    for (let i = 1; i < 500; i++) {
      const s = i === 1 ? root : `${root}-${i}`;
      const taken = (await t.query('SELECT 1 FROM cms_posts WHERE slug = $1 AND id IS DISTINCT FROM $2', [s, excludeId])).rows.length;
      if (!taken) return s;
    }
    throw fail('Could not find a free URL for this article.');
  }

  /** Tag names -> tag ids (creating new tags as needed). */
  async function tagIds(t, names) {
    const ids = [];
    const seen = new Set();
    for (const name of names.map((n) => n.trim())) {
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const slug = slugify(name, 60);
      if (!slug) continue;
      const r = (await t.query(`INSERT INTO cms_tags (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`, [slug, name])).rows[0];
      ids.push(r.id);
    }
    return ids;
  }

  const loadPost = async (t, id) => (await t.query('SELECT * FROM cms_posts WHERE id = $1', [id])).rows[0];
  const tagsOf = async (t, id) => (await t.query(`SELECT t.name FROM cms_post_tags pt JOIN cms_tags t ON t.id = pt.tag_id WHERE pt.post_id = $1 ORDER BY t.name`, [id])).rows.map((r) => r.name);

  const snapshot = (p, tags) => ({
    title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, featuredImage: p.featured_image, featuredImageAlt: p.featured_image_alt,
    categoryId: p.category_id, authorId: p.author_id, concern: p.concern, disclaimer: p.disclaimer, featured: p.featured, tags, seo: p.seo,
  });
  async function revision(t, req, p, reason) {
    await t.query(`INSERT INTO cms_revisions (post_id, snapshot, reason, staff_id, staff_email) VALUES ($1, $2::jsonb, $3, $4, $5)`,
      [p.id, JSON.stringify(snapshot(p, await tagsOf(t, p.id))), reason, req.staff.id, req.staff.email]);
  }

  /** A live address that moves: redirect old -> new, repoint redirects that led to the old one, free the new one. */
  async function moveAddress(t, req, post, fromSlug, toSlug) {
    const from = postPath(fromSlug), to = postPath(toSlug);
    await t.query('DELETE FROM cms_redirects WHERE from_path = $1', [to]);
    await t.query('UPDATE cms_redirects SET to_path = $2 WHERE to_path = $1', [from, to]);
    await t.query(`INSERT INTO cms_redirects (from_path, to_path, post_id, created_by) VALUES ($1, $2, $3, $4)
      ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, post_id = EXCLUDED.post_id`, [from, to, post.id, req.staff.email]);
    await audit(t.query, req, 'cms.redirect_auto', 'cms', post.id, { path: from }, { path: to });
  }
  const wasLive = (p) => !!p.published_at && new Date(p.published_at) <= new Date() && ['published', 'scheduled', 'archived'].includes(p.status);

  function editorOut(p, tags) {
    const r = render(p.content);
    return {
      id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content,
      featuredImage: p.featured_image || '', featuredImageAlt: p.featured_image_alt || '',
      categoryId: p.category_id, authorId: p.author_id, concern: p.concern, disclaimer: p.disclaimer || '', featured: p.featured,
      status: p.status, publishedAt: p.published_at, createdAt: p.created_at, updatedAt: p.updated_at, contentUpdatedAt: p.content_updated_at,
      readingMinutes: p.reading_minutes, words: r.words, tags, seo: seoOf(p.seo), url: postPath(p.slug),
      live: p.status === 'published' || (p.status === 'scheduled' && p.published_at && new Date(p.published_at) <= new Date()),
    };
  }

  async function choices() {
    const concernsRow = (await q(`SELECT data FROM site_docs WHERE key = 'concerns'`).catch(() => ({ rows: [] }))).rows[0];
    let concerns = Array.isArray(concernsRow?.data) ? concernsRow.data : null;
    if (!concerns) concerns = (await import('../../src/store/data/concerns.js')).CONCERNS;
    return {
      categories: (await q('SELECT id, name, slug FROM cms_categories ORDER BY sort, name')).rows,
      authors: (await q('SELECT id, name, title FROM cms_authors ORDER BY name')).rows,
      tags: (await q('SELECT name FROM cms_tags ORDER BY name')).rows.map((r) => r.name),
      concerns: concerns.map((c) => ({ id: c.id, title: c.title })),
    };
  }

  /** What must be true before a post can go live. */
  function publishProblems(p) {
    const problems = [];
    if (!String(p.title || '').trim()) problems.push('Add a title.');
    if (!render(p.content).words) problems.push('Write the article first: the body is empty.');
    if (!SLUG.test(p.slug)) problems.push('Fix the URL.');
    return problems;
  }

  // ---------------------------------------------------------------- list
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

  // ---------------------------------------------------------------- create / read / save
  app.post('/api/admin/cms/posts', G('content.edit'), async (req, reply) => {
    const b = parse(z.object({ title: z.string().trim().max(200).optional() }), req.body, reply); if (!b) return;
    const p = await db.tx(async (t) => {
      const title = b.title || '';
      const slug = await uniqueSlug(t, title || `draft-${Date.now().toString(36)}`);
      const row = (await t.query(`INSERT INTO cms_posts (slug, title, created_by, updated_by) VALUES ($1, $2, $3, $3) RETURNING *`,
        [slug, title, req.staff.id])).rows[0];
      await revision(t, req, row, 'create');
      await audit(t.query, req, 'cms.post_create', 'cms', row.id, null, { title, slug });
      return row;
    });
    return { post: editorOut(p, []) };
  });

  app.get('/api/admin/cms/posts/:id', G('content.view'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const p = await loadPost(db, id);
    if (!p) return reply.code(404).send({ error: 'Article not found.', code: 'not_found' });
    return { post: editorOut(p, await tagsOf(db, id)), choices: await choices() };
  });

  app.patch('/api/admin/cms/posts/:id', { ...G('content.edit'), bodyLimit: 3 * 1024 * 1024 }, async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const b = parse(saveSchema, req.body, reply); if (!b) return;
    if (b.featuredImage && !safeUrl(b.featuredImage, { image: true, siteOrigin })) throw fail('Use an image address starting with https:// or a path on this site (like /assets/...).');
    if (b.seo?.canonical && !/^https:\/\/[^\s]+$/.test(b.seo.canonical) && !/^\/[^\s]*$/.test(b.seo.canonical)) throw fail('The canonical URL must be a full https:// address or a path on this site.');
    for (const img of [b.seo?.og?.image, b.seo?.twitter?.image]) if (img && !safeUrl(img, { image: true, siteOrigin })) throw fail('Use an https:// image address for social sharing.');

    const out = await db.tx(async (t) => {
      const before = (await t.query('SELECT * FROM cms_posts WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!before) throw fail('Article not found.', 404);
      if (new Date(before.updated_at).getTime() !== new Date(b.baseUpdatedAt).getTime()) {
        throw fail('This article was changed in another tab or by someone else. Reload to see the latest version before saving.', 409, 'conflict');
      }
      const next = { ...before };
      const set = (col, v) => { if (v !== undefined) next[col] = v; };
      set('title', b.title);
      set('excerpt', b.excerpt);
      set('featured_image', b.featuredImage === undefined ? undefined : (b.featuredImage || null));
      set('featured_image_alt', b.featuredImageAlt);
      set('category_id', b.categoryId);
      set('author_id', b.authorId);
      set('concern', b.concern);
      set('disclaimer', b.disclaimer === undefined ? undefined : (b.disclaimer || null));
      set('featured', b.featured);
      if (b.seo) next.seo = { ...seoOf(before.seo), ...b.seo };
      if (b.content) next.content = cleanDoc(b.content);
      if (b.slug !== undefined && b.slug !== before.slug) {
        const taken = (await t.query('SELECT title FROM cms_posts WHERE slug = $1 AND id <> $2', [b.slug, id])).rows[0];
        if (taken) throw fail(`That URL is already used by “${taken.title || 'another article'}”. Choose another.`, 409, 'slug_taken');
        next.slug = b.slug;
      }
      if (b.categoryId && !(await t.query('SELECT 1 FROM cms_categories WHERE id = $1', [b.categoryId])).rows.length) throw fail('That category no longer exists.');
      if (b.authorId && !(await t.query('SELECT 1 FROM cms_authors WHERE id = $1', [b.authorId])).rows.length) throw fail('That byline no longer exists.');

      const r = render(next.content);
      const textChanged = next.title !== before.title || next.excerpt !== before.excerpt || JSON.stringify(next.content) !== JSON.stringify(before.content);
      const saved = (await t.query(`UPDATE cms_posts SET title = $2, slug = $3, excerpt = $4, content = $5::jsonb, content_html = $6, featured_image = $7,
          featured_image_alt = $8, category_id = $9, author_id = $10, concern = $11, disclaimer = $12, featured = $13, seo = $14::jsonb,
          reading_minutes = $15, updated_by = $16, updated_at = clock_timestamp(),
          content_updated_at = CASE WHEN $17 THEN clock_timestamp() ELSE content_updated_at END
        WHERE id = $1 RETURNING *`,
      [id, next.title, next.slug, next.excerpt, JSON.stringify(next.content), r.html, next.featured_image, next.featured_image_alt,
        next.category_id, next.author_id, next.concern, next.disclaimer, next.featured, JSON.stringify(next.seo || {}),
        readingMinutes(r.words), req.staff.id, textChanged])).rows[0];
      if (b.tags) {
        await t.query('DELETE FROM cms_post_tags WHERE post_id = $1', [id]);
        for (const tagId of await tagIds(t, b.tags)) await t.query('INSERT INTO cms_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tagId]);
      }
      if (next.slug !== before.slug && wasLive(before)) await moveAddress(t, req, saved, before.slug, next.slug);

      if (!b.autosave) {
        await revision(t, req, saved, 'save');
        await audit(t.query, req, 'cms.post_save', 'cms', id, { title: before.title, slug: before.slug }, { title: saved.title, slug: saved.slug });
      } else {
        const recent = (await t.query(`SELECT 1 FROM cms_revisions WHERE post_id = $1 AND created_at > now() - make_interval(mins => $2)`, [id, AUTOSAVE_REVISION_MINUTES])).rows.length;
        if (!recent) await revision(t, req, saved, 'autosave');
      }
      return saved;
    });
    return { post: editorOut(out, await tagsOf(db, id)) };
  });

  // ---------------------------------------------------------------- status changes
  async function changeStatus(t, req, id, action) {
    const p = (await t.query('SELECT * FROM cms_posts WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!p) throw fail('Article not found.', 404);
    let sql;
    if (action === 'publish') {
      const problems = publishProblems(p);
      if (problems.length) throw fail(`Not published yet: ${problems.join(' ')}`, 400, 'not_ready');
      // republishing keeps the original date; a first (or brought-forward scheduled) publish is now
      sql = `status = 'published', published_at = CASE WHEN status <> 'scheduled' AND published_at IS NOT NULL AND published_at <= now() THEN published_at ELSE now() END`;
    } else if (action === 'unpublish') {
      if (!['published', 'scheduled'].includes(p.status)) throw fail('This article is not published.', 409);
      sql = `status = 'draft'`;
    } else if (action === 'archive') {
      if (p.status === 'archived') throw fail('This article is already archived.', 409);
      sql = `status = 'archived'`;
    } else if (action === 'restore') {
      if (p.status !== 'archived') throw fail('Only archived articles can be restored.', 409);
      sql = `status = 'draft'`;
    }
    const saved = (await t.query(`UPDATE cms_posts SET ${sql}, updated_by = $2, updated_at = clock_timestamp() WHERE id = $1 RETURNING *`, [id, req.staff.id])).rows[0];
    await revision(t, req, saved, action === 'restore' ? 'restore' : action);
    await audit(t.query, req, `cms.post_${action}`, 'cms', id, { status: p.status, title: p.title }, { status: saved.status });
    return saved;
  }
  const PERM = { publish: 'content.publish', unpublish: 'content.publish', archive: 'content.edit', restore: 'content.edit' };
  for (const action of Object.keys(PERM)) {
    app.post(`/api/admin/cms/posts/:id/${action}`, G(PERM[action]), async (req, reply) => {
      const id = parse(uuid, req.params.id, reply); if (!id) return;
      const p = await db.tx((t) => changeStatus(t, req, id, action));
      return { post: editorOut(p, await tagsOf(db, id)) };
    });
  }

  app.post('/api/admin/cms/posts/:id/duplicate', G('content.edit'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const copy = await db.tx(async (t) => {
      const p = await loadPost(t, id);
      if (!p) throw fail('Article not found.', 404);
      const slug = await uniqueSlug(t, `${p.slug}-copy`);
      const title = p.title ? `Copy of ${p.title}`.slice(0, 200) : '';
      const row = (await t.query(`INSERT INTO cms_posts (slug, title, excerpt, content, content_html, featured_image, featured_image_alt, category_id,
          author_id, concern, disclaimer, reading_minutes, seo, created_by, updated_by)
        SELECT $2, $3, excerpt, content, content_html, featured_image, featured_image_alt, category_id, author_id, concern, disclaimer,
          reading_minutes, seo - 'canonical', $4, $4 FROM cms_posts WHERE id = $1 RETURNING *`, [id, slug, title, req.staff.id])).rows[0];
      await t.query('INSERT INTO cms_post_tags (post_id, tag_id) SELECT $2, tag_id FROM cms_post_tags WHERE post_id = $1', [id, row.id]);
      await revision(t, req, row, 'create');
      await audit(t.query, req, 'cms.post_duplicate', 'cms', row.id, { from: p.slug }, { slug });
      return row;
    });
    return { post: editorOut(copy, await tagsOf(db, copy.id)) };
  });

  async function deletePost(t, req, id) {
    const p = (await t.query('SELECT * FROM cms_posts WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!p) throw fail('Article not found.', 404);
    if (p.status === 'published' || p.status === 'scheduled') throw fail('Unpublish this article before deleting it.', 409, 'published');
    await t.query('DELETE FROM cms_redirects WHERE to_path = $1', [postPath(p.slug)]);
    await t.query('DELETE FROM cms_posts WHERE id = $1', [id]);
    await audit(t.query, req, 'cms.post_delete', 'cms', id, { title: p.title, slug: p.slug, status: p.status }, null);
    return p;
  }
  app.delete('/api/admin/cms/posts/:id', G('content.delete'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    await db.tx((t) => deletePost(t, req, id));
    return { ok: true };
  });

  app.post('/api/admin/cms/posts/bulk', G('content.edit'), async (req, reply) => {
    const b = parse(z.object({
      ids: z.array(uuid).min(1).max(100),
      action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'delete', 'category']),
      categoryId: opt(uuid),
    }), req.body, reply); if (!b) return;
    const need = { publish: 'content.publish', unpublish: 'content.publish', delete: 'content.delete' }[b.action];
    if (need && !can(req.staff, need)) {
      return reply.code(403).send({ error: 'Your role does not allow this.', code: 'forbidden' });
    }
    if (b.action === 'category' && b.categoryId && !(await q('SELECT 1 FROM cms_categories WHERE id = $1', [b.categoryId])).rows.length) throw fail('That category no longer exists.');
    let done = 0;
    const skipped = [];
    for (const id of [...new Set(b.ids)]) {
      try {
        await db.tx(async (t) => {
          if (b.action === 'delete') return deletePost(t, req, id);
          if (b.action === 'category') {
            const r = (await t.query(`UPDATE cms_posts SET category_id = $2, updated_by = $3, updated_at = clock_timestamp() WHERE id = $1 RETURNING id`, [id, b.categoryId ?? null, req.staff.id])).rows[0];
            if (!r) throw fail('Article not found.', 404);
            return audit(t.query, req, 'cms.post_category', 'cms', id, null, { categoryId: b.categoryId ?? null });
          }
          return changeStatus(t, req, id, b.action);
        });
        done++;
      } catch (e) {
        const title = (await q('SELECT title FROM cms_posts WHERE id = $1', [id])).rows[0]?.title;
        skipped.push({ id, title: title || '(untitled)', reason: e.status && e.status < 500 ? e.message : 'Something went wrong.' });
      }
    }
    return { done, skipped };
  });

  app.get('/api/admin/cms/posts/:id/preview', G('content.view'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const p = (await q(`SELECT ${SUMMARY_COLUMNS}, p.content, p.disclaimer, p.seo, p.category_id,
        a.slug AS author_slug, a.name AS author_name, a.title AS author_title
      FROM ${SUMMARY_FROM} LEFT JOIN cms_authors a ON a.id = p.author_id WHERE p.id = $1`, [id])).rows[0];
    if (!p) return reply.code(404).send({ error: 'Article not found.', code: 'not_found' });
    const related = (await q(`SELECT ${SUMMARY_COLUMNS} FROM ${SUMMARY_FROM} WHERE ${PUBLIC} AND p.id <> $1
      ORDER BY (p.concern IS NOT DISTINCT FROM $2 AND $2::text IS NOT NULL) DESC, p.published_at DESC LIMIT 3`, [p.id, p.concern])).rows;
    return {
      post: {
        ...summaryOut(p), publishedAt: p.published_at || new Date().toISOString(), html: render(p.content).html, disclaimer: p.disclaimer || null,
        seo: seoOf(p.seo), tags: [], status: p.status,
        author: p.author_name ? { slug: p.author_slug, name: p.author_name, title: p.author_title } : null,
      },
      related: related.map(summaryOut),
    };
  });

  // ---------------------------------------------------------------- categories, tags, bylines
  const name = (max) => z.string().trim().min(2, 'Enter a name.').max(max);
  const optSlug = z.string().trim().toLowerCase().max(80).regex(SLUG, 'Use lower-case letters, numbers and hyphens.').optional().or(z.literal('').transform(() => undefined));
  const dup = (e, what) => { if (e.code === '23505') throw fail(`A ${what} with that name or URL already exists.`, 409); throw e; };

  app.get('/api/admin/cms/categories', G('content.view'), async () => ({
    categories: (await q(`SELECT c.id, c.slug, c.name, c.description, c.sort, COUNT(p.id) AS posts,
        COUNT(p.id) FILTER (WHERE ${PUBLIC}) AS live
        FROM cms_categories c LEFT JOIN cms_posts p ON p.category_id = c.id GROUP BY c.id ORDER BY c.sort, c.name`)).rows
      .map((c) => ({ ...c, posts: Number(c.posts), live: Number(c.live) })),
  }));
  const categoryBody = z.object({ name: name(60), slug: optSlug, description: z.string().trim().max(300).optional().default(''), sort: z.number().int().min(0).max(10000).optional() });
  app.post('/api/admin/cms/categories', G('content.taxonomy'), async (req, reply) => {
    const b = parse(categoryBody, req.body, reply); if (!b) return;
    const sort = b.sort ?? Number((await q('SELECT COALESCE(MAX(sort), 0) + 10 AS s FROM cms_categories')).rows[0].s);
    const c = (await q(`INSERT INTO cms_categories (name, slug, description, sort) VALUES ($1, $2, $3, $4) RETURNING *`,
      [b.name, b.slug || slugify(b.name), b.description, sort]).catch((e) => dup(e, 'category'))).rows[0];
    await audit(q, req, 'cms.category_create', 'cms', c.id, null, { name: c.name });
    return { category: c };
  });
  app.patch('/api/admin/cms/categories/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const b = parse(categoryBody, req.body, reply); if (!b) return;
    const c = (await q(`UPDATE cms_categories SET name = $2, slug = COALESCE($3, slug), description = $4, sort = COALESCE($5, sort), updated_at = now()
      WHERE id = $1 RETURNING *`, [id, b.name, b.slug ?? null, b.description, b.sort ?? null]).catch((e) => dup(e, 'category'))).rows[0];
    if (!c) return reply.code(404).send({ error: 'Category not found.' });
    await audit(q, req, 'cms.category_update', 'cms', id, null, { name: c.name, slug: c.slug });
    return { category: c };
  });
  app.delete('/api/admin/cms/categories/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const c = (await q('DELETE FROM cms_categories WHERE id = $1 RETURNING name', [id])).rows[0];
    if (!c) return reply.code(404).send({ error: 'Category not found.' });
    await audit(q, req, 'cms.category_delete', 'cms', id, { name: c.name }, null);
    return { ok: true };
  });

  app.get('/api/admin/cms/tags', G('content.view'), async () => ({
    tags: (await q(`SELECT t.id, t.slug, t.name, COUNT(pt.post_id) AS posts FROM cms_tags t LEFT JOIN cms_post_tags pt ON pt.tag_id = t.id
      GROUP BY t.id ORDER BY t.name`)).rows.map((t) => ({ ...t, posts: Number(t.posts) })),
  }));
  const tagBody = z.object({ name: z.string().trim().min(1, 'Enter a name.').max(40), slug: optSlug });
  app.post('/api/admin/cms/tags', G('content.taxonomy'), async (req, reply) => {
    const b = parse(tagBody, req.body, reply); if (!b) return;
    const t = (await q('INSERT INTO cms_tags (name, slug) VALUES ($1, $2) RETURNING *', [b.name, b.slug || slugify(b.name, 60)]).catch((e) => dup(e, 'tag'))).rows[0];
    await audit(q, req, 'cms.tag_create', 'cms', t.id, null, { name: t.name });
    return { tag: t };
  });
  app.patch('/api/admin/cms/tags/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const b = parse(tagBody, req.body, reply); if (!b) return;
    const t = (await q('UPDATE cms_tags SET name = $2, slug = COALESCE($3, slug) WHERE id = $1 RETURNING *', [id, b.name, b.slug ?? null]).catch((e) => dup(e, 'tag'))).rows[0];
    if (!t) return reply.code(404).send({ error: 'Tag not found.' });
    await audit(q, req, 'cms.tag_update', 'cms', id, null, { name: t.name });
    return { tag: t };
  });
  app.delete('/api/admin/cms/tags/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const t = (await q('DELETE FROM cms_tags WHERE id = $1 RETURNING name', [id])).rows[0];
    if (!t) return reply.code(404).send({ error: 'Tag not found.' });
    await audit(q, req, 'cms.tag_delete', 'cms', id, { name: t.name }, null);
    return { ok: true };
  });

  app.get('/api/admin/cms/authors', G('content.view'), async () => ({
    authors: (await q(`SELECT a.*, COUNT(p.id) AS posts FROM cms_authors a LEFT JOIN cms_posts p ON p.author_id = a.id GROUP BY a.id ORDER BY a.name`)).rows
      .map((a) => ({ id: a.id, slug: a.slug, name: a.name, title: a.title, bio: a.bio, avatarUrl: a.avatar_url || '', posts: Number(a.posts) })),
  }));
  const authorBody = z.object({ name: name(80), title: z.string().trim().max(80).optional().default(''), bio: z.string().trim().max(600).optional().default(''),
    avatarUrl: z.string().trim().max(2000).optional().default(''), slug: optSlug });
  const checkAvatar = (u) => { if (u && !safeUrl(u, { image: true, siteOrigin })) throw fail('Use a photo address starting with https:// or a path on this site.'); };
  app.post('/api/admin/cms/authors', G('content.taxonomy'), async (req, reply) => {
    const b = parse(authorBody, req.body, reply); if (!b) return;
    checkAvatar(b.avatarUrl);
    const a = (await q('INSERT INTO cms_authors (name, title, bio, avatar_url, slug) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [b.name, b.title, b.bio, b.avatarUrl || null, b.slug || slugify(b.name)]).catch((e) => dup(e, 'byline'))).rows[0];
    await audit(q, req, 'cms.author_create', 'cms', a.id, null, { name: a.name });
    return { author: a };
  });
  app.patch('/api/admin/cms/authors/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const b = parse(authorBody, req.body, reply); if (!b) return;
    checkAvatar(b.avatarUrl);
    const a = (await q(`UPDATE cms_authors SET name = $2, title = $3, bio = $4, avatar_url = $5, slug = COALESCE($6, slug), updated_at = now() WHERE id = $1 RETURNING *`,
      [id, b.name, b.title, b.bio, b.avatarUrl || null, b.slug ?? null]).catch((e) => dup(e, 'byline'))).rows[0];
    if (!a) return reply.code(404).send({ error: 'Byline not found.' });
    await audit(q, req, 'cms.author_update', 'cms', id, null, { name: a.name });
    return { author: a };
  });
  app.delete('/api/admin/cms/authors/:id', G('content.taxonomy'), async (req, reply) => {
    const id = parse(uuid, req.params.id, reply); if (!id) return;
    const a = (await q('DELETE FROM cms_authors WHERE id = $1 RETURNING name', [id])).rows[0];
    if (!a) return reply.code(404).send({ error: 'Byline not found.' });
    await audit(q, req, 'cms.author_delete', 'cms', id, { name: a.name }, null);
    return { ok: true };
  });
}
