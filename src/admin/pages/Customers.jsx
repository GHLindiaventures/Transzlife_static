// Customers: segments (new / repeat / loyal / at risk / signed up), lifetime value, full profile and notes.
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Users, StickyNote, Trash2, Heart, MapPin, MessageSquare, Undo2, Phone, Mail } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, Empty, ErrorBox, Loading, METHOD, Notice, PageHead, Pager, can, d, dt, initials, rs, rsCompact, useAction, useAdmin, useApi } from '../ui';
import { RSTATUS } from './Returns';

export const SEGMENTS = {
  loyal: ['Loyal', 'go', '3 or more orders'], repeat: ['Repeat', 'ok', '2 orders'], new: ['New', 'info', 'First order'],
  at_risk: ['At risk', 'warn', 'No order in 60+ days'], prospect: ['Signed up', 'off', 'No order yet'],
};
const SEG_ORDER = ['all', 'loyal', 'repeat', 'new', 'at_risk', 'prospect'];
const ago = (iso) => { if (!iso) return '—'; const n = Math.floor((Date.now() - new Date(iso)) / 86400000); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`; };

export function CustomerList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '', page = params.get('page') || '1', segment = params.get('segment') || 'all', sort = params.get('sort') || 'joined';
  const { data, error, loading } = useApi(`/api/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page, segment, sort })}`);
  const [term, setTerm] = useState(q);
  const set = (k, v) => { const n = new URLSearchParams(params); if (v && v !== 'all') n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  return (
    <>
      <PageHead title="Customers" sub="Who buys, how often, and who might need a nudge." />
      <div className="adm-chips" role="group" aria-label="Segments">
        {SEG_ORDER.map((k) => (
          <button key={k} className={`adm-chip ${segment === k ? 'is-on' : ''}`} aria-pressed={segment === k} onClick={() => set('segment', k)} title={SEGMENTS[k]?.[2]}>
            {k === 'all' ? 'All' : SEGMENTS[k][0]} <b>{data?.counts?.[k] ?? 0}</b>
          </button>
        ))}
      </div>
      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); set('q', term.trim()); }}><Search size={16} /><input type="search" placeholder="Name, phone or email" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search customers" /></form>
        <select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="joined">Newest first</option><option value="ltv">Highest spend</option><option value="orders">Most orders</option><option value="recent">Ordered recently</option>
        </select>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className={`adm-card is-flush ${loading ? 'is-loading' : ''}`}>
          {data.rows.length === 0 ? <Empty icon={Users} title="No customers here" /> : (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Customer</th><th>Segment</th><th className="num">Orders</th><th className="num">Lifetime value</th><th>Last order</th><th data-hide-sm>City</th></tr></thead>
                <tbody>{data.rows.map((c) => (
                  <tr key={c.id} className="is-click" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td><span className="adm-prow"><span className="adm-avatar is-sm" aria-hidden="true">{initials(c.name)}</span><span><strong>{c.name}</strong><span className="adm-sub">+91 {c.phone}</span></span></span></td>
                    <td><Badge map={SEGMENTS} value={c.segment} /></td>
                    <td className="num">{c.orders}</td>
                    <td className="num"><strong>{rs(c.spent)}</strong></td>
                    <td>{c.last_order ? ago(c.last_order) : <span className="adm-muted">Never</span>}</td>
                    <td data-hide-sm>{c.city || <span className="adm-muted">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => set('page', String(p))} />
        </section>
      )}
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/customers/${id}`);
  const act = useAction();
  const [note, setNote] = useState('');
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const { customer: c, stats: s, segment } = data;

  const addNote = async (e) => {
    e.preventDefault();
    if (await act.run(() => api(`/api/admin/customers/${c.id}/notes`, { method: 'POST', body: { body: note } }), 'Note added.')) { setNote(''); reload(); }
  };
  const removeNote = async (n) => { if (window.confirm('Remove this note?') && await act.run(() => api(`/api/admin/customers/${c.id}/notes/${n.id}`, { method: 'DELETE', body: {} }))) reload(); };
  const remove = async () => {
    const typed = window.prompt(`This permanently removes ${c.name}'s name, email, phone and saved addresses (their orders stay for tax records). Type DELETE to confirm.`);
    if (typed !== 'DELETE') return;
    if (await act.run(() => api(`/api/admin/customers/${c.id}/delete`, { method: 'POST', body: {} }), 'Personal data deleted.')) reload();
  };

  return (
    <>
      <Link to="/admin/customers" className="adm-link adm-back"><ArrowLeft size={15} /> Customers</Link>
      <div className="adm-head">
        <div className="adm-ehead">
          <span className="adm-avatar is-lg" aria-hidden="true">{initials(c.name)}</span>
          <div>
            <h1>{c.name || '(no name yet)'} <Badge map={SEGMENTS} value={segment} /></h1>
            <p className="adm-muted">{c.deleted_at ? `Personal data deleted ${dt(c.deleted_at)}` : <>Customer since {d(c.created_at)} · last signed in {ago(c.last_login_at)}</>}</p>
          </div>
        </div>
        <div className="adm-head__actions">
          {!c.deleted_at && <a className="adm-btn is-ghost" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer"><MessageSquare size={15} /> WhatsApp</a>}
          {!c.deleted_at && <a className="adm-btn is-ghost" href={`tel:+91${c.phone}`}><Phone size={15} /> Call</a>}
          {can(staff, 'customers.edit') && !c.deleted_at && <button className="adm-btn is-danger is-ghost" disabled={act.busy} onClick={remove}>Delete personal data</button>}
        </div>
      </div>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>

      <div className="adm-kpis">
        <div className="adm-kpi"><span className="adm-eyebrow">Lifetime value</span><strong title={rs(s.spent)}>{rsCompact(s.spent)}</strong><span className="adm-kpi__foot">{s.refunded ? `${rs(s.refunded)} refunded` : 'No refunds'}</span></div>
        <div className="adm-kpi"><span className="adm-eyebrow">Orders</span><strong>{s.orders}</strong><span className="adm-kpi__foot">{s.returns ? `${s.returns} return(s)` : 'No returns'}</span></div>
        <div className="adm-kpi"><span className="adm-eyebrow">Average order</span><strong>{rsCompact(s.aov)}</strong><span className="adm-kpi__foot">{s.first_order ? `First order ${d(s.first_order)}` : 'No orders yet'}</span></div>
        <div className="adm-kpi"><span className="adm-eyebrow">Last order</span><strong style={{ fontSize: 22 }}>{s.last_order ? ago(s.last_order) : '—'}</strong><span className="adm-kpi__foot">{SEGMENTS[segment][2]}</span></div>
      </div>

      <div className="adm-grid2 is-wide-left">
        <div className="adm-stack" style={{ marginBottom: 0 }}>
          <section className="adm-card is-flush">
            <div className="adm-pad" style={{ paddingBottom: 0 }}><h2 className="adm-h2">Orders</h2></div>
            {data.orders.length === 0 ? <p className="adm-muted adm-pad">No orders yet.</p> : (
              <div className="adm-tablewrap">
                <table className="adm-table">
                  <thead><tr><th>Order</th><th>Placed</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
                  <tbody>{data.orders.map((o) => (
                    <tr key={o.order_number}><td><Link to={`/admin/orders/${o.order_number}`}><strong>{o.order_number}</strong></Link><span className="adm-sub">{o.items} item(s)</span></td><td>{dt(o.created_at)}</td><td>{METHOD[o.payment_method]}</td><td><Badge value={o.status} /></td><td className="num">{rs(o.total)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          {data.returns.length > 0 && (
            <section className="adm-card">
              <h2 className="adm-h2"><Undo2 size={16} /> Returns</h2>
              <ul className="adm-list">{data.returns.map((r) => (
                <li key={r.id} className="adm-row"><span><Link to={`/admin/returns?id=${r.id}`}>{r.return_number}</Link> · order {r.order_number}<span className="adm-sub">{dt(r.created_at)}</span></span><Badge map={RSTATUS} value={r.status} /></li>
              ))}</ul>
            </section>
          )}
          <section className="adm-card">
            <h2 className="adm-h2"><StickyNote size={16} /> Notes</h2>
            {can(staff, 'orders.note') && !c.deleted_at && (
              <form className="adm-form" onSubmit={addNote} style={{ marginBottom: 14 }}>
                <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Prefers WhatsApp, call after 6 pm, allergic to…" aria-label="New note" />
                <div><button className="adm-btn is-sm" disabled={act.busy || note.trim().length < 2}>Add note</button></div>
              </form>
            )}
            {data.notes.length === 0 ? <p className="adm-muted">No notes yet.</p> : (
              <ol className="adm-timeline">{data.notes.map((n) => (
                <li key={n.id}>
                  <span className="adm-muted">{dt(n.created_at)} · {n.staff_email || 'staff'}</span>
                  {(staff.role === 'owner' || n.staff_email === staff.email) && <button className="adm-icon" style={{ display: 'inline-grid', padding: 4, marginLeft: 4 }} onClick={() => removeNote(n)} aria-label="Remove note"><Trash2 size={13} /></button>}
                  <p style={{ whiteSpace: 'pre-line' }}>{n.body}</p>
                </li>
              ))}</ol>
            )}
          </section>
        </div>

        <div className="adm-stack" style={{ marginBottom: 0 }}>
          <section className="adm-card">
            <h2 className="adm-h2">Contact</h2>
            {c.deleted_at ? <p className="adm-muted">Deleted</p> : (
              <ul className="adm-list">
                <li><Phone size={14} /> +91 {c.phone}</li>
                <li><Mail size={14} /> {c.email || <span className="adm-muted">No email</span>}</li>
                {s.city && <li><MapPin size={14} /> {s.city}</li>}
              </ul>
            )}
          </section>
          {data.favourites.length > 0 && (
            <section className="adm-card">
              <h2 className="adm-h2"><Heart size={16} /> Favourite products</h2>
              <ul className="adm-list">{data.favourites.map((f) => <li key={f.id} className="adm-row"><Link to={`/admin/products/${f.id}`}>{f.name}</Link><span className="adm-muted">{f.units} bought</span></li>)}</ul>
            </section>
          )}
          <section className="adm-card">
            <h2 className="adm-h2"><MapPin size={16} /> Saved addresses</h2>
            {data.addresses.length === 0 ? <p className="adm-muted">None.</p> : (
              <ul className="adm-list">{data.addresses.map((a, i) => (
                <li key={i}><strong>{a.name}</strong>{a.is_default && <span className="adm-badge is-info" style={{ marginLeft: 6 }}>Default</span>}<span className="adm-sub">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pin} · {a.phone}</span></li>
              ))}</ul>
            )}
          </section>
          {data.messages.length > 0 && (
            <section className="adm-card">
              <h2 className="adm-h2"><MessageSquare size={16} /> Messages sent</h2>
              <ul className="adm-list">{data.messages.map((m, i) => (
                <li key={i}><Badge map={{ sent: ['Sent', 'ok'], failed: ['Failed', 'bad'], sending: ['Sending', 'warn'] }} value={m.status} /> {m.event.replace(/_/g, ' ')} · {m.order_number}<span className="adm-sub">{m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} · {dt(m.created_at)}</span></li>
              ))}</ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
