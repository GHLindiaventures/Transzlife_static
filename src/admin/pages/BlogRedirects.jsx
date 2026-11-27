// Redirects: old addresses that send visitors (and search engines) to a new one. Changing a live article's URL
// adds one automatically; others can be added by hand, e.g. for a page of the old website.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Trash2, CornerDownRight } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Empty, ErrorBox, Loading, Notice, PageHead, can, dt, useAction, useAdmin, useApi } from '../ui';

export default function BlogRedirects() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/cms/redirects');
  const act = useAction();
  const [form, setForm] = useState({ fromPath: '', toPath: '', statusCode: 301 });
  const edit = can(staff, 'content.redirects');

  const add = async (e) => {
    e.preventDefault();
    const r = await act.run(() => api('/api/admin/cms/redirects', { method: 'POST', body: form }),
      (res) => `${res.redirect.fromPath} now sends visitors to ${res.redirect.toPath}.`);
    if (r) { setForm({ fromPath: '', toPath: '', statusCode: 301 }); reload(); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Remove the redirect from ${r.fromPath}? Visitors to that address will see “page not found”.`)) return;
    if (await act.run(() => api(`/api/admin/cms/redirects/${r.id}`, { method: 'DELETE' }), 'Redirect removed.')) reload();
  };

  return (
    <>
      <Link to="/admin/blog" className="adm-back"><ArrowLeft size={16} /> All articles</Link>
      <PageHead title="Redirects" sub="Old addresses that forward to a new one, so links and search results keep working." />
      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      {edit && (
        <section className="adm-card">
          <h2 className="adm-h3" style={{ marginTop: 0 }}>Add a redirect</h2>
          <form className="adm-form cms-taxform" onSubmit={add}>
            <label>Old address<input required value={form.fromPath} maxLength={300} placeholder="/old-page-name" onChange={(e) => setForm({ ...form, fromPath: e.target.value.trim() })} /></label>
            <label>New address<input required value={form.toPath} maxLength={300} placeholder="/blogs/new-article" onChange={(e) => setForm({ ...form, toPath: e.target.value.trim() })} /></label>
            <label>Type
              <select value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}>
                <option value={301}>Permanent (301): moved for good</option>
                <option value={302}>Temporary (302): coming back</option>
              </select>
            </label>
            <div className="adm-actions"><button className="adm-btn" disabled={act.busy}><Plus size={16} /> Add redirect</button></div>
          </form>
          <p className="adm-field-note">Use addresses on this site, starting with /. If the new address is itself redirected, the redirect goes straight to the final page, so visitors never hop twice.</p>
        </section>
      )}

      <section className="adm-card is-flush" style={{ marginTop: 'var(--s-4)' }}>
        {!data ? <div className="adm-pad"><Loading /></div> : data.redirects.length === 0 ? (
          <Empty icon={CornerDownRight} title="No redirects yet">Changing the URL of a live article adds one here automatically.</Empty>
        ) : (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead><tr><th>Old address</th><th /><th>New address</th><th>Type</th><th>Used</th><th>Added</th><th /></tr></thead>
              <tbody>{data.redirects.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.fromPath}</code>{r.automatic && <small className="adm-sub">Automatic: “{r.postTitle}” moved</small>}</td>
                  <td aria-hidden="true"><ArrowRight size={15} /></td>
                  <td><a href={r.toPath} target="_blank" rel="noreferrer"><code>{r.toPath}</code></a></td>
                  <td>{r.statusCode === 301 ? 'Permanent' : 'Temporary'}</td>
                  <td>{r.hits.toLocaleString('en-IN')}{r.lastHitAt && <small className="adm-sub">last {dt(r.lastHitAt)}</small>}</td>
                  <td>{dt(r.createdAt)}{r.createdBy && <small className="adm-sub">{r.createdBy}</small>}</td>
                  <td className="adm-rowbtns">{edit && <button type="button" className="adm-btn is-ghost is-sm is-danger" onClick={() => remove(r)} disabled={act.busy} aria-label={`Remove redirect from ${r.fromPath}`}><Trash2 size={14} /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
