// Article body: editor document (ProseMirror / TipTap JSON) -> HTML for the public site.
//
// Safe by construction: only the node types and marks listed below are rendered, every text value is
// escaped, and every URL must pass safeUrl(). Unknown nodes are dropped, so nothing typed or pasted into
// the editor can add scripts, event handlers, styles or iframes from other sites. The output uses the
// site's existing article classes (article__callout, article__table, article__faq, article__figure, article__cta).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * A link or image address that is safe to put in the page, or null.
 * Allowed: paths on this site ("/shop", "/blogs/x#part"), "#anchor" (links only), https:// (and for links
 * http://, mailto:, tel:). An absolute address on `siteOrigin` becomes a path, so it stays an internal link.
 */
export function safeUrl(value, { image = false, siteOrigin = '' } = {}) {
  const s = String(value ?? '').trim();
  if (!s || s.length > 2000 || /[\s<>"'`\\]/.test(s)) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (s.startsWith('#')) return image ? null : (/^#[A-Za-z0-9_-]+$/.test(s) ? s : null);
  let url;
  try { url = new URL(s); } catch { return null; }
  if (siteOrigin && url.origin === siteOrigin) return `${url.pathname}${url.search}${url.hash}` || '/';
  const allowed = image ? ['https:'] : ['https:', 'http:', 'mailto:', 'tel:'];
  return allowed.includes(url.protocol) ? url.href : null;
}

export const isExternal = (href) => /^(https?:)?\/\//i.test(href);

/** "Liver & Digestion: 5 Habits" -> "liver-digestion-5-habits" */
export function slugify(s, max = 80) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
}

const VIDEO = {
  youtube: { id: /^[A-Za-z0-9_-]{11}$/, src: (id) => `https://www.youtube-nocookie.com/embed/${id}` },
  vimeo: { id: /^\d{1,12}$/, src: (id) => `https://player.vimeo.com/video/${id}?dnt=1` },
};
export const VIDEO_ORIGINS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

const kids = (n) => (Array.isArray(n?.content) ? n.content : []);
const int = (v, min, max) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

/** Plain text of a node (for heading ids, word counts and checks). */
export function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return String(node.text ?? '');
  if (node.type === 'hardBreak') return ' ';
  const sep = ['paragraph', 'heading', 'listItem', 'tableCell', 'tableHeader', 'blockquote', 'faqItem', 'callout'].includes(node.type) ? ' ' : '';
  return kids(node).map(textOf).join(sep) + sep;
}

/**
 * Renders a document. Returns { html, text, words, headings: [{ level, text, id }] }.
 * options.siteOrigin: this site's https origin, so absolute links to it render as internal paths.
 */
export function renderDoc(doc, { siteOrigin = '' } = {}) {
  const usedIds = new Map();
  const headings = [];
  const headingId = (text) => {
    const base = slugify(text, 60) || 'section';
    const n = usedIds.get(base) || 0;
    usedIds.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  const inline = (nodes) => nodes.map((n) => {
    if (n.type === 'hardBreak') return '<br>';
    if (n.type !== 'text') return '';
    let out = esc(n.text);
    const marks = Array.isArray(n.marks) ? n.marks : [];
    if (marks.some((m) => m.type === 'italic')) out = `<em>${out}</em>`;
    if (marks.some((m) => m.type === 'bold')) out = `<strong>${out}</strong>`;
    const link = marks.find((m) => m.type === 'link');
    const href = link && safeUrl(link.attrs?.href, { siteOrigin });
    if (href) {
      const ext = isExternal(href);
      const rel = ['noopener', 'noreferrer', ...(link.attrs?.nofollow ? ['nofollow'] : []), ...(link.attrs?.sponsored ? ['sponsored'] : [])];
      out = ext ? `<a href="${esc(href)}" target="_blank" rel="${rel.join(' ')}">${out}</a>` : `<a href="${esc(href)}">${out}</a>`;
    }
    return out;
  }).join('');

  const cell = (c, rowIndex, colIndex, headRow) => {
    const tag = c.type === 'tableHeader' ? 'th' : 'td';
    const scope = tag === 'th' ? (headRow ? ' scope="col"' : colIndex === 0 ? ' scope="row"' : '') : '';
    const span = (int(c.attrs?.colspan, 2, 20) ? ` colspan="${int(c.attrs.colspan, 2, 20)}"` : '') + (int(c.attrs?.rowspan, 2, 50) ? ` rowspan="${int(c.attrs.rowspan, 2, 50)}"` : '');
    // a cell holds paragraphs; one paragraph renders as plain text in the cell
    const inner = kids(c).length === 1 && kids(c)[0].type === 'paragraph' ? inline(kids(kids(c)[0])) : block(kids(c));
    return `<${tag}${scope}${span}>${inner}</${tag}>`;
  };

  function node(n) {
    switch (n?.type) {
      case 'paragraph': { const inner = inline(kids(n)); return inner ? `<p>${inner}</p>` : ''; }
      case 'heading': {
        const level = int(n.attrs?.level, 1, 4) || 2;
        const text = textOf(n).trim();
        if (!text) return '';
        const id = headingId(text);
        headings.push({ level, text, id });
        return `<h${level} id="${esc(id)}">${inline(kids(n))}</h${level}>`;
      }
      case 'bulletList': return `<ul>${kids(n).map(node).join('')}</ul>`;
      case 'orderedList': {
        const start = int(n.attrs?.start, 2, 10000);
        return `<ol${start ? ` start="${start}"` : ''}>${kids(n).map(node).join('')}</ol>`;
      }
      case 'listItem': {
        // a single paragraph renders inline, so list markup stays compact (<li>text</li>)
        const c = kids(n);
        return `<li>${c.length === 1 && c[0].type === 'paragraph' ? inline(kids(c[0])) : block(c)}</li>`;
      }
      case 'blockquote': return `<blockquote>${block(kids(n))}</blockquote>`;
      case 'horizontalRule': return '<hr>';
      case 'callout': return `<div class="article__callout">${block(kids(n))}</div>`;
      case 'table': {
        const rows = kids(n).filter((r) => r.type === 'tableRow');
        if (!rows.length) return '';
        const headRow = kids(rows[0]).length > 0 && kids(rows[0]).every((c) => c.type === 'tableHeader');
        const tr = (r, i, head) => `<tr>${kids(r).map((c, j) => cell(c, i, j, head)).join('')}</tr>`;
        const body = (headRow ? rows.slice(1) : rows).map((r, i) => tr(r, i + 1, false)).join('');
        return `<div class="article__table"><table>${headRow ? `<thead>${tr(rows[0], 0, true)}</thead>` : ''}<tbody>${body}</tbody></table></div>`;
      }
      case 'image': {
        const src = safeUrl(n.attrs?.src, { image: true, siteOrigin });
        if (!src) return '';
        const w = int(n.attrs?.width, 1, 10000), h = int(n.attrs?.height, 1, 10000);
        const caption = String(n.attrs?.caption ?? '').trim();
        return `<figure class="article__figure"><img src="${esc(src)}" alt="${esc(n.attrs?.alt ?? '')}"${w && h ? ` width="${w}" height="${h}"` : ''} loading="lazy" decoding="async">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
      }
      case 'video': {
        const v = VIDEO[n.attrs?.provider];
        const id = String(n.attrs?.id ?? '');
        if (!v || !v.id.test(id)) return '';
        const title = String(n.attrs?.title ?? '').trim() || 'Video';
        const caption = String(n.attrs?.caption ?? '').trim();
        return `<figure class="article__video"><div class="article__video-frame"><iframe src="${esc(v.src(id))}" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
      }
      case 'faq': {
        const items = kids(n).filter((i) => i.type === 'faqItem' && String(i.attrs?.question ?? '').trim());
        if (!items.length) return '';
        return `<dl class="article__faq">${items.map((i) => {
          const c = kids(i);
          const answer = c.length === 1 && c[0].type === 'paragraph' ? inline(kids(c[0])) : block(c);
          return `<div><dt>${esc(String(i.attrs.question).trim())}</dt><dd>${answer}</dd></div>`;
        }).join('')}</dl>`;
      }
      case 'cta': {
        const href = safeUrl(n.attrs?.href, { siteOrigin });
        const label = String(n.attrs?.label ?? '').trim();
        const text = inline(kids(kids(n)[0]));
        if (!href || !label) return text ? `<div class="article__cta"><p>${text}</p></div>` : '';
        const ext = isExternal(href);
        return `<div class="article__cta">${text ? `<p>${text}</p>` : ''}<a href="${esc(href)}" class="btn"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)} ${ARROW}</a></div>`;
      }
      default: return '';
    }
  }
  const block = (nodes) => nodes.map(node).join('');

  const html = block(kids(doc?.type === 'doc' ? doc : null));
  const text = textOf(doc).replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  return { html, text, words, headings };
}

// What may be stored: node type -> allowed attributes (anything else is dropped before saving).
const NODE_ATTRS = {
  doc: [], paragraph: [], text: [], hardBreak: [], heading: ['level'], bulletList: [], orderedList: ['start'], listItem: [],
  blockquote: [], horizontalRule: [], callout: [], table: [], tableRow: [], tableHeader: ['colspan', 'rowspan'], tableCell: ['colspan', 'rowspan'],
  image: ['src', 'alt', 'caption', 'width', 'height'], video: ['provider', 'id', 'title', 'caption'], faq: [], faqItem: ['question'], cta: ['href', 'label'],
};
const MARK_ATTRS = { bold: [], italic: [], link: ['href', 'nofollow', 'sponsored'] };
const LIMITS = { depth: 24, nodes: 30000, text: 20000, attr: 2000 };

/**
 * Returns a copy of an editor document holding only allowed nodes, marks and attributes (plain values,
 * strings capped), so what is stored is exactly what the renderer understands. Throws on oversized input.
 */
export function cleanDoc(doc) {
  let count = 0;
  const attrsOf = (allowed, attrs) => {
    const out = {};
    for (const k of allowed) {
      const v = attrs?.[k];
      if (v == null) continue;
      if (typeof v === 'string') out[k] = v.slice(0, LIMITS.attr);
      else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  };
  const walk = (n, depth) => {
    if (!n || typeof n !== 'object' || !NODE_ATTRS[n.type] || n.type === 'doc') return null;
    if (++count > LIMITS.nodes || depth > LIMITS.depth) throw Object.assign(new Error('This article is too long or too deeply nested to save.'), { status: 413 });
    if (n.type === 'text') {
      const text = String(n.text ?? '').slice(0, LIMITS.text);
      if (!text) return null;
      const marks = (Array.isArray(n.marks) ? n.marks : []).filter((m) => MARK_ATTRS[m?.type])
        .map((m) => ({ type: m.type, ...(MARK_ATTRS[m.type].length ? { attrs: attrsOf(MARK_ATTRS[m.type], m.attrs) } : {}) }));
      return { type: 'text', text, ...(marks.length ? { marks } : {}) };
    }
    const out = { type: n.type };
    const attrs = attrsOf(NODE_ATTRS[n.type], n.attrs);
    if (Object.keys(attrs).length) out.attrs = attrs;
    if (Array.isArray(n.content)) {
      const content = n.content.map((c) => walk(c, depth + 1)).filter(Boolean);
      if (content.length) out.content = content;
    }
    return out;
  };
  const content = (Array.isArray(doc?.content) ? doc.content : []).map((c) => walk(c, 1)).filter(Boolean);
  return { type: 'doc', content };
}

/** Reading time at about 200 words a minute (at least 1). */
export const readingMinutes = (words) => Math.max(1, Math.min(240, Math.round(Number(words || 0) / 200) || 1));
