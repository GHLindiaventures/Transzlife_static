// Scheduled blog posts. A scheduled article is public from its publish time (the public queries compare the time
// directly, so it goes live on the minute); this job then marks it "published", keeps a version and logs it.
// Runs with the shop's 5-minute background jobs (server/shop/app.js), and is safe to run on several servers at once.

/** Marks every scheduled article whose time has come as published. Returns the articles it changed. */
export async function publishDuePosts(db, { log = console } = {}) {
  return db.tx(async (t) => {
    const due = (await t.query(`UPDATE cms_posts SET status = 'published', updated_at = clock_timestamp()
      WHERE status = 'scheduled' AND published_at <= now() RETURNING *`)).rows;
    for (const p of due) {
      const tags = (await t.query(`SELECT t.name FROM cms_post_tags pt JOIN cms_tags t ON t.id = pt.tag_id WHERE pt.post_id = $1 ORDER BY t.name`, [p.id])).rows.map((r) => r.name);
      await t.query(`INSERT INTO cms_revisions (post_id, snapshot, reason, staff_email) VALUES ($1, $2::jsonb, 'publish', 'scheduler')`, [p.id, JSON.stringify({
        title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, featuredImage: p.featured_image, featuredImageAlt: p.featured_image_alt,
        categoryId: p.category_id, authorId: p.author_id, concern: p.concern, disclaimer: p.disclaimer, featured: p.featured, tags, seo: p.seo,
      })]);
      await t.query(`INSERT INTO audit_log (staff_email, action, entity, entity_id, before, after) VALUES ('scheduler', 'cms.post_publish_scheduled', 'cms', $1, $2, $3)`,
        [p.id, JSON.stringify({ status: 'scheduled' }), JSON.stringify({ status: 'published', title: p.title, publishedAt: p.published_at })]);
    }
    if (due.length) log.info?.(`[cms] published ${due.length} scheduled article(s): ${due.map((p) => p.slug).join(', ')}`);
    return due;
  });
}
