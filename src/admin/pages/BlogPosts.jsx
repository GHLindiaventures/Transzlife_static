// Blog posts: every article with its status, category and dates. Search and filter, start a new article,
// open one to edit, duplicate, and act on several at once (publish, unpublish, archive, move, delete).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, FolderTree, Newspaper, Plus, Search } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, Empty, ErrorBox, Loading, Notice, PageHead, Pager, can, d, dt, useAction, useAdmin, useApi } from '../ui';

export const POST_STATUS = {
  draft: ['Draft', 'warn'], scheduled: ['Scheduled', 'info'], published: ['Published', 'ok'], archived: ['Archived', 'off'],
};
const TABS = [['', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['scheduled', 'Scheduled'], ['archived', 'Archived']];
const BULK = { publish: 'Publish', unpublish: 'Unpublish', archive: 'Archive', restore: 'Restore', delete: 'Delete' };

export default function BlogPosts() {
  const { staff } = useAdmin();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const category = params.get('category') || '';
  const page = params.get('page') || '1';
  const qParam = params.get('q') || '';
  const [q, setQ] = useState(qParam);
  const [picked, setPicked] = useState(() => new Set());
  const qs = new URLSearchParams({ page, ...(status ? { status } : {}), ...(category ? { category } : {}), ...(qParam ? { q: qParam } : {}) }).toString();
  const { data, error, reload } = useApi(`/api/admin/cms/posts?${qs}`);
  const cats = useApi('/api/admin/cms/categories');
  const act = useAction();
  const mayEdit = can(staff, 'content.edit');

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n);
    setPicked(new Set());
  };
  const all = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : null;
  const rows = data?.posts || [];
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((p) => picked.has(p.id));

  const create = async () => {
    const r = await act.run(() => api('/api/admin/cms/posts', { method: 'POST', body: {} }));
    if (r) navigate(`/admin/blog/${r.post.id}`);
  };
  const duplicate = async (p) => {
    const r = await act.run(() => api(`/api/admin/cms/posts/${p.id}/duplicate`, { method: 'POST', body: {} }));
    if (r) navigate(`/admin/blog/${r.post.id}`);
  };
  const bulk = async (action, categoryId) => {
    const n = picked.size;
    if (action === 'delete' && !window.confirm(`Delete ${n} article${n === 1 ? '' : 's'} for good? This cannot be undone. Published articles are skipped: unpublish them first.`)) return;
    if (action === 'publish' && !window.confirm(`Publish ${n} article${n === 1 ? '' : 's'} on the website now?`)) return;
    const r = await act.run(() => api('/api/admin/cms/posts/bulk', { method: 'POST', body: { ids: [...picked], action, ...(action === 'category' ? { categoryId: categoryId || null } : {}) } }),
      (res) => `${res.done} article${res.done === 1 ? '' : 's'} updated.${res.skipped.length ? ` ${res.skipped.length} skipped: ${res.skipped.map((s) => `“${s.title}” (${s.reason})`).join('; ')}` : ''}`);
    if (r) { setPicked(new Set()); reload(); cats.reload(); }
  };

  return (
    <>
      <PageHead title="Blog posts" sub="Every article on the website's Blogs page. Only published articles are visible to visitors.">
        <Link className="adm-btn is-ghost" to="/admin/blog/categories"><FolderTree size={16} /> Categories & tags</Link>
        {mayEdit && <button type="button" className="adm-btn is-gold" onClick={create} disabled={act.busy}><Plus size={16} /> New article</button>}
      </PageHead>

      <div className="adm-tabs" role="tablist" aria-label="Article status">
        {TABS.map(([k, label]) => (
          <button key={k || 'all'} role="tab" aria-selected={status === k} className={`adm-tab ${status === k ? 'is-on' : ''}`} onClick={() => setParam('status', k)}>
            {label} <b>{data ? (k ? data.counts[k] : all) : '…'}</b>
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }} role="search">
          <Search size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or URL" aria-label="Search articles" />
        </form>
        <select value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {(cats.data?.categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.posts})</option>)}
        </select>
      </div>

      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>
      {!data ? <Loading /> : (
        <section className="adm-card is-flush">
          {rows.length === 0 ? (
            <Empty icon={Newspaper} title={qParam || status || category ? 'No articles match' : 'No articles yet'}>
              {(qParam || status || category) ? <button className="adm-link" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button>
                : mayEdit && <button className="adm-link" onClick={create}>Write the first article</button>}
            </Empty>
          ) : (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr>
                  {mayEdit && <th style={{ width: 36 }}><input type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((p) => p.id)))} /></th>}
                  <th>Article</th><th>Category</th><th>Status</th><th>Published</th><th>Last edited</th><th />
                </tr></thead>
                <tbody>{rows.map((p) => (
                  <tr key={p.id} className={picked.has(p.id) ? 'is-picked' : ''}>
                    {mayEdit && <td><input type="checkbox" aria-label={`Select ${p.title || 'untitled article'}`} checked={picked.has(p.id)} onChange={() => toggle(p.id)} /></td>}
                    <td>
                      <Link to={`/admin/blog/${p.id}`}><strong>{p.title || 'Untitled draft'}</strong></Link>
                      {p.featured && <span className="adm-badge is-go">Featured</span>}
                      <small className="adm-sub">/blogs/{p.slug} · {p.readingMinutes} min read</small>
                    </td>
                    <td>{p.category?.name || <span className="adm-muted">None</span>}</td>
                    <td><Badge map={POST_STATUS} value={p.status} /></td>
                    <td>{p.status === 'draft' || !p.publishedAt ? '—' : d(p.publishedAt)}</td>
                    <td>{dt(p.editedAt)}</td>
                    <td className="adm-rowbtns">
                      {mayEdit && <button type="button" className="adm-btn is-ghost is-sm" onClick={() => duplicate(p)} disabled={act.busy} aria-label={`Duplicate ${p.title}`}><Copy size={14} /> Duplicate</button>}
                      {p.status === 'published' && (
                        <a className="adm-btn is-ghost is-sm" href={`/blogs/${p.slug}`} target="_blank" rel="noreferrer" aria-label={`View ${p.title} on the website`}><ExternalLink size={14} /> View</a>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(n) => setParam('page', String(n))} />
        </section>
      )}

      {picked.size > 0 && (
        <div className="adm-bulk" role="region" aria-label="Selected articles">
          <strong>{picked.size} selected</strong>
          {Object.entries(BULK).filter(([k]) => (k === 'publish' || k === 'unpublish' ? can(staff, 'content.publish') : k === 'delete' ? can(staff, 'content.delete') : true))
            .map(([k, label]) => <button key={k} type="button" className={`adm-btn is-sm ${k === 'delete' ? 'is-danger' : 'is-ghost'}`} disabled={act.busy} onClick={() => bulk(k)}>{label}</button>)}
          <select aria-label="Move to category" value="" disabled={act.busy} onChange={(e) => e.target.value && bulk('category', e.target.value === 'none' ? null : e.target.value)}>
            <option value="">Move to category…</option>
            <option value="none">No category</option>
            {(cats.data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="adm-btn is-ghost is-sm" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
    </>
  );
}
