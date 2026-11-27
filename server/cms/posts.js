// Shared post queries for the public blog API, the sitemap and the staff CMS.

/**
 * A post is public when it is published, or scheduled and its time has come (the 5-minute sweep then marks
 * it published; until then this keeps the switch exact to the minute). Drafts and archived posts never are.
 */
export const PUBLIC = `p.status IN ('published', 'scheduled') AND p.published_at IS NOT NULL AND p.published_at <= now()`;
/** Search engines may index it (robots "noindex" in the SEO settings turns this off). */
export const INDEXABLE = `COALESCE((p.seo->'robots'->>'index')::boolean, true)`;

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const BLOG_PATH = '/blogs';
export const postPath = (slug) => `${BLOG_PATH}/${slug}`;

export const SUMMARY_COLUMNS = `
  p.id, p.slug, p.title, p.excerpt, p.featured_image, p.featured_image_alt, p.concern, p.reading_minutes, p.featured,
  p.status, p.published_at, p.content_updated_at, p.updated_at, p.created_at,
  c.slug AS category_slug, c.name AS category_name`;
export const SUMMARY_FROM = `cms_posts p LEFT JOIN cms_categories c ON c.id = p.category_id`;

export const summaryOut = (r) => ({
  slug: r.slug, title: r.title, excerpt: r.excerpt, image: r.featured_image || null, imageAlt: r.featured_image_alt || '',
  category: r.category_slug ? { slug: r.category_slug, name: r.category_name } : null,
  concern: r.concern || null, readingMinutes: r.reading_minutes, featured: r.featured,
  publishedAt: r.published_at, updatedAt: r.content_updated_at,
});

/** The SEO settings as stored, with defaults filled in. */
export function seoOf(raw = {}) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    title: s.title || '', description: s.description || '', focusKeyword: s.focusKeyword || '',
    keywords: Array.isArray(s.keywords) ? s.keywords : [], canonical: s.canonical || '',
    robots: { index: s.robots?.index !== false, follow: s.robots?.follow !== false },
    og: { title: s.og?.title || '', description: s.og?.description || '', image: s.og?.image || '' },
    twitter: { title: s.twitter?.title || '', description: s.twitter?.description || '', image: s.twitter?.image || '' },
  };
}
