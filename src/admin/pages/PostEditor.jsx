// Article editor (Blog posts > an article). Writing, details and publishing for one article.
//
// Saving: every change is saved automatically about 2 seconds after typing stops (the status next to the title
// says so). "Save" also keeps a named version in the history. Leaving the page or closing the tab with unsaved
// changes asks first; switching pages inside the dashboard saves on the way out. If the article was changed in
// another tab, saving stops and asks for a reload instead of overwriting it.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ArrowLeft, Check, Copy, Eye, Archive, ArchiveRestore, Trash2, Globe, EyeOff, AlertTriangle, CloudOff, Loader2, ExternalLink, X, MoreHorizontal, Monitor, Smartphone,
  CalendarClock, History as HistoryIcon,
} from 'lucide-react';
import { api } from '../../store/lib/api';
import { ErrorBox, Notice, can, dt, useAdmin } from '../ui';
import { articleExtensions } from '../cms/extensions';
import Toolbar, { Modal } from '../cms/Toolbar';
import SeoPanel, { ScoreBadge, useSeoAnalysis } from '../cms/SeoPanel';
import ScheduleDialog, { fmtIST } from '../cms/Schedule';
import HistoryDialog from '../cms/History';
import { POST_STATUS } from './BlogPosts';
import '../cms/editor.css';

const AUTOSAVE_MS = 2000;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugify = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
const FIELDS = ['title', 'slug', 'excerpt', 'featuredImage', 'featuredImageAlt', 'categoryId', 'authorId', 'concern', 'disclaimer', 'featured', 'tags', 'seo'];
const fromPost = (p) => Object.fromEntries(FIELDS.map((k) => [k, k === 'seo' ? structuredClone(p.seo) : p[k] ?? (k === 'tags' ? [] : k === 'featured' ? false : '')]));
const STATIC_LINKS = ['/', '/shop', '/blogs', '/concerns', '/ingredients', '/about', '/faq', '/contact', '/policies/shipping', '/policies/privacy', '/policies/terms'];

export default function PostEditor() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: '', post: null, choices: null });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(`/api/admin/cms/posts/${id}`)
      .then((d) => setState({ loading: false, error: '', post: d.post, choices: d.choices, seoContext: d.seoContext }))
      .catch((e) => setState({ loading: false, error: e.message, post: null, choices: null }));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  if (state.error) return <><BackLink /><ErrorBox>{state.error}</ErrorBox></>;
  if (!state.post) return <><BackLink /><p className="adm-muted">Loading the article…</p></>;
  // key: a reload (e.g. after a conflict) starts the editor fresh from the server's copy
  return <EditorScreen key={`${state.post.id}:${state.post.updatedAt}`} initial={state.post} choices={state.choices} seoContext={state.seoContext} onReload={reload} />;
}

const BackLink = () => <Link to="/admin/blog" className="adm-back"><ArrowLeft size={16} /> All articles</Link>;

function EditorScreen({ initial, choices, seoContext, onReload }) {
  const { staff } = useAdmin();
  const navigate = useNavigate();
  const [post, setPost] = useState(initial);             // the server's copy (status, dates, updatedAt)
  const [form, setForm] = useState(() => fromPost(initial));
  const [save, setSave] = useState({ state: 'saved', at: initial.updatedAt, error: '' });   // saved | dirty | saving | offline | conflict | invalid
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);           // link | image | video (toolbar) | preview | delete
  const [menu, setMenu] = useState(false);
  const [words, setWords] = useState(initial.words);
  const [rev, setRev] = useState(0);                   // bumps on every edit in the text (for the live SEO checks)
  const [side, setSide] = useState('details');         // sidebar: details | seo
  const [links, setLinks] = useState(STATIC_LINKS);

  // edits are counted; a save covers the edits made up to when it started
  const edits = useRef(0);
  const savedEdits = useRef(0);
  const base = useRef(initial.updatedAt);
  const inflight = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const slugAuto = useRef(!initial.publishedAt && (initial.slug.startsWith('draft-') || initial.slug === slugify(initial.title)));
  const mayEdit = can(staff, 'content.edit');

  const markDirty = useCallback(() => { edits.current += 1; setSave((s) => (s.state === 'conflict' ? s : { ...s, state: 'dirty' })); }, []);

  const editor = useEditor({
    extensions: articleExtensions(),
    content: initial.content,
    editable: mayEdit,
    editorProps: { attributes: { class: 'cms-prose', 'aria-label': 'Article text', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => { markDirty(); setRev((r) => r + 1); setWords(e.getText().trim().split(/\s+/).filter(Boolean).length); },
  });

  const set = (k) => (v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'title' && slugAuto.current) next.slug = slugify(v) || f.slug;
      return next;
    });
    if (k === 'slug') slugAuto.current = false;
    markDirty();
  };

  const slugError = !SLUG_RE.test(form.slug) ? 'Use lower-case letters, numbers and single hyphens (like healthy-breakfast-ideas).' : '';

  /** Saves everything. autosave=false also records a named version. Resolves to the saved post, or null. */
  const doSave = useCallback(async ({ autosave = true, keepalive = false } = {}) => {
    if (!editor) return null;
    if (inflight.current) await inflight.current.catch(() => {});
    if (autosave && edits.current === savedEdits.current) return post;
    const upTo = edits.current;
    const f = formRef.current;
    const body = {
      baseUpdatedAt: base.current, autosave,
      title: f.title, excerpt: f.excerpt, content: editor.getJSON(),
      featuredImage: f.featuredImage.trim() || null, featuredImageAlt: f.featuredImageAlt,
      categoryId: f.categoryId || null, authorId: f.authorId || null, concern: f.concern || null,
      disclaimer: f.disclaimer.trim() || null, featured: !!f.featured, tags: f.tags, seo: f.seo,
      ...(SLUG_RE.test(f.slug) ? { slug: f.slug } : {}),
    };
    if (keepalive) {
      // leaving the page: send it and don't wait
      fetch(`/api/admin/cms/posts/${post.id}`, { method: 'PATCH', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
      return null;
    }
    setSave((s) => ({ ...s, state: 'saving' }));
    const run = api(`/api/admin/cms/posts/${post.id}`, { method: 'PATCH', body });
    inflight.current = run;
    try {
      const r = await run;
      base.current = r.post.updatedAt;
      savedEdits.current = upTo;
      setPost(r.post);
      setSave({ state: edits.current === upTo ? 'saved' : 'dirty', at: r.post.updatedAt, error: '' });
      return r.post;
    } catch (e) {
      if (e.code === 'conflict') setSave({ state: 'conflict', at: null, error: e.message });
      else if (e.code === 'network' || e.status >= 500 || e.status === 0) setSave((s) => ({ ...s, state: 'offline', error: e.message }));
      else setSave((s) => ({ ...s, state: 'invalid', error: e.message }));
      return null;
    } finally { inflight.current = null; }
  }, [editor, post]);

  // autosave shortly after the last change; retry every 10 s while offline
  useEffect(() => {
    if (!mayEdit || save.state === 'conflict' || save.state === 'invalid') return undefined;
    if (save.state === 'dirty') { const t = setTimeout(() => doSave(), AUTOSAVE_MS); return () => clearTimeout(t); }
    if (save.state === 'offline') { const t = setTimeout(() => doSave(), 10_000); return () => clearTimeout(t); }
    return undefined;
  }, [save.state, form, words, doSave, mayEdit]);

  // unsaved changes: warn on closing the tab; save on the way out of the page
  const unsaved = () => edits.current !== savedEdits.current;
  useEffect(() => {
    const warn = (e) => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const saveRef = useRef(doSave);
  saveRef.current = doSave;
  useEffect(() => () => { if (unsaved()) saveRef.current({ keepalive: true }); }, []);

  // pages and articles to link to (Link dialog and call-to-action buttons)
  useEffect(() => {
    Promise.all([api('/api/blog/posts?limit=100').catch(() => ({ posts: [] })), api('/api/products').catch(() => ({ products: [] }))])
      .then(([b, p]) => setLinks([...STATIC_LINKS, ...(p.products || []).map((x) => `/products/${x.id}`), ...(b.posts || []).map((x) => `/blogs/${x.slug}`)]));
  }, []);

  // Ctrl+K inside the editor opens the link dialog (outside it, it opens dashboard search)
  useEffect(() => {
    if (!editor) return undefined;
    const el = editor.view.dom;
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); setDialog('link'); } };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [editor]);

  const act = async (fn, ok) => {
    setBusy(true); setError(''); setNotice(''); setMenu(false);
    try { const r = await fn(); if (ok) setNotice(ok); return r; } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  };
  const saveNow = () => act(async () => { if (slugError) throw new Error(slugError); const p = await doSave({ autosave: false }); if (!p) throw new Error('Not saved. See the message next to the title.'); return p; }, 'Saved. A copy is kept in this article’s history.');
  const status = async (action, ok) => act(async () => {
    if (slugError) throw new Error(slugError);
    if (unsaved() || action === 'publish') { const p = await doSave({ autosave: action !== 'publish' }); if (!p && unsaved()) throw new Error('Save the article first.'); }
    const r = await api(`/api/admin/cms/posts/${post.id}/${action}`, { method: 'POST', body: {} });
    base.current = r.post.updatedAt; setPost(r.post); setSave({ state: 'saved', at: r.post.updatedAt, error: '' });
    return r;
  }, ok);
  const duplicate = () => act(async () => {
    await doSave();
    const r = await api(`/api/admin/cms/posts/${post.id}/duplicate`, { method: 'POST', body: {} });
    navigate(`/admin/blog/${r.post.id}`);
  });
  const remove = () => act(async () => {
    await api(`/api/admin/cms/posts/${post.id}`, { method: 'DELETE' });
    savedEdits.current = edits.current;            // nothing left to save
    navigate('/admin/blog', { replace: true });
  });
  const openPreview = async () => { await doSave(); setDialog('preview'); };

  // scheduling: save the latest edits first, so what goes live is what is on screen
  const beforeSchedule = async () => {
    if (slugError) throw new Error(slugError);
    await doSave();
    if (unsaved()) throw new Error('Save the article first: see the message next to the title.');
  };
  const scheduled = (p) => {
    base.current = p.updatedAt; setPost(p); setSave({ state: 'saved', at: p.updatedAt, error: '' });
    setDialog(null); setError(''); setNotice(`Scheduled. It goes live on its own at ${fmtIST(p.publishedAt)}.`);
  };

  // version history: what the editor holds right now (compared with earlier versions)
  const currentSnapshot = () => {
    const f = formRef.current;
    return { ...f, content: editor ? editor.getJSON() : initial.content };
  };
  const restoreVersion = async (revisionId) => {
    await doSave();
    const r = await api(`/api/admin/cms/posts/${post.id}/restore-version`, { method: 'POST', body: { revisionId, baseUpdatedAt: base.current } });
    savedEdits.current = edits.current;            // the server copy is now the truth: nothing to save on the way out
    setDialog(null);
    onReload(r.post.updatedAt);                    // reopen the editor on the restored version
  };

  // the title box grows to fit long titles (on load, while typing and when the window is resized)
  const titleRef = useRef(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return undefined;
    const fit = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [form.title]);

  const seoForm = useMemo(() => ({ ...form, id: post.id }), [form, post.id]);
  const analysis = useSeoAnalysis({ editor, form: seoForm, ctx: seoContext, tick: rev });
  const live = post.live;
  const cat = choices.categories.find((c) => c.id === form.categoryId);

  return (
    <div className="cms-editor">
      <datalist id="cms-internal-links">{links.map((l) => <option key={l} value={l} />)}</datalist>
      <div className="cms-editor__top">
        <BackLink />
        <div className="cms-editor__status">
          <span className={`adm-badge is-${POST_STATUS[post.status]?.[1] || 'off'}`}>{POST_STATUS[post.status]?.[0] || post.status}</span>
          <SaveState save={save} onReload={onReload} />
        </div>
        <div className="cms-editor__actions">
          <button className="adm-btn is-ghost" type="button" onClick={openPreview} disabled={busy}><Eye size={16} /> Preview</button>
          {mayEdit && <button className="adm-btn is-ghost" type="button" onClick={saveNow} disabled={busy || save.state === 'conflict'}><Check size={16} /> Save</button>}
          {can(staff, 'content.publish') && (live
            ? <button className="adm-btn is-ghost" type="button" onClick={() => status('unpublish', 'Unpublished. The article is a draft again and is no longer on the website.')} disabled={busy}><EyeOff size={16} /> Unpublish</button>
            : post.status !== 'archived' && (<>
              <button className="adm-btn is-ghost" type="button" onClick={() => setDialog('schedule')} disabled={busy || save.state === 'conflict'}>
                <CalendarClock size={16} /> {post.status === 'scheduled' ? 'Change time' : 'Schedule'}
              </button>
              <button className="adm-btn is-gold" type="button" onClick={() => {
                // advice only: a low SEO score never blocks publishing
                if (analysis && analysis.score < 50 && !window.confirm(`The SEO checklist is at ${analysis.score}/100. Publish anyway?\n\nThe SEO tab lists what would help.`)) return;
                if (post.status === 'scheduled' && !window.confirm(`This article is scheduled for ${fmtIST(post.publishedAt)}. Publish it now instead?`)) return;
                status('publish', 'Published. It is live on the website now.');
              }} disabled={busy || save.state === 'conflict'}><Globe size={16} /> {post.status === 'scheduled' ? 'Publish now' : 'Publish'}</button>
            </>))}
          <div style={{ position: 'relative' }}>
            <button className="adm-icon" type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal size={20} /></button>
            {menu && (
              <div className="adm-pop cms-menu" role="menu">
                {live && <a role="menuitem" className="adm-result" href={post.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View on the website</a>}
                <button role="menuitem" className="adm-result" type="button" onClick={() => { setMenu(false); setDialog('history'); }}><HistoryIcon size={16} /> Version history</button>
                {mayEdit && <button role="menuitem" className="adm-result" type="button" onClick={duplicate}><Copy size={16} /> Duplicate as a new draft</button>}
                {mayEdit && post.status !== 'archived' && <button role="menuitem" className="adm-result" type="button" onClick={() => status('archive', 'Archived. It is hidden from the website and kept here.')}><Archive size={16} /> Archive</button>}
                {mayEdit && post.status === 'archived' && <button role="menuitem" className="adm-result" type="button" onClick={() => status('restore', 'Restored as a draft.')}><ArchiveRestore size={16} /> Restore as a draft</button>}
                {can(staff, 'content.delete') && <button role="menuitem" className="adm-result is-bad" type="button" onClick={() => { setMenu(false); setDialog('delete'); }}><Trash2 size={16} /> Delete…</button>}
              </div>
            )}
          </div>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Notice>{notice}</Notice>

      <div className="cms-editor__grid">
        <section className="cms-editor__main adm-card">
          <textarea ref={titleRef} className="cms-title" rows={1} value={form.title} maxLength={200} placeholder="Article title"
            aria-label="Article title" readOnly={!mayEdit}
            onChange={(e) => set('title')(e.target.value.replace(/\n/g, ' '))} />
          {editor && mayEdit && <Toolbar editor={editor} dialog={dialog} setDialog={setDialog} />}
          <EditorContent editor={editor} className="cms-body" />
          <p className="cms-count adm-muted">{words.toLocaleString('en-IN')} words · about {Math.max(1, Math.round(words / 200))} min read</p>
        </section>

        <aside className="cms-editor__side">
          <div className="adm-seg cms-sidetabs" role="tablist" aria-label="Article settings">
            <button type="button" role="tab" aria-selected={side === 'details'} className={side === 'details' ? 'is-on' : ''} onClick={() => setSide('details')}>Details</button>
            <button type="button" role="tab" aria-selected={side === 'seo'} className={side === 'seo' ? 'is-on' : ''} onClick={() => setSide('seo')}>SEO <ScoreBadge score={analysis?.score} /></button>
          </div>
          {side === 'seo' ? (
            <SeoPanel form={form} setSeo={set('seo')} analysis={analysis} disabled={!mayEdit || !can(staff, 'content.seo')}
              siteHost={seoContext?.siteOrigin || window.location.origin} />
          ) : (<>
          <section className="adm-card adm-form">
            <h2 className="adm-h3">Publishing</h2>
            <dl className="adm-kv">
              <div><dt>Status</dt><dd>{POST_STATUS[post.status]?.[0]}{live && ' · live on the website'}</dd></div>
              {post.publishedAt && <div><dt>{post.status === 'scheduled' && !live ? 'Goes live' : 'First published'}</dt><dd>{fmtIST(post.publishedAt)}</dd></div>}
              <div><dt>Last updated</dt><dd>{dt(post.contentUpdatedAt)}</dd></div>
            </dl>
            {post.status === 'scheduled' && !live && can(staff, 'content.publish') && (
              <div className="cms-scheduled" role="status">
                <CalendarClock size={16} />
                <span>Goes live on its own at <strong>{fmtIST(post.publishedAt)}</strong>. Edits you make until then are included.</span>
                <div className="adm-actions">
                  <button type="button" className="adm-btn is-ghost is-sm" onClick={() => setDialog('schedule')} disabled={busy}>Change time</button>
                  <button type="button" className="adm-btn is-ghost is-sm" disabled={busy}
                    onClick={() => window.confirm('Cancel the schedule? The article goes back to being a draft.') && status('unpublish', 'Schedule cancelled. The article is a draft again.')}>Cancel schedule</button>
                </div>
              </div>
            )}
            <label className="adm-check"><input type="checkbox" checked={!!form.featured} disabled={!mayEdit} onChange={(e) => set('featured')(e.target.checked)} /> Feature at the top of the Blogs page</label>
          </section>

          <section className="adm-card adm-form">
            <h2 className="adm-h3">Address and summary</h2>
            <label>URL
              <span className="cms-slug"><span className="adm-muted">/blogs/</span><input value={form.slug} maxLength={120} readOnly={!mayEdit}
                onChange={(e) => set('slug')(e.target.value.toLowerCase().replace(/\s+/g, '-'))} aria-invalid={!!slugError} /></span>
            </label>
            {slugError ? <p className="adm-error">{slugError}</p>
              : live && form.slug !== initial.slug && <p className="adm-field-note">The old address will send visitors and search engines to the new one.</p>}
            <label>Summary <small className="adm-muted">(shown on article cards and under the title)</small>
              <textarea rows={3} value={form.excerpt} maxLength={600} readOnly={!mayEdit} onChange={(e) => set('excerpt')(e.target.value)} />
            </label>
            <p className={`adm-field-note ${form.excerpt.length > 200 ? 'is-warn' : ''}`}>{form.excerpt.length} characters · 120 to 200 reads best on cards</p>
          </section>

          <section className="adm-card adm-form">
            <h2 className="adm-h3">Cover photo</h2>
            {form.featuredImage && /^(\/(?!\/)|https:\/\/)/.test(form.featuredImage.trim()) && <img className="cms-cover" src={form.featuredImage.trim()} alt="" />}
            <label>Image address<input value={form.featuredImage} maxLength={2000} readOnly={!mayEdit} placeholder="https://… or /assets/…" onChange={(e) => set('featuredImage')(e.target.value)} /></label>
            <label className={form.featuredImage && !form.featuredImageAlt ? 'is-missing' : ''}>Alt text<input value={form.featuredImageAlt} maxLength={300} readOnly={!mayEdit} placeholder="What the photo shows" onChange={(e) => set('featuredImageAlt')(e.target.value)} /></label>
          </section>

          <section className="adm-card adm-form">
            <h2 className="adm-h3">Organise</h2>
            <label>Category
              <select value={form.categoryId || ''} disabled={!mayEdit} onChange={(e) => set('categoryId')(e.target.value || null)}>
                <option value="">No category</option>
                {choices.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {!cat && <p className="adm-field-note">Articles without a category only show under “All”.</p>}
            <TagInput value={form.tags} options={choices.tags} onChange={set('tags')} disabled={!mayEdit} />
            <label>Byline
              <select value={form.authorId || ''} disabled={!mayEdit} onChange={(e) => set('authorId')(e.target.value || null)}>
                <option value="">None (published by TranzLife)</option>
                {choices.authors.map((a) => <option key={a.id} value={a.id}>{a.name}{a.title ? `, ${a.title}` : ''}</option>)}
              </select>
            </label>
            <label>Related health concern <small className="adm-muted">(shows the concern guide and its products beside the article)</small>
              <select value={form.concern || ''} disabled={!mayEdit} onChange={(e) => set('concern')(e.target.value || null)}>
                <option value="">None</option>
                {choices.concerns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <p className="adm-field-note"><Link to="/admin/blog/categories">Manage categories, tags and bylines</Link></p>
          </section>

          <section className="adm-card adm-form">
            <h2 className="adm-h3">Disclaimer</h2>
            <label>Note at the end of the article <small className="adm-muted">(empty = the standard “not medical advice” note)</small>
              <textarea rows={3} value={form.disclaimer} maxLength={1000} readOnly={!mayEdit} onChange={(e) => set('disclaimer')(e.target.value)} />
            </label>
          </section>
          </>)}
        </aside>
      </div>

      {dialog === 'preview' && <PreviewDialog post={post} onClose={() => setDialog(null)} />}
      {dialog === 'schedule' && <ScheduleDialog post={post} beforeSchedule={beforeSchedule} onDone={scheduled} onClose={() => setDialog(null)} />}
      {dialog === 'history' && (
        <HistoryDialog postId={post.id} current={currentSnapshot} choices={choices} canRestore={mayEdit}
          onRestore={restoreVersion} onClose={() => setDialog(null)} />
      )}
      {dialog === 'delete' && (
        <Modal title="Delete this article?" onClose={() => setDialog(null)} onSubmit={remove}>
          {live ? (
            <p>“{post.title || 'Untitled'}” is live on the website. Unpublish it first, then delete it.</p>
          ) : (
            <>
              <p>“{post.title || 'Untitled'}” and its version history will be deleted for good. This cannot be undone.</p>
              <p className="adm-muted">To hide it but keep it, use Archive instead.</p>
              <div className="adm-actions">
                <button type="button" className="adm-btn is-ghost" onClick={() => setDialog(null)}>Keep it</button>
                <button className="adm-btn is-danger" disabled={busy}>Delete for good</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function SaveState({ save, onReload }) {
  const at = save.at ? new Date(save.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  if (save.state === 'saving') return <span className="cms-save" role="status"><Loader2 size={15} className="cms-spin" /> Saving…</span>;
  if (save.state === 'dirty') return <span className="cms-save" role="status">Unsaved changes</span>;
  if (save.state === 'offline') return <span className="cms-save is-warn" role="status"><CloudOff size={15} /> Can’t reach the server. Retrying…</span>;
  if (save.state === 'invalid') return <span className="cms-save is-bad" role="alert"><AlertTriangle size={15} /> Not saved: {save.error}</span>;
  if (save.state === 'conflict') {
    return (
      <span className="cms-save is-bad" role="alert"><AlertTriangle size={15} /> {save.error}{' '}
        <button type="button" className="adm-link" onClick={() => { if (window.confirm('Reload the latest version? Changes made here since the last save will be lost.')) onReload(); }}>Reload</button>
      </span>
    );
  }
  return <span className="cms-save is-ok" role="status"><Check size={15} /> Saved{at && ` at ${at}`}</span>;
}

function TagInput({ value, options, onChange, disabled }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const t = raw.trim().replace(/,$/, '').trim().slice(0, 40);
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= 20) { setText(''); return; }
    onChange([...value, t]); setText('');
  };
  return (
    <div>
      <label htmlFor="cms-tags">Tags</label>
      <div className="cms-tags">
        {value.map((t) => (
          <span className="adm-chip" key={t}>{t}{!disabled && <button type="button" className="cms-tags__x" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}><X size={13} /></button>}</span>
        ))}
        {!disabled && (
          <input id="cms-tags" value={text} list="cms-tag-options" placeholder={value.length ? 'Add another' : 'e.g. lungs, tulsi'} maxLength={40}
            onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)); }}
            onBlur={() => text && add(text)} />
        )}
      </div>
      <datalist id="cms-tag-options">{options.filter((o) => !value.includes(o)).map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}

function PreviewDialog({ post, onClose }) {
  const [device, setDevice] = useState('desktop');
  const src = useMemo(() => `/blog-preview/${post.id}?v=${encodeURIComponent(post.updatedAt)}`, [post.id, post.updatedAt]);
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <div className="cms-preview" role="dialog" aria-label="Preview">
        <div className="cms-preview__bar">
          <strong>Preview</strong>
          <span className="adm-muted">{post.live ? 'This is how the article looks on the website.' : 'Only you can see this. It is not on the website yet.'}</span>
          <div className="adm-seg" role="radiogroup" aria-label="Screen size">
            <button type="button" className={device === 'desktop' ? 'is-on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={15} /> Desktop</button>
            <button type="button" className={device === 'mobile' ? 'is-on' : ''} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Mobile</button>
          </div>
          <a className="adm-btn is-ghost is-sm" href={src} target="_blank" rel="noreferrer"><ExternalLink size={14} /> New tab</a>
          <button type="button" className="adm-icon" onClick={onClose} aria-label="Close preview"><X size={20} /></button>
        </div>
        <div className={`cms-preview__stage is-${device}`}>
          <iframe title="Article preview" src={src} />
        </div>
      </div>
    </>
  );
}
