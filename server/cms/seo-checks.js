// SEO checklist for an article. Plain JavaScript with no Node-only code: the editor runs it live while you
// write, and the server uses the same rules for reports. Each check says what it looked at, why it matters and
// how to fix it. The score is the share of points earned (pass = full points, needs work = half, missing = none).
//
// This is an optimisation aid. It cannot predict or guarantee rankings: search engines weigh many things it
// cannot see (how useful the article is, links from other sites, page speed, competition for the topic).
import { renderDoc, textOf } from './render.js';

export const BRAND_SUFFIX = ' | TranzLife Biosciences';
export const LIMITS = { title: [30, 60], description: [120, 160], slugChars: 60, slugWords: 6, minWords: 300, goodWords: 600 };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// small words a searcher's phrase may drop or reorder ("detox lungs after smoking" ~ "Detox Your Lungs ... After Smoking")
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'your', 'my', 'how', 'is', 'are', 'can', 'do', 'does', 'what', 'why']);
const stem = (w) => w.replace(/(ies|es|s)$/, '');   // lungs ~ lung, remedies ~ remedi
/** The keyword is there as the exact phrase, or every important word of it appears (any order, simple plurals). */
const has = (text, kw) => {
  if (!kw) return false;
  const t = ` ${norm(text)} `;
  if (t.includes(` ${kw} `)) return true;
  const words = new Set(t.trim().split(' ').map(stem));
  const need = kw.split(' ').filter((w) => !STOP.has(w)).map(stem);
  return need.length > 0 && need.every((w) => words.has(w));
};
const count = (text, kw) => { if (!kw) return 0; const t = ` ${norm(text)} `; let n = 0, i = 0; const k = ` ${kw} `; while ((i = t.indexOf(k, i)) !== -1) { n++; i += k.length - 1; } return n; };

/** Walks the editor document collecting links, images and the text before the first heading. */
function collect(doc) {
  const links = [], images = [];
  let intro = '', seenHeading = false;
  const walk = (n) => {
    if (!n) return;
    if (n.type === 'heading') seenHeading = true;
    if (n.type === 'image') images.push({ src: n.attrs?.src || '', alt: String(n.attrs?.alt || '').trim() });
    if (n.type === 'cta' && n.attrs?.href) links.push({ href: n.attrs.href, text: n.attrs.label || '' });
    if (n.type === 'text') for (const m of n.marks || []) if (m.type === 'link' && m.attrs?.href) links.push({ href: m.attrs.href, text: n.text });
    if (n.type === 'paragraph' && !seenHeading && intro.split(' ').length < 120) intro += ` ${textOf(n)}`;
    (n.content || []).forEach(walk);
  };
  (doc?.content || []).forEach(walk);
  return { links, images, intro: intro.trim() };
}

const pathOf = (href) => String(href).split(/[?#]/)[0].replace(/\/+$/, '') || '/';

/**
 * article: { title, slug, excerpt, content, featuredImage, featuredImageAlt, seo }
 * ctx: { siteOrigin?, knownPaths?: Set of paths on this site (to spot broken internal links),
 *        others?: [{ id, title, seoTitle, description, focusKeyword }] other articles (duplicates), selfId? }
 * Returns { score, earned, max, checks: [{ id, group, label, status: pass|warn|fail, points, max, message, fix }] }
 */
export function analyzeSeo(article, ctx = {}) {
  const seo = article.seo || {};
  const { html, text, words, headings } = renderDoc(article.content, { siteOrigin: ctx.siteOrigin || '' });
  const { links, images, intro } = collect(article.content);
  const kw = norm(seo.focusKeyword);
  const fullTitle = seo.title ? seo.title.trim() : `${String(article.title || '').trim()}${BRAND_SUFFIX}`;
  const description = String(seo.description || article.excerpt || '').trim();
  const checks = [];
  const add = (id, group, label, max, status, message, fix = '') => checks.push({ id, group, label, max, status, points: status === 'pass' ? max : status === 'warn' ? max / 2 : 0, message, fix });

  // ---- search result: title and description
  const tl = fullTitle.length;
  if (!String(article.title || '').trim() && !seo.title) add('title', 'Search result', 'SEO title', 10, 'fail', 'There is no title yet.', 'Write the article title, or an SEO title in the SEO panel.');
  else if (tl < LIMITS.title[0]) add('title', 'Search result', 'SEO title', 10, 'warn', `The title in search results is short (${tl} characters).`, `Aim for ${LIMITS.title[0]} to ${LIMITS.title[1]} characters: say what the reader gets.`);
  else if (tl > LIMITS.title[1]) add('title', 'Search result', 'SEO title', 10, tl > 70 ? 'fail' : 'warn', `The title in search results is ${tl} characters, so Google will probably cut it off.`, `Shorten it to ${LIMITS.title[1]} characters or fewer${seo.title ? '' : ', or write a shorter SEO title (the site adds “ | TranzLife Biosciences” to the article title)'}.`);
  else add('title', 'Search result', 'SEO title', 10, 'pass', `${tl} characters: a good length.`);

  const dl = description.length;
  if (!dl) add('description', 'Search result', 'Meta description', 10, 'fail', 'There is no meta description or summary.', 'Write a meta description (or a summary) that tells searchers what they will learn.');
  else if (dl < LIMITS.description[0]) add('description', 'Search result', 'Meta description', 10, 'warn', `The description is short (${dl} characters)${seo.description ? '' : ' and comes from the summary'}.`, `Aim for ${LIMITS.description[0]} to ${LIMITS.description[1]} characters.`);
  else if (dl > LIMITS.description[1]) add('description', 'Search result', 'Meta description', 10, 'warn', `The description is ${dl} characters, so Google will cut it off.`, `Keep it to ${LIMITS.description[1]} characters or fewer.`);
  else add('description', 'Search result', 'Meta description', 10, 'pass', `${dl} characters${seo.description ? '' : ' (from the summary)'}: a good length.`);

  // ---- focus keyword
  if (!kw) {
    add('keyword', 'Focus keyword', 'Focus keyword', 5, 'fail', 'No focus keyword is set.', 'Add the main phrase people would search for, e.g. “lung detox after smoking”. The checks below then look for it.');
  } else {
    add('keyword', 'Focus keyword', 'Focus keyword', 5, 'pass', `Checking for “${seo.focusKeyword.trim()}”.`);
    add('kw-title', 'Focus keyword', 'Keyword in the title', 8, has(fullTitle, kw) ? 'pass' : 'fail', has(fullTitle, kw) ? 'The SEO title contains the keyword.' : 'The SEO title does not contain the keyword.', 'Use the keyword in the title, ideally near the start.');
    add('kw-desc', 'Focus keyword', 'Keyword in the description', 5, has(description, kw) ? 'pass' : 'warn', has(description, kw) ? 'The description contains the keyword.' : 'The description does not mention the keyword.', 'Google shows the searched words in bold, so mention it once.');
    const slugHas = has(String(article.slug || '').replace(/-/g, ' '), kw);
    add('kw-url', 'Focus keyword', 'Keyword in the URL', 5, slugHas ? 'pass' : 'warn', slugHas ? 'The URL contains the keyword.' : 'The URL does not contain the keyword.', 'Put the keyword in the URL (before publishing: changing a live URL adds a redirect).');
    add('kw-intro', 'Focus keyword', 'Keyword in the introduction', 7, has(intro, kw) ? 'pass' : 'warn', has(intro, kw) ? 'The opening paragraph mentions the keyword.' : 'The opening paragraph does not mention the keyword.', 'Mention it naturally in the first paragraph, so readers and search engines know the topic straight away.');
    const inHeading = headings.some((h) => h.level >= 2 && has(h.text, kw));
    add('kw-heading', 'Focus keyword', 'Keyword in a subheading', 5, inHeading ? 'pass' : 'warn', inHeading ? 'A subheading contains the keyword.' : 'No subheading contains the keyword.', 'Use the keyword (or a close variant) in at least one H2 or H3.');
    const kwWords = kw.split(' ').length;
    const density = words ? (count(text, kw) * kwWords * 100) / words : 0;
    const d = density.toFixed(1);
    const wordsThere = density === 0 && has(text, kw);
    add('kw-density', 'Focus keyword', 'Keyword use', 5, density === 0 ? (wordsThere ? 'warn' : 'fail') : density < 0.5 ? 'warn' : density > 3 ? 'warn' : 'pass',
      density === 0 ? (wordsThere ? 'The words of the keyword appear, but never as the exact phrase.' : 'The keyword does not appear in the text.')
        : density > 3 ? `The keyword makes up ${d}% of the text, which can read as keyword stuffing.` : `The keyword makes up ${d}% of the text.`,
      density > 3 ? 'Use it less, and use natural variations instead.' : density < 0.5 ? 'Use the exact phrase a few times where it reads naturally (0.5% to 3%).' : '');
    const dupKw = (ctx.others || []).filter((o) => o.id !== ctx.selfId && norm(o.focusKeyword) === kw);
    if (dupKw.length) add('kw-unique', 'Focus keyword', 'Keyword not used elsewhere', 4, 'warn', `“${dupKw[0].title}”${dupKw.length > 1 ? ` and ${dupKw.length - 1} more` : ''} also target${dupKw.length > 1 ? '' : 's'} this keyword.`, 'Articles chasing the same keyword compete with each other. Pick a more specific keyword, or merge the articles.');
    else add('kw-unique', 'Focus keyword', 'Keyword not used elsewhere', 4, 'pass', 'No other article targets this keyword.');
  }

  // ---- URL
  const slug = String(article.slug || '');
  const slugWords = slug.split('-').filter(Boolean).length;
  if (/^draft-/.test(slug)) add('url', 'Address', 'Readable URL', 5, 'fail', 'The URL is still a temporary draft address.', 'Give it a short URL that describes the article, e.g. /blogs/lung-detox-after-smoking.');
  else if (slug.length > 80 || slugWords > 10) add('url', 'Address', 'Readable URL', 5, 'warn', `The URL is long (${slugWords} words).`, `Keep it to about ${LIMITS.slugWords} words: drop filler words like “how”, “the”, “and”.`);
  else if (slug.length > LIMITS.slugChars || slugWords > LIMITS.slugWords) add('url', 'Address', 'Readable URL', 5, 'warn', `The URL has ${slugWords} words; shorter is easier to read and share.`, 'Remove filler words.');
  else add('url', 'Address', 'Readable URL', 5, 'pass', 'Short and readable.');

  // ---- structure
  const levels = headings.map((h) => h.level);
  const bodyH1 = levels.filter((l) => l === 1).length;
  let skipped = null;
  for (let i = 0, prev = 1; i < levels.length; i++) { if (levels[i] > prev + 1) { skipped = [prev, levels[i]]; break; } prev = levels[i]; }
  if (bodyH1) add('headings', 'Structure', 'Heading order', 8, 'fail', `The text has ${bodyH1} Heading 1. The article title is already the page’s H1.`, 'Change those headings to Heading 2.');
  else if (skipped) add('headings', 'Structure', 'Heading order', 8, 'warn', `A Heading ${skipped[1]} follows a Heading ${skipped[0]}, skipping a level.`, `Use Heading ${skipped[0] + 1} there, so the outline reads in order.`);
  else if (words >= 300 && !levels.includes(2)) add('headings', 'Structure', 'Heading order', 8, 'warn', 'There are no subheadings.', 'Break the article into sections with Heading 2 titles; readers scan, and search engines read the outline.');
  else add('headings', 'Structure', 'Heading order', 8, 'pass', headings.length ? `${headings.length} subheading${headings.length === 1 ? '' : 's'}, in order.` : 'A short article without subheadings.');

  if (words < LIMITS.minWords) add('length', 'Structure', 'Length', 7, words < 150 ? 'fail' : 'warn', `${words} words.`, `Most useful guides run ${LIMITS.goodWords}+ words. Add what a reader would still want to know.`);
  else add('length', 'Structure', 'Length', 7, words < LIMITS.goodWords ? 'warn' : 'pass', `${words} words.`, words < LIMITS.goodWords ? `Fine for a short read; ${LIMITS.goodWords}+ words usually covers a topic fully.` : '');

  // readability: long sentences and walls of text
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(' ').length > 2);
  const avg = sentences.length ? Math.round(words / sentences.length) : 0;
  const longParas = (article.content?.content || []).filter((n) => n.type === 'paragraph' && textOf(n).trim().split(/\s+/).length > 150).length;
  const read = (avg && avg > 25) || longParas > 1 ? 'fail' : avg > 20 || longParas ? 'warn' : 'pass';
  add('readability', 'Structure', 'Easy to read', 5, words ? read : 'fail', words ? `About ${avg} words per sentence${longParas ? `; ${longParas} paragraph${longParas === 1 ? ' is' : 's are'} over 150 words` : ''}.` : 'No text yet.',
    read === 'pass' ? '' : 'Keep most sentences under 20 words and split long paragraphs. Short sentences are easier on a phone.');

  // ---- links
  const internal = links.filter((l) => /^\/(?!\/)/.test(l.href));
  const external = links.filter((l) => /^https?:\/\//i.test(l.href) && !(ctx.siteOrigin && l.href.startsWith(ctx.siteOrigin)));
  const broken = ctx.knownPaths ? internal.filter((l) => !ctx.knownPaths.has(pathOf(l.href))) : [];
  if (broken.length) add('internal', 'Links', 'Internal links', 5, 'fail', `${broken.length} link${broken.length === 1 ? ' goes' : 's go'} to a page that does not exist: ${broken.slice(0, 3).map((l) => l.href).join(', ')}.`, 'Fix or remove these links (start typing “/” in the link box to pick a real page).');
  else if (!internal.length) add('internal', 'Links', 'Internal links', 5, 'warn', 'No links to other pages on this site.', 'Link to a related article or product. It helps readers and helps search engines find your other pages.');
  else add('internal', 'Links', 'Internal links', 5, 'pass', `${internal.length} link${internal.length === 1 ? '' : 's'} to this site${ctx.knownPaths ? ', all to existing pages' : ''}.`);
  add('external', 'Links', 'Sources', 3, external.length ? 'pass' : 'warn', external.length ? `${external.length} link${external.length === 1 ? '' : 's'} to other websites.` : 'No links to outside sources.',
    external.length ? '' : 'For health topics, linking to a trustworthy source (a study, a government or hospital page) builds trust.');

  // ---- images
  const missingAlt = images.filter((i) => !i.alt).length + (article.featuredImage && !String(article.featuredImageAlt || '').trim() ? 1 : 0);
  const totalImages = images.length + (article.featuredImage ? 1 : 0);
  if (!totalImages) add('alt', 'Images', 'Alt text', 7, 'warn', 'No photos yet.', 'A cover photo and a photo or two in the text make the article easier to read and to share.');
  else if (missingAlt) add('alt', 'Images', 'Alt text', 7, 'fail', `${missingAlt} of ${totalImages} photo${totalImages === 1 ? ' has' : 's have'} no alt text.`, 'Describe each photo in a few words. Screen readers read it aloud and image search uses it.');
  else add('alt', 'Images', 'Alt text', 7, 'pass', `All ${totalImages} photo${totalImages === 1 ? ' has' : 's have'} alt text.`);
  add('cover', 'Images', 'Cover photo', 5, article.featuredImage ? 'pass' : 'fail', article.featuredImage ? 'Set, so shares on WhatsApp, Facebook and X show a picture.' : 'There is no cover photo.', article.featuredImage ? '' : 'Add one: it is shown on the Blogs page and when the article is shared.');
  const heavy = [...images.map((i) => i.src), article.featuredImage || ''].filter((s) => /\.(png|gif|bmp|tiff?)(\?|$)/i.test(s));
  add('img-format', 'Images', 'Image size', 3, heavy.length ? 'warn' : 'pass', heavy.length ? `${heavy.length} image${heavy.length === 1 ? ' is a' : 's are'} PNG/GIF, which are usually heavy for photos.` : 'No heavy image formats found.', heavy.length ? 'Use JPEG or WebP photos, about 1600 pixels wide. (The media library will do this automatically.)' : '');

  // ---- duplicates across the blog
  const others = (ctx.others || []).filter((o) => o.id !== ctx.selfId);
  const sameTitle = others.find((o) => norm(o.seoTitle || `${o.title}${BRAND_SUFFIX}`) === norm(fullTitle));
  const sameDesc = description && others.find((o) => norm(o.description) === norm(description));
  if (sameTitle || sameDesc) add('unique', 'Duplicates', 'Unique title and description', 5, 'fail', `${sameTitle ? `The title matches “${sameTitle.title}”. ` : ''}${sameDesc ? `The description matches “${sameDesc.title}”.` : ''}`.trim(), 'Every article needs its own title and description, or search engines may show only one of them.');
  else add('unique', 'Duplicates', 'Unique title and description', 5, 'pass', 'No other article uses the same title or description.');

  const max = checks.reduce((n, c) => n + c.max, 0);
  const earned = checks.reduce((n, c) => n + c.points, 0);
  return { score: max ? Math.round((earned / max) * 100) : 0, earned, max, checks, words, html };
}

/** 80+ good, 50-79 needs work, under 50 poor. */
export const scoreBand = (score) => (score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor');
