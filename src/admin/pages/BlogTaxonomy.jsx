// Categories, tags and bylines for the blog. Categories are the filters on the Blogs page; tags group related
// articles; bylines are the "By …" names shown on articles (public profiles, not dashboard logins).
import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Empty, ErrorBox, Loading, Notice, PageHead, can, useAction, useAdmin, useApi } from '../ui';

const KINDS = {
  categories: { label: 'Categories', one: 'category', api: '/api/admin/cms/categories', key: 'categories',
    fields: [['name', 'Name', 60, true], ['slug', 'URL name', 80], ['description', 'Description', 300]],
    help: 'Categories are the filter buttons on the Blogs page. Every article can have one.' },
  tags: { label: 'Tags', one: 'tag', api: '/api/admin/cms/tags', key: 'tags',
    fields: [['name', 'Name', 40, true], ['slug', 'URL name', 80]],
    help: 'Tags group related articles across categories (e.g. tulsi, smoking, monsoon). Add them while writing, or here.' },
  authors: { label: 'Bylines', one: 'byline', api: '/api/admin/cms/authors', key: 'authors',
    fields: [['name', 'Name', 80, true], ['title', 'Title (e.g. Nutritionist)', 80], ['bio', 'Short bio', 600], ['avatarUrl', 'Photo address', 2000], ['slug', 'URL name', 80]],
    help: 'A byline shows “By …” on an article and names the author in search results. Use real people only; leave articles without a byline to publish them as TranzLife.' },
};

export default function BlogTaxonomy() {
  const [params, setParams] = useSearchParams();
  const kind = KINDS[params.get('tab')] ? params.get('tab') : 'categories';
  return (
    <>
      <Link to="/admin/blog" className="adm-back"><ArrowLeft size={16} /> All articles</Link>
      <PageHead title="Categories, tags & bylines" sub="How articles are grouped and credited on the website." />
      <div className="adm-tabs" role="tablist" aria-label="What to manage">
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`adm-tab ${kind === k ? 'is-on' : ''}`} onClick={() => setParams({ tab: k })}>{v.label}</button>
        ))}
      </div>
      <Manager key={kind} kind={KINDS[kind]} />
    </>
  );
}

function Manager({ kind }) {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(kind.api);
  const act = useAction();
  const [editing, setEditing] = useState(null);       // id, or 'new'
  const [form, setForm] = useState({});
  const edit = can(staff, 'content.taxonomy');
  const rows = data?.[kind.key] || [];

  const start = (row) => { setEditing(row ? row.id : 'new'); setForm(Object.fromEntries(kind.fields.map(([k]) => [k, row?.[k] ?? '']))); };
  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    const isNew = editing === 'new';
    const r = await act.run(() => api(isNew ? kind.api : `${kind.api}/${editing}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? `Added the ${kind.one}.` : 'Saved.');
    if (r) { setEditing(null); reload(); }
  };
  const remove = async (row) => {
    const n = row.posts || 0;
    const msg = n ? `Delete the ${kind.one} “${row.name}”? ${n} article${n === 1 ? '' : 's'} use${n === 1 ? 's' : ''} it and will keep everything else.` : `Delete the ${kind.one} “${row.name}”?`;
    if (!window.confirm(msg)) return;
    if (await act.run(() => api(`${kind.api}/${row.id}`, { method: 'DELETE' }), `Deleted “${row.name}”.`)) reload();
  };

  const formRow = (
    <tr className="is-picked"><td colSpan={4}>
      <form className="adm-form cms-taxform" onSubmit={save}>
        {kind.fields.map(([k, label, max, required]) => (
          <label key={k}>{label}
            {k === 'bio' || k === 'description'
              ? <textarea rows={2} maxLength={max} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              : <input maxLength={max} required={required} autoFocus={k === 'name'} value={form[k] ?? ''} placeholder={k === 'slug' ? 'Made from the name if empty' : ''}
                onChange={(e) => setForm({ ...form, [k]: k === 'slug' ? e.target.value.toLowerCase().replace(/\s+/g, '-') : e.target.value })} />}
          </label>
        ))}
        <div className="adm-actions">
          <button type="button" className="adm-btn is-ghost" onClick={() => setEditing(null)}><X size={16} /> Cancel</button>
          <button className="adm-btn" disabled={act.busy}><Check size={16} /> Save</button>
        </div>
      </form>
    </td></tr>
  );

  return (
    <section className="adm-card is-flush">
      <div className="adm-card__head adm-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="adm-muted" style={{ flex: '1 1 320px' }}>{kind.help}</p>
        {edit && editing !== 'new' && <button type="button" className="adm-btn is-gold" onClick={() => start(null)}><Plus size={16} /> Add a {kind.one}</button>}
      </div>
      <div className="adm-pad" style={{ paddingTop: 0 }}><ErrorBox>{error || act.error}</ErrorBox><Notice>{act.notice}</Notice></div>
      {!data ? <div className="adm-pad"><Loading /></div> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>URL name</th><th>Articles</th><th /></tr></thead>
            <tbody>
              {editing === 'new' && formRow}
              {rows.length === 0 && editing !== 'new' && <tr><td colSpan={4}><Empty title={`No ${kind.label.toLowerCase()} yet`} /></td></tr>}
              {rows.map((row) => (editing === row.id ? <Fragment key={row.id}>{formRow}</Fragment> : (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong>{(row.title || row.description) && <small className="adm-sub">{row.title || row.description}</small>}</td>
                  <td><code>{row.slug}</code></td>
                  <td>{row.posts}{row.live != null && row.posts > 0 && <small className="adm-sub">{row.live} live</small>}</td>
                  <td className="adm-rowbtns">
                    {edit && <button type="button" className="adm-btn is-ghost is-sm" onClick={() => start(row)}><Pencil size={14} /> Edit</button>}
                    {edit && <button type="button" className="adm-btn is-ghost is-sm is-danger" onClick={() => remove(row)} disabled={act.busy} aria-label={`Delete ${row.name}`}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
