// Blog posts (content CMS): every article with its status, category and dates. Phase A of the CMS:
// browsing and checking the imported articles. Writing and editing articles is added in the next phase.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Newspaper, Search } from 'lucide-react';
import { Badge, Empty, ErrorBox, Loading, PageHead, Pager, d, dt, useApi } from '../ui';

export const POST_STATUS = {
  draft: ['Draft', 'warn'], scheduled: ['Scheduled', 'info'], published: ['Published', 'ok'], archived: ['Archived', 'off'],
};
const TABS = [['', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['scheduled', 'Scheduled'], ['archived', 'Archived']];

export default function BlogPosts() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const category = params.get('category') || '';
  const page = params.get('page') || '1';
  const qParam = params.get('q') || '';
  const [q, setQ] = useState(qParam);
  const qs = new URLSearchParams({ page, ...(status ? { status } : {}), ...(category ? { category } : {}), ...(qParam ? { q: qParam } : {}) }).toString();
  const { data, error } = useApi(`/api/admin/cms/posts?${qs}`);
  const cats = useApi('/api/admin/cms/categories');

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n);
  };
  const all = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : null;

  return (
    <>
      <PageHead title="Blog posts" sub="Every article on the website's Blogs page. Only published articles are visible to visitors." />

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

      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className="adm-card is-flush">
          {data.posts.length === 0 ? (
            <Empty icon={Newspaper} title={qParam || status || category ? 'No articles match' : 'No articles yet'}>
              {(qParam || status || category) && <button className="adm-link" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button>}
            </Empty>
          ) : (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Article</th><th>Category</th><th>Status</th><th>Published</th><th>Last edited</th><th /></tr></thead>
                <tbody>{data.posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>{p.featured && <span className="adm-badge is-go">Featured</span>}
                      <small className="adm-sub">/blogs/{p.slug} · {p.readingMinutes} min read</small>
                    </td>
                    <td>{p.category?.name || <span className="adm-muted">None</span>}</td>
                    <td><Badge map={POST_STATUS} value={p.status} /></td>
                    <td>{p.status === 'draft' || p.status === 'archived' ? '—' : d(p.publishedAt)}</td>
                    <td>{dt(p.editedAt)}</td>
                    <td className="adm-rowbtns">
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
    </>
  );
}
