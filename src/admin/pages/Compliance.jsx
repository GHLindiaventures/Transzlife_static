// Licences & certificates: what the business holds, when each expires, and the document itself
// (stored privately; only signed-in staff can open it). Reminders appear 60 days before expiry.
import { useEffect, useRef, useState } from 'react';
import { Plus, X, FileText, Upload, ShieldCheck, Eye } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Empty, ErrorBox, Loading, Notice, PageHead, can, d, useAction, useAdmin, useApi } from '../ui';

const STATUS = { valid: ['Valid', 'ok'], expiring: ['Expires soon', 'warn'], expired: ['Expired', 'bad'], no_expiry: ['No expiry', 'muted'] };
const SUGGEST = ['AYUSH manufacturing licence', 'GMP certificate', 'ISO 9001:2015', 'FSSAI licence', 'GST registration', 'DPIIT recognition', 'Trade mark registration', 'Lab test report (COA)'];

export default function Compliance() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/certificates');
  const products = useApi('/api/admin/products');
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const act = useAction();
  const fileRefs = useRef({});
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const counts = { all: data.certificates.length };
  for (const c of data.certificates) counts[c.status] = (counts[c.status] || 0) + 1;
  const list = data.certificates.filter((c) => filter === 'all' || c.status === filter);
  const names = Object.fromEntries((products.data?.products || []).map((p) => [p.id, p.name]));

  const upload = async (c, file) => {
    if (!file) return;
    act.setError(''); act.setNotice('');
    const res = await fetch(`/api/admin/certificates/${c.id}/document`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type, 'X-File-Name': file.name.replace(/[^\w.\- ]+/g, '') }, body: file });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) act.setError(body.error || 'Upload failed.'); else { act.setNotice(`Document uploaded for ${c.name}.`); reload(); }
  };

  return (
    <>
      <PageHead title="Licences & certificates" sub="Everything the business holds, with expiry reminders 60 days ahead. Documents are private to staff.">
        {can(staff, 'products.edit') && <button className="adm-btn" onClick={() => setOpen('new')}><Plus size={16} /> Add</button>}
      </PageHead>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      <div className="adm-chips" role="group" aria-label="Status">
        {[['all', 'All'], ['expired', 'Expired'], ['expiring', 'Expires soon'], ['valid', 'Valid'], ['no_expiry', 'No expiry']].map(([k, l]) => (
          <button key={k} className={`adm-chip ${filter === k ? 'is-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <b>{counts[k] || 0}</b></button>
        ))}
      </div>
      <section className="adm-card is-flush">
        {list.length === 0 ? (
          <Empty icon={ShieldCheck} title={data.certificates.length ? 'Nothing here' : 'No licences or certificates yet'}>{!data.certificates.length && 'Add your AYUSH licence, GMP and ISO certificates to get reminders before they expire.'}</Empty>
        ) : (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Applies to</th><th>Issued</th><th>Expires</th><th>Document</th><th /></tr></thead>
              <tbody>{list.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><span className="adm-sub">{[data.kinds[c.kind], c.number, c.issuer].filter(Boolean).join(' · ')}</span></td>
                  <td>{c.products.length ? c.products.map((p) => names[p] || p).join(', ') : <span className="adm-muted">Whole company</span>}</td>
                  <td>{d(c.issuedOn)}</td>
                  <td>{c.expiresOn ? d(c.expiresOn) : '—'}<span className="adm-sub"><span className={`adm-badge is-${STATUS[c.status][1]}`}>{c.status === 'expiring' ? `${c.daysLeft} days left` : c.status === 'expired' ? `Expired ${-c.daysLeft} days ago` : STATUS[c.status][0]}</span></span></td>
                  <td>
                    {c.document ? <a className="adm-link" href={`/api/admin/certificates/${c.id}/document`} target="_blank" rel="noreferrer"><Eye size={14} /> {c.document.name.length > 22 ? `${c.document.name.slice(0, 20)}…` : c.document.name}</a> : <span className="adm-muted">None</span>}
                    {can(staff, 'products.edit') && <>
                      <button className="adm-link" style={{ display: 'flex', marginTop: 4, fontSize: 12.5 }} onClick={() => fileRefs.current[c.id]?.click()}><Upload size={13} /> {c.document ? 'Replace' : 'Upload'}</button>
                      <input ref={(el) => { fileRefs.current[c.id] = el; }} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(e) => { upload(c, e.target.files[0]); e.target.value = ''; }} />
                    </>}
                  </td>
                  <td className="adm-rowbtns">{can(staff, 'products.edit') && <button className="adm-btn is-ghost is-sm" onClick={() => setOpen(c.id)}>Edit</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {open && <CertDrawer id={open} item={data.certificates.find((c) => c.id === open)} kinds={data.kinds} products={products.data?.products || []} canDelete={can(staff, 'settings')} onClose={() => setOpen(null)} onSaved={() => { reload(); setOpen(null); }} />}
    </>
  );
}

function CertDrawer({ id, item, kinds, products, canDelete, onClose, onSaved }) {
  const isNew = id === 'new';
  const act = useAction();
  const iso = (v) => (v ? String(v).slice(0, 10) : '');
  const [f, setF] = useState(() => ({ name: item?.name || '', kind: item?.kind || 'licence', issuer: item?.issuer || '', number: item?.number || '', issuedOn: iso(item?.issuedOn), expiresOn: iso(item?.expiresOn), products: item?.products || [], notes: item?.notes || '' }));
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (pid) => setF((x) => ({ ...x, products: x.products.includes(pid) ? x.products.filter((p) => p !== pid) : [...x.products, pid] }));
  const save = async (e) => {
    e.preventDefault();
    const body = { ...f, issuedOn: f.issuedOn || null, expiresOn: f.expiresOn || null };
    if (await act.run(() => (isNew ? api('/api/admin/certificates', { method: 'POST', body }) : api(`/api/admin/certificates/${id}`, { method: 'PATCH', body })))) onSaved();
  };
  const remove = async () => { if (window.confirm(`Delete ${item.name} and its document?`) && await act.run(() => api(`/api/admin/certificates/${id}`, { method: 'DELETE', body: {} }))) onSaved(); };
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label={isNew ? 'Add licence or certificate' : `Edit ${item?.name}`}>
        <div className="adm-drawer__head"><div style={{ flex: 1 }}><p className="adm-eyebrow">Compliance</p><h2>{isNew ? 'Add licence or certificate' : item?.name}</h2></div><button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <form className="adm-drawer__body" onSubmit={save}>
          <ErrorBox>{act.error}</ErrorBox>
          <div className="adm-card adm-form" style={{ margin: 0 }}>
            <label>Name<input value={f.name} onChange={set('name')} required minLength={2} maxLength={120} list="adm-cert-names" autoFocus={isNew} placeholder="e.g. AYUSH manufacturing licence" /></label>
            <datalist id="adm-cert-names">{SUGGEST.map((s) => <option key={s}>{s}</option>)}</datalist>
            <div className="adm-pair">
              <label>Type<select value={f.kind} onChange={set('kind')}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Number<input value={f.number} onChange={set('number')} maxLength={80} placeholder="Licence / certificate no." /></label>
            </div>
            <label>Issued by<input value={f.issuer} onChange={set('issuer')} maxLength={160} placeholder="e.g. Directorate of Indian Medicine, Tamil Nadu" /></label>
            <div className="adm-pair">
              <label>Issued on<input type="date" value={f.issuedOn} onChange={set('issuedOn')} /></label>
              <label>Expires on<span className="adm-sub">Leave empty if it doesn't expire</span><input type="date" value={f.expiresOn} onChange={set('expiresOn')} /></label>
            </div>
            <div>
              <span className="adm-listfield__label">Applies to</span>
              <p className="adm-muted" style={{ margin: '2px 0 8px' }}>Leave all unticked if it covers the whole company.</p>
              <div className="adm-chips">{products.map((p) => <button type="button" key={p.id} className={`adm-chip ${f.products.includes(p.id) ? 'is-on' : ''}`} aria-pressed={f.products.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</button>)}</div>
            </div>
            <label>Notes<textarea rows={3} maxLength={1000} value={f.notes} onChange={set('notes')} placeholder="e.g. Renewal: apply 90 days before expiry" /></label>
          </div>
          {!isNew && <p className="adm-muted"><FileText size={14} style={{ verticalAlign: '-2px' }} /> Upload or replace the document from the list.</p>}
          <div className="adm-actions">
            <button className="adm-btn" disabled={act.busy}>{isNew ? 'Add' : 'Save changes'}</button>
            {!isNew && canDelete && <button type="button" className="adm-btn is-danger is-ghost" onClick={remove}>Delete</button>}
          </div>
        </form>
      </aside>
    </>
  );
}
