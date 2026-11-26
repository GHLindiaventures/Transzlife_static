// Returns: log a return when a customer asks, record what came back and in what condition
// (resellable units go back on sale), then refund, replace, or close.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Undo2, X, PackageCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, Empty, ErrorBox, Loading, Notice, PageHead, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

export const RSTATUS = {
  requested: ['Requested', 'warn'], under_review: ['Under review', 'info'], approved: ['Approved', 'info'], pickup_scheduled: ['Pickup scheduled', 'info'],
  received: ['Returned: decide', 'warn'], refund_initiated: ['Refund initiated', 'warn'], resolved: ['Completed', 'ok'], rejected: ['Rejected', 'off'],
};
const BEFORE = ['requested', 'under_review', 'approved', 'pickup_scheduled'];
const RESOLUTION = { refund: 'Refunded', replacement: 'Replacement sent', no_action: 'Closed, no action' };
const TABS = [['open', 'Open'], ['requested', 'Requested'], ['under_review', 'Under review'], ['approved', 'Approved'], ['pickup_scheduled', 'Pickup'], ['received', 'Returned'], ['refund_initiated', 'Refund'], ['resolved', 'Completed'], ['rejected', 'Rejected'], ['all', 'All']];

export default function Returns() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'open';
  const { data, error, loading, reload } = useApi(`/api/admin/returns?status=${status}`);
  const counts = useApi('/api/admin/returns/counts');
  const [open, setOpen] = useState(params.get('id'));
  const refresh = () => { reload(); counts.reload(); };
  const c = counts.data?.counts || {};

  return (
    <>
      <PageHead title="Returns" sub="Customers request returns from their account. Review, approve, schedule the pickup, check what comes back, then refund or replace." />
      <div className="adm-tabs" role="tablist">
        {TABS.map(([k, label]) => {
          const n = k === 'all' ? null : c[k];
          return <button key={k} role="tab" aria-selected={status === k} className={`adm-tab ${status === k ? 'is-on' : ''} ${k === 'received' && n > 0 ? 'is-hot' : ''}`} onClick={() => setParams(k === 'open' ? {} : { status: k })}>{label}{n != null && <b>{n}</b>}</button>;
        })}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className={`adm-card is-flush ${loading ? 'is-loading' : ''}`}>
          {data.rows.length === 0 ? (
            <Empty icon={Undo2} title={status === 'open' ? 'No open returns' : 'Nothing here'}>To start a return, open a delivered order and choose "Start a return".</Empty>
          ) : (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Return</th><th>Order</th><th>Customer</th><th data-hide-sm>Items</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>{data.rows.map((r) => (
                  <tr key={r.id} className="is-click" onClick={() => setOpen(r.id)}>
                    <td className="adm-ordercell"><strong>{r.return_number}</strong><span className="adm-sub">{dt(r.created_at)}</span></td>
                    <td><Link to={`/admin/orders/${r.order_number}`} onClick={(e) => e.stopPropagation()}>{r.order_number}</Link></td>
                    <td>{r.customer}<span className="adm-sub">+91 {r.phone}</span></td>
                    <td data-hide-sm><span className="adm-clamp" title={r.products}>{r.packs} · {r.products}</span></td>
                    <td>{data.reasons[r.reason] || r.reason}</td>
                    <td><Badge map={RSTATUS} value={r.status} />{r.resolution && <span className="adm-sub">{RESOLUTION[r.resolution]}{r.refund_amount ? ` · ${rs(r.refund_amount)}` : ''}</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {open && <ReturnDrawer id={open} onClose={() => { setOpen(null); if (params.get('id')) { const n = new URLSearchParams(params); n.delete('id'); setParams(n); } }} onChanged={refresh} />}
    </>
  );
}

function ReturnDrawer({ id, onClose, onChanged }) {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/returns/${id}`);
  const act = useAction();
  const [cond, setCond] = useState({});
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [rejecting, setRejecting] = useState(false);
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  useEffect(() => { if (data) { setAmount(String(data.suggestedRefund / 100)); setCond(Object.fromEntries(data.items.map((i) => [i.id, i.condition || 'resellable']))); } }, [data]);
  const done = () => { reload(); onChanged(); };
  const r = data?.ret;
  const editable = can(staff, 'orders.edit');

  const receive = async () => {
    const res = await act.run(() => api(`/api/admin/returns/${id}/receive`, { method: 'POST', body: { items: data.items.map((i) => ({ id: i.id, condition: cond[i.id] })), note } }),
      (x) => `Received. ${x.restocked} unit(s) back in stock${x.orderReturned ? '; the whole order is now marked returned' : ''}.`);
    if (res) { setNote(''); done(); }
  };
  const resolve = async (resolution) => {
    const body = { resolution, note };
    if (resolution === 'refund') {
      body.amount = toPaise(amount);
      if (!window.confirm(`Refund ${rs(body.amount)} for ${r.return_number}?${r.payment_method === 'cod' ? ' (Record only: pay the customer back by hand.)' : ' Razorpay will send it back to the customer.'}`)) return;
    }
    const res = await act.run(() => api(`/api/admin/returns/${id}/resolve`, { method: 'POST', body }), (x) => (x.refund ? `Refund of ${rs(x.refund.amount)} ${x.refund.method === 'razorpay' ? 'sent through Razorpay' : 'recorded'}. Return closed.` : 'Return closed.'));
    if (res) done();
  };
  const reject = async () => { const res = await act.run(() => api(`/api/admin/returns/${id}/reject`, { method: 'POST', body: { note } }), 'Return rejected.'); if (res) { setRejecting(false); done(); } };
  const step = !r ? 0 : BEFORE.includes(r.status) ? 1 : r.status === 'received' ? 2 : 3;
  const [pickup, setPickup] = useState('');
  const advance = async (to) => {
    const res = await act.run(() => api(`/api/admin/returns/${id}/advance`, { method: 'POST', body: { to, note, ...(to === 'pickup_scheduled' ? { pickupAt: pickup } : {}) } }), 'Updated. The customer sees the new status.');
    if (res) { setNote(''); done(); }
  };
  const refundDone = async () => { const res = await act.run(() => api(`/api/admin/returns/${id}/refund-complete`, { method: 'POST', body: {} }), 'Refund marked as completed.'); if (res) done(); };

  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Return">
        <div className="adm-drawer__head">
          <div style={{ flex: 1 }}><p className="adm-eyebrow">Return</p><h2>{r?.return_number || '…'}</h2></div>
          {r && <Badge map={RSTATUS} value={r.status} />}
          <button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="adm-drawer__body">
          <ErrorBox>{error || act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {!data ? <Loading /> : (
            <>
              <div className={`adm-stepper ${r.status === 'rejected' ? 'is-stopped' : ''}`} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {['Requested & approved', 'Returned & checked', 'Refund / closed'].map((l, i) => <span key={l} className={`adm-step ${step > i ? 'is-done' : ''}`}>{l}</span>)}
              </div>
              <div className="adm-card">
                <dl className="adm-kv">
                  <dt>Order</dt><dd><Link to={`/admin/orders/${r.order_number}`}>{r.order_number}</Link> · {r.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'}</dd>
                  <dt>Customer</dt><dd><Link to={`/admin/customers/${r.customer_id}`}>{r.customer}</Link> · +91 {r.phone}</dd>
                  <dt>Reason</dt><dd>{data.reasons[r.reason]}{r.reason_note ? `: ${r.reason_note}` : ''}</dd>
                  <dt>Logged</dt><dd>{dt(r.created_at)}{r.created_by_email ? ` by ${r.created_by_email}` : r.source === 'customer' ? ' by the customer' : ''}</dd>
                  {r.pickup_at && <><dt>Pickup</dt><dd>{dt(r.pickup_at)}{r.pickup_note ? ` · ${r.pickup_note}` : ''}</dd></>}
                  {r.reject_reason && <><dt>Rejected because</dt><dd>{r.reject_reason}</dd></>}
                  {r.received_at && <><dt>Received</dt><dd>{dt(r.received_at)}</dd></>}
                  {r.resolution && <><dt>Outcome</dt><dd>{RESOLUTION[r.resolution]}{r.refund_amount ? ` · ${rs(r.refund_amount)}` : ''}</dd></>}
                </dl>
                {r.staff_note && <p className="adm-muted" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>{r.staff_note}</p>}
                {data.photos.length > 0 && <div className="adm-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>{data.photos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.thumb_url || p.url} alt="Customer photo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} /></a>)}</div>}
              </div>
              {data.events.length > 0 && (
                <div className="adm-card">
                  <h3 className="adm-h3" style={{ marginTop: 0 }}>History</h3>
                  <ul className="adm-list">{data.events.map((e, i) => <li key={i} className="adm-row"><span>{data.labels[e.status] || e.status}{e.note ? <span className="adm-sub">{e.note}</span> : null}</span><span className="adm-sub">{dt(e.created_at)} · {e.actor.replace('staff:', '')}</span></li>)}</ul>
                </div>
              )}
              <div className="adm-card">
                <h3 className="adm-h3" style={{ marginTop: 0 }}>Items</h3>
                <ul className="adm-list">{data.items.map((i) => (
                  <li key={i.id} className="adm-row">
                    <span>{i.qty} × {i.name}<span className="adm-sub">{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''} · {rs(i.unit_price * i.qty)}</span></span>
                    {BEFORE.includes(r.status) && editable ? (
                      <select value={cond[i.id] || 'resellable'} onChange={(e) => setCond({ ...cond, [i.id]: e.target.value })} aria-label={`Condition of ${i.name}`} style={{ width: 'auto' }}>
                        <option value="resellable">Resellable: back to stock</option><option value="damaged">Damaged</option><option value="expired">Expired</option>
                      </select>
                    ) : i.condition ? <span className={`adm-badge ${i.condition === 'resellable' ? 'is-ok' : 'is-off'}`}>{i.condition === 'resellable' ? `Back in stock (${i.restocked})` : i.condition}</span> : null}
                  </li>
                ))}</ul>
              </div>
              {editable && (BEFORE.includes(r.status) || r.status === 'received' || r.status === 'refund_initiated') && (
                <div className="adm-card adm-form">
                  <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={BEFORE.includes(r.status) ? 'Shown to the customer, e.g. Photo received' : 'e.g. Refunded to UPI'} /></label>
                  {r.status === 'approved' && (
                    <div className="adm-row" style={{ alignItems: 'flex-end' }}>
                      <label style={{ flex: 1 }}>Pickup date<input type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} /></label>
                      <button className="adm-btn is-gold" disabled={act.busy || !pickup} onClick={() => advance('pickup_scheduled')}>Schedule pickup</button>
                    </div>
                  )}
                  {BEFORE.includes(r.status) && !rejecting && (
                    <div className="adm-actions">
                      {r.status === 'requested' && <button className="adm-btn is-ghost" disabled={act.busy} onClick={() => advance('under_review')}>Start review</button>}
                      {['requested', 'under_review'].includes(r.status) && <button className="adm-btn is-gold" disabled={act.busy} onClick={() => advance('approved')}>Approve</button>}
                      <button className="adm-btn" disabled={act.busy} onClick={receive}><PackageCheck size={16} /> Items received</button>
                      <button className="adm-btn is-ghost" onClick={() => setRejecting(true)}>Reject return</button>
                    </div>
                  )}
                  {r.status === 'refund_initiated' && can(staff, 'refunds') && (
                    <div className="adm-actions"><button className="adm-btn is-gold" disabled={act.busy} onClick={refundDone}>Refund reached the customer: mark completed</button></div>
                  )}
                  {rejecting && (
                    <div className="adm-actions">
                      <button className="adm-btn is-danger" disabled={act.busy || note.trim().length < 3} onClick={reject}>Confirm reject (the note is the reason the customer sees)</button>
                      <button className="adm-btn is-ghost" onClick={() => setRejecting(false)}>Back</button>
                    </div>
                  )}
                  {r.status === 'received' && (
                    <>
                      {can(staff, 'refunds') && ['paid', 'partially_refunded'].includes(r.payment_status) && (
                        <div className="adm-row" style={{ alignItems: 'flex-end' }}>
                          <label style={{ flex: 1 }}>Refund amount (₹)<span className="adm-sub">Suggested: the returned items ({rs(data.suggestedRefund)}). Up to {rs(data.refundable)}.</span>
                            <input type="number" min="1" step="0.01" max={data.refundable / 100} value={amount} onChange={(e) => setAmount(e.target.value)} />
                          </label>
                          <button className="adm-btn is-gold" disabled={act.busy || !Number(amount)} onClick={() => resolve('refund')}>Refund</button>
                        </div>
                      )}
                      <div className="adm-actions">
                        <button className="adm-btn is-ghost" disabled={act.busy} onClick={() => resolve('replacement')}>Send a replacement</button>
                        <button className="adm-btn is-ghost" disabled={act.busy} onClick={() => resolve('no_action')}>Close, no action</button>
                      </div>
                      <p className="adm-muted">For a replacement, place a new order for the customer as usual.</p>
                    </>
                  )}
                </div>
              )}
              {(r.status === 'resolved' || r.status === 'rejected') && <p className="adm-muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={16} className="is-ok" /> This return is closed.</p>}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/** "Start a return" from an order page. */
export function StartReturn({ number, onClose, onCreated }) {
  const { data, error } = useApi(`/api/admin/orders/${encodeURIComponent(number)}/returnable`);
  const act = useAction();
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('damaged');
  const [note, setNote] = useState('');
  const items = Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ orderItemId: Number(id), qty: n }));
  const submit = async (e) => {
    e.preventDefault();
    const r = await act.run(() => api(`/api/admin/orders/${number}/returns`, { method: 'POST', body: { items, reason, note } }));
    if (r) onCreated(r);
  };
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <form className="adm-palette adm-modal" onSubmit={submit} role="dialog" aria-label="Start a return">
        <div className="adm-drawer__head"><h2 style={{ flex: 1 }}>Start a return · {number}</h2><button type="button" className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="adm-form adm-pad">
          <ErrorBox>{error || act.error}</ErrorBox>
          {!data ? <Loading /> : !data.eligible ? <p className="adm-muted">Returns can be started only for delivered orders.</p> : (
            <>
              <p className="adm-muted">Choose what the customer is sending back.</p>
              <ul className="adm-list">{data.items.map((i) => (
                <li key={i.id} className="adm-row">
                  <span>{i.name}<span className="adm-sub">{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''} · bought {i.qty}{i.returnable < i.qty ? `, ${i.qty - i.returnable} already returned` : ''}</span></span>
                  <select value={qty[i.id] || 0} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })} disabled={i.returnable === 0} style={{ width: 'auto' }} aria-label={`How many ${i.name}`}>
                    {Array.from({ length: i.returnable + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'None' : `Return ${n}`}</option>)}
                  </select>
                </li>
              ))}</ul>
              <label>Reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(data.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Details (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What the customer told you" /></label>
              <button className="adm-btn" disabled={act.busy || items.length === 0}>{act.busy ? 'Saving…' : 'Log return'}</button>
            </>
          )}
        </div>
      </form>
    </>
  );
}
