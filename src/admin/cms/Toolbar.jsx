// Article editor toolbar and its small dialogs (link, photo, video).
import { useState } from 'react';
import { useEditorState } from '@tiptap/react';
import {
  Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote, Minus, Table as TableIcon, Image as ImageIcon, Video, MessageSquareQuote,
  HelpCircle, MousePointerClick, Undo2, Redo2, X, Rows3, Columns3, Trash2,
} from 'lucide-react';
import { parseVideoUrl } from './extensions';
import { Modal } from './Modal';

export { Modal };

const isSafeLink = (u) => /^(\/(?!\/)|#[A-Za-z0-9_-]+$|https?:\/\/[^\s]+$|mailto:[^\s]+$|tel:[+\d\s-]+$)/i.test(u);
const isSafeImage = (u) => /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/i.test(u);

function LinkDialog({ editor, onClose }) {
  const current = editor.getAttributes('link');
  const [href, setHref] = useState(current.href || '');
  const [nofollow, setNofollow] = useState(!!current.nofollow);
  const [sponsored, setSponsored] = useState(!!current.sponsored);
  const [error, setError] = useState('');
  const external = /^https?:\/\//i.test(href);
  const save = () => {
    const v = href.trim();
    if (!v) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); return; }
    if (!isSafeLink(v)) { setError('Use a page on this site (like /shop or /blogs/...), a full https:// address, mailto: or tel:.'); return; }
    const attrs = { href: v, nofollow: external && nofollow, sponsored: external && sponsored };
    if (editor.state.selection.empty && !editor.isActive('link')) editor.chain().focus().insertContent({ type: 'text', text: v, marks: [{ type: 'link', attrs }] }).run();
    else editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
    onClose();
  };
  return (
    <Modal title="Link" onClose={onClose} onSubmit={save}>
      <label>Address<input autoFocus value={href} onChange={(e) => { setHref(e.target.value); setError(''); }} list="cms-internal-links" placeholder="/products/pulmoclear-gummies or https://…" /></label>
      <p className="adm-field-note">Start typing <b>/</b> to pick a page or article on this site. Links to other websites open in a new tab.</p>
      {external && (
        <div className="cms-checks">
          <label className="adm-check"><input type="checkbox" checked={nofollow} onChange={(e) => setNofollow(e.target.checked)} /> Don’t pass search ranking to this site (nofollow)</label>
          <label className="adm-check"><input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} /> Paid or affiliate link (sponsored)</label>
        </div>
      )}
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-actions">
        {current.href && <button type="button" className="adm-btn is-ghost is-danger" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); }}>Remove link</button>}
        <button className="adm-btn">Save link</button>
      </div>
    </Modal>
  );
}

function ImageDialog({ editor, onClose }) {
  const [f, setF] = useState({ src: '', alt: '', caption: '' });
  const [error, setError] = useState('');
  const save = () => {
    const src = f.src.trim();
    if (!isSafeImage(src)) { setError('Use an image address starting with https:// or a path on this site (like /assets/photos/…).'); return; }
    editor.chain().focus().insertContent({ type: 'image', attrs: { src, alt: f.alt.trim(), caption: f.caption.trim() } }).run();
    onClose();
  };
  return (
    <Modal title="Add a photo" onClose={onClose} onSubmit={save}>
      <label>Image address<input autoFocus required value={f.src} onChange={(e) => { setF({ ...f, src: e.target.value }); setError(''); }} placeholder="https://… or /assets/photos/…" /></label>
      <p className="adm-field-note">Uploading photos from your computer arrives with the media library. For now, paste the address of a photo that is already online.</p>
      {isSafeImage(f.src.trim()) && <img className="cms-dialog-preview" src={f.src.trim()} alt="" />}
      <label>Alt text<input value={f.alt} maxLength={300} onChange={(e) => setF({ ...f, alt: e.target.value })} placeholder="What the photo shows, for screen readers and search" /></label>
      <label>Caption <small className="adm-muted">(optional)</small><input value={f.caption} maxLength={300} onChange={(e) => setF({ ...f, caption: e.target.value })} /></label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-actions"><button className="adm-btn">Add photo</button></div>
    </Modal>
  );
}

function VideoDialog({ editor, onClose }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    const v = parseVideoUrl(url);
    if (!v) { setError('Paste a YouTube or Vimeo video address, like https://www.youtube.com/watch?v=…'); return; }
    editor.chain().focus().insertContent({ type: 'video', attrs: { ...v, title: title.trim() } }).run();
    onClose();
  };
  return (
    <Modal title="Add a video" onClose={onClose} onSubmit={save}>
      <label>YouTube or Vimeo address<input autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setError(''); }} placeholder="https://www.youtube.com/watch?v=…" /></label>
      <label>Video title<input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A 5-minute breathing routine" /></label>
      <p className="adm-field-note">YouTube videos play from youtube-nocookie.com, so visitors are not tracked until they press play.</p>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-actions"><button className="adm-btn">Add video</button></div>
    </Modal>
  );
}

function Btn({ on, label, onClick, disabled, children }) {
  return (
    <button type="button" className={`cms-tb__btn ${on ? 'is-on' : ''}`} title={label} aria-label={label} aria-pressed={on === undefined ? undefined : !!on}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}>{children}</button>
  );
}

const BLOCKS = [['p', 'Paragraph'], ['1', 'Heading 1 (the title is already the H1)'], ['2', 'Heading 2'], ['3', 'Heading 3'], ['4', 'Heading 4']];

export default function Toolbar({ editor, dialog, setDialog }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: [1, 2, 3, 4].find((l) => e.isActive('heading', { level: l })) || 'p',
      bold: e.isActive('bold'), italic: e.isActive('italic'), link: e.isActive('link'),
      ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), quote: e.isActive('blockquote'), callout: e.isActive('callout'),
      table: e.isActive('table'), undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const setBlock = (v) => (v === 'p' ? c().setParagraph().run() : c().setHeading({ level: Number(v) }).run());
  return (
    <div className="cms-tb" role="toolbar" aria-label="Formatting">
      <select className="cms-tb__select" value={String(s.block)} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        {BLOCKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="cms-tb__sep" />
      <Btn label="Bold (Ctrl+B)" on={s.bold} onClick={() => c().toggleBold().run()}><Bold size={17} /></Btn>
      <Btn label="Italic (Ctrl+I)" on={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={17} /></Btn>
      <Btn label="Link (Ctrl+K)" on={s.link} onClick={() => setDialog('link')}><LinkIcon size={17} /></Btn>
      <span className="cms-tb__sep" />
      <Btn label="Bulleted list" on={s.ul} onClick={() => c().toggleBulletList().run()}><List size={17} /></Btn>
      <Btn label="Numbered list" on={s.ol} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={17} /></Btn>
      <Btn label="Quote" on={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={17} /></Btn>
      <Btn label="Highlighted note" on={s.callout} onClick={() => (s.callout ? c().lift('callout').run() : c().wrapIn('callout').run())}><MessageSquareQuote size={17} /></Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus size={17} /></Btn>
      <span className="cms-tb__sep" />
      <Btn label="Photo" onClick={() => setDialog('image')}><ImageIcon size={17} /></Btn>
      <Btn label="Video" onClick={() => setDialog('video')}><Video size={17} /></Btn>
      <Btn label="Table" on={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={s.table}><TableIcon size={17} /></Btn>
      <Btn label="Questions and answers (FAQ)" onClick={() => c().insertContent({ type: 'faq', content: [{ type: 'faqItem', attrs: { question: '' }, content: [{ type: 'paragraph' }] }] }).run()}><HelpCircle size={17} /></Btn>
      <Btn label="Call to action button" onClick={() => c().insertContent({ type: 'cta', attrs: { href: '', label: '' }, content: [{ type: 'paragraph' }] }).run()}><MousePointerClick size={17} /></Btn>
      <span className="cms-tb__sep" />
      <Btn label="Undo (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.undo}><Undo2 size={17} /></Btn>
      <Btn label="Redo (Ctrl+Shift+Z)" onClick={() => c().redo().run()} disabled={!s.redo}><Redo2 size={17} /></Btn>
      {s.table && (
        <div className="cms-tb__table" role="group" aria-label="Table">
          <Btn label="Add a row below" onClick={() => c().addRowAfter().run()}><Rows3 size={16} /> <span>+ row</span></Btn>
          <Btn label="Add a column to the right" onClick={() => c().addColumnAfter().run()}><Columns3 size={16} /> <span>+ column</span></Btn>
          <Btn label="Delete this row" onClick={() => c().deleteRow().run()}><Rows3 size={16} /> <span>− row</span></Btn>
          <Btn label="Delete this column" onClick={() => c().deleteColumn().run()}><Columns3 size={16} /> <span>− column</span></Btn>
          <Btn label="Make the first row headings" onClick={() => c().toggleHeaderRow().run()}><span>Header row</span></Btn>
          <Btn label="Delete the table" onClick={() => c().deleteTable().run()}><Trash2 size={16} /> <span>Table</span></Btn>
        </div>
      )}
      {dialog === 'link' && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'image' && <ImageDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'video' && <VideoDialog editor={editor} onClose={() => setDialog(null)} />}
    </div>
  );
}
