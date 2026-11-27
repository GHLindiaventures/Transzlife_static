// The article editor's schema (TipTap). It matches server/cms/render.js exactly: the server keeps only these
// nodes, marks and attributes, and renders them with the website's article styles. Anything pasted in that is
// not listed here (fonts, colours, inline styles, scripts, iframes) never makes it into the document.
import { Node, mergeAttributes, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import Link from '@tiptap/extension-link';
import { Trash2, Plus, Video as VideoIcon, Link2 } from 'lucide-react';

/* ---------------- image with alt text and caption ---------------- */
function ImageView({ node, updateAttributes, deleteNode, selected }) {
  const { src, alt, caption } = node.attrs;
  return (
    <NodeViewWrapper className={`cms-figure ${selected ? 'is-selected' : ''}`} data-drag-handle contentEditable={false}>
      <img src={src} alt={alt || ''} draggable={false} />
      <div className="cms-figure__fields">
        <label className={!alt ? 'is-missing' : ''}>Alt text <small>(describe the photo for screen readers and search)</small>
          <input value={alt || ''} maxLength={300} onChange={(e) => updateAttributes({ alt: e.target.value })} placeholder="e.g. A bowl of tulsi tea among fresh leaves" />
        </label>
        <label>Caption <small>(optional, shown under the photo)</small>
          <input value={caption || ''} maxLength={300} onChange={(e) => updateAttributes({ caption: e.target.value })} />
        </label>
        <button type="button" className="adm-btn is-ghost is-sm is-danger" onClick={deleteNode}><Trash2 size={14} /> Remove photo</button>
      </div>
    </NodeViewWrapper>
  );
}
export const ArticleImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' }, caption: { default: '' }, width: { default: null }, height: { default: null } }),
  parseHTML: () => [
    { tag: 'figure', getAttrs: (el) => { const img = el.querySelector('img'); return img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '', caption: el.querySelector('figcaption')?.textContent || '' } : false; } },
    { tag: 'img[src]', getAttrs: (el) => ({ src: el.getAttribute('src'), alt: el.getAttribute('alt') || '' }) },
  ],
  renderHTML: ({ HTMLAttributes: a }) => ['figure', ['img', { src: a.src, alt: a.alt }], ...(a.caption ? [['figcaption', a.caption]] : [])],
  addNodeView: () => ReactNodeViewRenderer(ImageView),
});

/* ---------------- video (YouTube / Vimeo, by id only) ---------------- */
/** A YouTube or Vimeo address -> { provider, id }, or null. */
export function parseVideoUrl(input) {
  let u;
  try { u = new URL(String(input).trim()); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') { const id = u.pathname.slice(1, 12); return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: 'youtube', id } : null; }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = u.searchParams.get('v') || (/^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname) || [])[2];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: 'youtube', id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const m = /(\d{1,12})/.exec(u.pathname); return m ? { provider: 'vimeo', id: m[1] } : null; }
  return null;
}
function VideoView({ node, updateAttributes, deleteNode, selected }) {
  const { provider, id, title, caption } = node.attrs;
  return (
    <NodeViewWrapper className={`cms-figure cms-video ${selected ? 'is-selected' : ''}`} data-drag-handle contentEditable={false}>
      <div className="cms-video__box"><VideoIcon size={28} /><span>{provider === 'vimeo' ? 'Vimeo' : 'YouTube'} video · {id}</span></div>
      <div className="cms-figure__fields">
        <label className={!title ? 'is-missing' : ''}>Video title <small>(read out by screen readers)</small>
          <input value={title || ''} maxLength={150} onChange={(e) => updateAttributes({ title: e.target.value })} />
        </label>
        <label>Caption <small>(optional)</small><input value={caption || ''} maxLength={300} onChange={(e) => updateAttributes({ caption: e.target.value })} /></label>
        <button type="button" className="adm-btn is-ghost is-sm is-danger" onClick={deleteNode}><Trash2 size={14} /> Remove video</button>
      </div>
    </NodeViewWrapper>
  );
}
export const ArticleVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({ provider: { default: 'youtube' }, id: { default: '' }, title: { default: '' }, caption: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-video]', getAttrs: (el) => ({ provider: el.getAttribute('data-provider'), id: el.getAttribute('data-id') }) }],
  renderHTML: ({ HTMLAttributes: a }) => ['div', { 'data-video': '', 'data-provider': a.provider, 'data-id': a.id }],
  addNodeView: () => ReactNodeViewRenderer(VideoView),
});

/* ---------------- callout (highlighted note) ---------------- */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: '(paragraph | bulletList | orderedList)+',
  defining: true,
  parseHTML: () => [{ tag: 'div.article__callout' }, { tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'cms-callout' }), 0],
});

/* ---------------- FAQ (questions with answers) ---------------- */
function FaqView({ editor, getPos, node }) {
  const add = () => {
    const end = getPos() + node.nodeSize - 1;
    editor.chain().insertContentAt(end, { type: 'faqItem', attrs: { question: '' }, content: [{ type: 'paragraph' }] }).run();
  };
  return (
    <NodeViewWrapper className="cms-faq">
      <p className="cms-block-label" contentEditable={false}>Questions and answers</p>
      <NodeViewContent className="cms-faq__items" />
      <button type="button" className="adm-btn is-ghost is-sm" contentEditable={false} onClick={add}><Plus size={14} /> Add a question</button>
    </NodeViewWrapper>
  );
}
function FaqItemView({ node, updateAttributes, deleteNode }) {
  return (
    <NodeViewWrapper className="cms-faq__item">
      <div className="cms-faq__q" contentEditable={false}>
        <input value={node.attrs.question || ''} maxLength={300} placeholder="Question" aria-label="Question" onChange={(e) => updateAttributes({ question: e.target.value })} />
        <button type="button" className="adm-icon" aria-label="Remove this question" onClick={deleteNode}><Trash2 size={15} /></button>
      </div>
      <NodeViewContent className="cms-faq__a" />
    </NodeViewWrapper>
  );
}
export const Faq = Node.create({
  name: 'faq',
  group: 'block',
  content: 'faqItem+',
  parseHTML: () => [{ tag: 'dl.article__faq' }, { tag: 'div[data-faq]' }],
  renderHTML: () => ['div', { 'data-faq': '' }, 0],
  addNodeView: () => ReactNodeViewRenderer(FaqView),
});
export const FaqItem = Node.create({
  name: 'faqItem',
  content: 'paragraph+',
  defining: true,
  addAttributes: () => ({ question: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-faq-item]', getAttrs: (el) => ({ question: el.getAttribute('data-question') || '' }) }],
  renderHTML: ({ HTMLAttributes: a }) => ['div', { 'data-faq-item': '', 'data-question': a.question }, 0],
  addNodeView: () => ReactNodeViewRenderer(FaqItemView),
});

/* ---------------- product / page call to action ---------------- */
function CtaView({ node, updateAttributes, deleteNode }) {
  const { href, label } = node.attrs;
  return (
    <NodeViewWrapper className="cms-cta">
      <p className="cms-block-label" contentEditable={false}><Link2 size={14} /> Call to action</p>
      <NodeViewContent className="cms-cta__text" />
      <div className="cms-cta__fields" contentEditable={false}>
        <label className={!label ? 'is-missing' : ''}>Button text<input value={label || ''} maxLength={60} placeholder="e.g. Explore BreatheFree" onChange={(e) => updateAttributes({ label: e.target.value })} /></label>
        <label className={!href ? 'is-missing' : ''}>Button link<input value={href || ''} maxLength={500} placeholder="/products/... or https://..." list="cms-internal-links" onChange={(e) => updateAttributes({ href: e.target.value.trim() })} /></label>
        <button type="button" className="adm-icon" aria-label="Remove call to action" onClick={deleteNode}><Trash2 size={15} /></button>
      </div>
    </NodeViewWrapper>
  );
}
export const Cta = Node.create({
  name: 'cta',
  group: 'block',
  content: 'paragraph',
  defining: true,
  addAttributes: () => ({ href: { default: '' }, label: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-cta]', getAttrs: (el) => ({ href: el.getAttribute('data-href') || '', label: el.getAttribute('data-label') || '' }) }],
  renderHTML: ({ HTMLAttributes: a }) => ['div', { 'data-cta': '', 'data-href': a.href, 'data-label': a.label }, 0],
  addNodeView: () => ReactNodeViewRenderer(CtaView),
});

/* ---------------- links: plus "nofollow" and "sponsored" for outside links ---------------- */
export const ArticleLink = Link.extend({
  addAttributes() {
    return {
      href: { default: null, parseHTML: (el) => el.getAttribute('href') },
      nofollow: { default: false, parseHTML: (el) => /\bnofollow\b/.test(el.getAttribute('rel') || ''), renderHTML: () => ({}) },
      sponsored: { default: false, parseHTML: (el) => /\bsponsored\b/.test(el.getAttribute('rel') || ''), renderHTML: () => ({}) },
    };
  },
}).configure({
  openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https',
  protocols: ['http', 'https', 'mailto', 'tel'],
  // the same rule as the server's safeUrl(): pages on this site, #anchors, http(s), mailto and tel only
  isAllowedUri: (url) => /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(String(url || '').trim()),
  HTMLAttributes: { target: null, rel: null, class: null },
});

/** Every extension the article editor uses. */
export function articleExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // not part of the website's article style: dropped (pasted text keeps its words, loses this formatting)
      code: false, codeBlock: false, strike: false, underline: false,
      link: false,      // ArticleLink below
    }),
    ArticleLink,
    Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    ArticleImage, ArticleVideo, Callout, Faq, FaqItem, Cta,
    Placeholder.configure({ placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Write your article… Use the toolbar for headings, lists, photos and more.'), includeChildren: false }),
  ];
}
