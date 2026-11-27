// One-time import of the blog articles that used to live in code (src/store/data/articles.js and
// blogArticles.js, later copied into the site_docs "articles" document) into the CMS tables.
//
// Source, in order: the site_docs "articles" row (so edits made in Site text are kept), else the code copy.
// Slugs, titles, excerpts, dates, cover photos, in-article photos, tables, callouts, FAQs, product links and
// disclaimers are all carried over; nothing is invented (no authors, no ratings). Runs once: a settings flag
// records it, and it never runs over posts that already exist.
import { renderDoc, slugify } from './render.js';

const IMPORT_FLAG = 'cms_legacy_import';

/** '**bold** and *italic*' -> text nodes with marks */
export function inlineNodes(text) {
  return String(text ?? '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((s) => (
    s.startsWith('**') && s.endsWith('**') && s.length > 4 ? { type: 'text', text: s.slice(2, -2), marks: [{ type: 'bold' }] }
      : s.startsWith('*') && s.endsWith('*') && s.length > 2 ? { type: 'text', text: s.slice(1, -1), marks: [{ type: 'italic' }] }
        : { type: 'text', text: s }
  ));
}
const para = (text) => ({ type: 'paragraph', content: inlineNodes(text) });
const item = (text) => ({ type: 'listItem', content: [para(text)] });

/** One block of the old format -> editor nodes. */
export function blockNodes(b) {
  if (typeof b === 'string') return [para(b)];
  if (!b || typeof b !== 'object') return [];
  if (b.ul) return [{ type: 'bulletList', content: b.ul.map(item) }];
  if (b.ol) return [{ type: 'orderedList', attrs: { start: 1 }, content: b.ol.map(item) }];
  if (b.callout) return [{ type: 'callout', content: [para(b.callout)] }];
  if (b.table) {
    const [head, ...rows] = b.table;
    const c = (type, text) => ({ type, content: [para(text)] });
    return [{ type: 'table', content: [
      { type: 'tableRow', content: head.map((h) => c('tableHeader', h)) },
      // the old page showed each row's first cell as a row heading
      ...rows.map((r) => ({ type: 'tableRow', content: r.map((v, i) => c(i === 0 ? 'tableHeader' : 'tableCell', v)) })),
    ] }];
  }
  if (b.faq) return [{ type: 'faq', content: b.faq.map(([q, a]) => ({ type: 'faqItem', attrs: { question: q }, content: [para(a)] })) }];
  return [];
}

const figure = (f) => ({ type: 'image', attrs: { src: f.src, alt: f.alt || '', caption: f.caption || '' } });

/** A whole old-format article -> editor document. */
export function legacyToDoc(a) {
  const content = [];
  for (const b of a.intro || []) content.push(...blockNodes(b));
  (a.sections || []).forEach(([heading, body], k) => {
    content.push({ type: 'heading', attrs: { level: 2 }, content: inlineNodes(heading) });
    for (const b of Array.isArray(body) ? body : [body]) content.push(...blockNodes(b));
    for (const f of (a.figures || []).filter((x) => x.after === k)) content.push(figure(f));
  });
  if (a.cta?.to && a.cta?.label) content.push({ type: 'cta', attrs: { href: a.cta.to, label: a.cta.label }, content: [para(a.cta.text || '')] });
  return { type: 'doc', content };
}

/** "6 min read" -> 6 */
const minutesFrom = (s) => { const m = /(\d+)/.exec(String(s ?? '')); return m ? Math.max(1, Math.min(240, Number(m[1]))) : null; };

async function legacySource(q) {
  const row = (await q(`SELECT data FROM site_docs WHERE key = 'articles'`).catch(() => ({ rows: [] }))).rows[0];
  if (Array.isArray(row?.data) && row.data.length) return { articles: row.data, from: 'site_docs' };
  const { ARTICLES } = await import('../../src/store/data/articles.js');
  return { articles: ARTICLES, from: 'code' };
}

/** Imports the old articles once. Returns the number of posts created (0 if already done). */
export async function importLegacyArticles(db, { log = console } = {}) {
  const q = db.query;
  if ((await q('SELECT 1 FROM settings WHERE key = $1', [IMPORT_FLAG])).rows.length) return 0;
  const { articles, from } = await legacySource(q);
  let made = 0;
  await db.tx(async (t) => {
    // two servers starting at once: one waits for the other, then sees the flag
    if (db.kind === 'postgres') await t.query('SELECT pg_advisory_xact_lock(7249102)');
    if ((await t.query('SELECT 1 FROM settings WHERE key = $1', [IMPORT_FLAG])).rows.length) return;
    const existing = Number((await t.query('SELECT COUNT(*) AS n FROM cms_posts')).rows[0].n);
    if (!existing) {
      const cats = new Map();
      let sort = 10;
      for (const name of [...new Set(articles.map((a) => String(a.category || '').trim()).filter(Boolean))]) {
        const slug = slugify(name);
        const r = (await t.query(`INSERT INTO cms_categories (slug, name, sort) VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO UPDATE SET name = cms_categories.name RETURNING id`, [slug, name, sort])).rows[0];
        cats.set(name, r.id);
        sort += 10;
      }
      for (const a of articles) {
        const slug = String(a.id || '');
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !a.title) { log.warn?.(`[cms] skipped an article without a usable id/title: ${slug}`); continue; }
        const content = legacyToDoc(a);
        const r = renderDoc(content);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? `${a.date}T00:00:00+05:30` : new Date().toISOString();
        const post = (await t.query(`
          INSERT INTO cms_posts (slug, title, excerpt, content, content_html, featured_image, featured_image_alt, category_id, concern,
                                 disclaimer, reading_minutes, status, published_at, created_at, updated_at, content_updated_at)
          VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,'published',$12,$12,$12,$12)
          ON CONFLICT (slug) DO NOTHING RETURNING id`,
        [slug, String(a.title), String(a.excerpt || ''), JSON.stringify(content), r.html, a.image || null, String(a.imageAlt || ''),
          cats.get(String(a.category || '').trim()) || null, a.concern || null, a.disclaimer || null,
          minutesFrom(a.readTime) || Math.max(1, Math.round(r.words / 200)), date])).rows[0];
        if (!post) continue;
        await t.query(`INSERT INTO cms_revisions (post_id, snapshot, reason, staff_email) VALUES ($1, $2::jsonb, 'import', $3)`,
          [post.id, JSON.stringify({ title: a.title, excerpt: a.excerpt || '', content, source: from }), `import from ${from}`]);
        made++;
      }
    }
    await t.query('INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
      [IMPORT_FLAG, JSON.stringify({ at: new Date().toISOString(), from, posts: made, skippedBecauseExisting: existing })]);
  });
  if (made) log.info?.(`[cms] imported ${made} blog article(s) from ${from}`);
  return made;
}
