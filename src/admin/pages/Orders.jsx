import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Printer, ArrowLeft, X, Search, ExternalLink, Truck, PackageCheck, PackageOpen, Undo2 } from 'lucide-react';
import { StartReturn } from './Returns';
import { api } from '../../store/lib/api';
import { Badge, Empty, ErrorBox, Loading, METHOD, Notice, PAYSTATUS, PageHead, Pager, STATUS, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

// Flipkart-style pipeline tabs (server: STAGES in server/admin/reports.js)
const STAGES = [
  ['all', 'All'], ['to_pack', 'To pack'], ['ready_to_ship', 'Ready to ship'], ['in_transit', 'In transit'],
  ['delivered', 'Delivered'], ['returns', 'Returns'], ['awaiting_payment', 'Awaiting payment'], ['cancelled', 'Cancelled'],
];
const HOT = new Set(['to_pack', 'ready_to_ship']);
// what can be done in bulk from each tab
const BULK = { to_pack: ['packed', 'Mark packed', PackageCheck], ready_to_ship: ['shipped', 'Mark shipped', Truck], in_transit: ['delivered', 'Mark delivered', PackageCheck] };

export function OrderList() {
  const { staff } = useAdmin();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stage = params.get('stage') || 'all';
  const f = { stage, payment: params.get('payment') || 'all', q: params.get('q') || '', from: params.get('from') || '', to: params.get('to') || '', page: params.get('page') || '1' };
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v && v !== 'all')).toString();
  const { data, error, loading, reload } = useApi(`/api/admin/orders?${qs}`);
  const counts = useApi('/api/admin/orders/counts');
  const [q, setQ] = useState(f.q);
  const [picked, setPicked] = useState(new Set());
  const [peek, setPeek] = useState(null);
  const act = useAction();
  useEffect(() => { setPicked(new Set()); }, [qs]);

  const set = (k, v) => { const n = new URLSearchParams(params); if (v && v !== 'all') n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const rows = data?.rows || [];
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.order_number));
  const toggle = (n) => setPicked((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const bulk = BULK[stage];

  const runBulk = async () => {
    const [status, label] = bulk;
    const numbers = [...picked];
    const r = await act.run(() => api('/api/admin/orders/bulk-status', { method: 'POST', body: { numbers, status } }),
      (res) => `${label}: ${res.done} order${res.done === 1 ? '' : 's'} done${res.failed ? `, ${res.failed} could not be changed (${res.results.filter((x) => !x.ok).map((x) => x.number).join(', ')})` : ''}.`);
    if (r) { setPicked(new Set()); reload(); counts.reload(); }
  };
  const exportUrl = (numbers) => `/api/admin/orders.csv?${numbers ? '' : qs.replace(/(^|&)page=\d+/, '')}`;

  return (
    <>
      <PageHead title="Orders" sub="Work through orders stage by stage. Click a row for a quick look.">
        <a className="adm-btn is-ghost" href={exportUrl()}><Download size={16} /> Export</a>
      </PageHead>

      <div className="adm-tabs" role="tablist" aria-label="Order stages">
        {STAGES.map(([k, label]) => {
          const n = counts.data?.counts?.[k];
          return (
            <button key={k} role="tab" aria-selected={stage === k} className={`adm-tab ${stage === k ? 'is-on' : ''} ${HOT.has(k) && n > 0 ? 'is-hot' : ''}`} onClick={() => set('stage', k)}>
              {label}{n != null && <b>{n}</b>}
            </button>
          );
        })}
      </div>

      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
          <Search size={16} />
          <input type="search" placeholder="Order number, name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        </form>
        <select value={f.payment} onChange={(e) => set('payment', e.target.value)} aria-label="Payment method">
          <option value="all">All payments</option>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="adm-inline">From<input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
        <label className="adm-inline">To<input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
      </div>
      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      {!data ? <Loading /> : (
        <section className={`adm-card is-flush ${loading ? 'is-loading' : ''}`}>
          {rows.length === 0 ? (
            <Empty icon={PackageOpen} title={stage === 'to_pack' ? 'Nothing to pack. Nice work.' : 'No orders here'}>
              {stage !== 'all' ? <button className="adm-link" onClick={() => set('stage', 'all')}>See all orders</button> : 'Orders appear here the moment a customer checks out.'}
            </Empty>
          ) : (
            <div className="adm-tablewrap">
              <table className="adm-table is-cards">
                <thead><tr>
                  <th className="cb"><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.order_number)))} aria-label="Select all orders on this page" /></th>
                  <th>Order</th><th>Customer</th><th data-hide-sm>Products</th><th>Payment</th><th>Status</th><th className="num">Total</th>
                </tr></thead>
                <tbody>{rows.map((o) => (
                  <tr key={o.order_number} className={`is-click ${picked.has(o.order_number) ? 'is-picked' : ''}`} onClick={() => setPeek(o.order_number)}>
                    <td className="cb" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.has(o.order_number)} onChange={() => toggle(o.order_number)} aria-label={`Select ${o.order_number}`} /></td>
                    <td className="adm-ordercell"><strong>{o.order_number}</strong><span className="adm-sub">{dt(o.created_at)}</span></td>
                    <td>{o.customer}<span className="adm-sub">{[o.city, o.phone].filter(Boolean).join(' · ')}</span></td>
                    <td data-hide-sm><span className="adm-clamp" title={o.products}>{o.items} item{o.items === 1 ? '' : 's'} · {o.products}</span></td>
                    <td>{METHOD[o.payment_method]}<span className="adm-sub"><Badge map={PAYSTATUS} value={o.payment_status} /></span></td>
                    <td><Badge value={o.status} /></td>
                    <td className="num"><strong>{rs(o.total)}</strong></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => set('page', String(p))} />
        </section>
      )}

      {picked.size > 0 && (
        <div className="adm-bulk" role="region" aria-label="Bulk actions">
          <strong>{picked.size} selected</strong>
          {bulk && can(staff, 'orders.edit') && (() => { const I = bulk[2]; return <button className="adm-btn is-gold is-sm" disabled={act.busy} onClick={runBulk}><I size={15} /> {bulk[1]}</button>; })()}
          <button className="adm-btn is-ghost is-sm" onClick={() => navigate(`/admin/orders/print?numbers=${[...picked].join(',')}`)}><Printer size={15} /> Packing slips</button>
          <button className="adm-btn is-ghost is-sm" onClick={() => setPicked(new Set())}><X size={15} /> Clear</button>
        </div>
      )}

      {peek && <OrderDrawer number={peek} onClose={() => setPeek(null)} onChanged={() => { reload(); counts.reload(); }} />}
    </>
  );
}

// ---- shared pieces ----------------------------------------------------------
const STEPS = [['confirmed', 'Confirmed'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const ORDER_OF = { pending_payment: -1, confirmed: 0, packed: 1, shipped: 2, out_for_delivery: 2.5, delivered: 3 };
function Stepper({ status }) {
  const stopped = ['cancelled', 'refunded', 'rto', 'returned'].includes(status);
  const at = ORDER_OF[status] ?? 3;
  return (
    <div className={`adm-stepper ${stopped ? 'is-stopped' : ''}`} aria-label={`Progress: ${STATUS[status]?.[0] || status}`}>
      {STEPS.map(([k, label], i) => {
        const cls = stopped ? (i === 0 ? 'is-done' : '') : at >= i ? 'is-done' : at > i - 1 ? 'is-now' : '';
        return <span key={k} className={`adm-step ${cls}`}>{label}</span>;
      })}
    </div>
  );
}

const ACTION_LABEL = {
  packed: 'Mark packed', shipped: 'Mark shipped', out_for_delivery: 'Out for delivery', delivered: 'Mark delivered',
  confirmed: 'Back to "to pack"', cancelled: 'Cancel order', rto: 'Returned to us (RTO)', returned: 'Mark returned',
};

/** Status buttons (+ reason / restock form). Used on the order page and in the quick-view drawer. */
function StatusActions({ o, onDone, act }) {
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const move = async (status) => {
    const needsForm = ['cancelled', 'rto', 'returned', 'shipped'].includes(status);
    if (needsForm && pending !== status) { setPending(status); setNote(''); setRestock(true); return; }
    const r = await act.run(() => api(`/api/admin/orders/${o.number}/status`, { method: 'POST', body: { status, note, restock } }),
      (res) => (res.refundSuggested ? 'Order cancelled. It was paid online: issue a refund from the order page.' : `Order moved to "${STATUS[status][0]}".`));
    if (r) { setPending(null); setNote(''); onDone(); }
  };
  if (!o.next.length) return null;
  return (
    <div>
      <div className="adm-actions">
        {o.next.map((s) => (
          <button key={s} className={`adm-btn ${s === 'cancelled' || s === 'rto' ? 'is-danger is-ghost' : s === 'confirmed' ? 'is-ghost' : ''}`} disabled={act.busy} onClick={() => move(s)}>{ACTION_LABEL[s] || s}</button>
        ))}
      </div>
      {pending && (
        <div className="adm-form adm-pending">
          <label>{pending === 'cancelled' ? 'Reason for cancelling (required)' : pending === 'shipped' ? 'Courier and tracking number (sent to the customer)' : 'Note (optional)'}
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus
              placeholder={pending === 'cancelled' ? 'e.g. Customer asked to cancel' : pending === 'shipped' ? 'e.g. DTDC, AWB 7845123690' : 'e.g. Courier returned: address not found'} />
          </label>
          {(pending === 'rto' || pending === 'returned') && <label className="adm-check"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put the items back in stock</label>}
          <div className="adm-actions">
            <button className={`adm-btn ${pending === 'shipped' ? '' : 'is-danger'}`} disabled={act.busy || (pending === 'cancelled' && !note.trim())} onClick={() => move(pending)}>Confirm: {ACTION_LABEL[pending]}</button>
            <button className="adm-btn is-ghost" onClick={() => setPending(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Address({ a }) {
  return <p>{a.name}<br />{a.line1}{a.line2 ? <>, {a.line2}</> : null}<br />{a.city}, {a.state} {a.pin}<br /><a href={`tel:+91${a.phone}`}>+91 {a.phone}</a></p>;
}

/** Quick look without leaving the list. */
function OrderDrawer({ number, onClose, onChanged }) {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/orders/${encodeURIComponent(number)}`);
  const act = useAction();
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const o = data?.order;
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label={`Order ${number}`}>
        <div className="adm-drawer__head">
          <div style={{ flex: 1 }}><p className="adm-eyebrow">Order</p><h2>{number}</h2></div>
          {o && <Badge value={o.status} />}
          <button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="adm-drawer__body">
          <ErrorBox>{error || act.error}</ErrorBox>
          <Notice>{act.notice}</Notice>
          {!data ? <Loading /> : (
            <>
              <Stepper status={o.status} />
              {can(staff, 'orders.edit') && o.next.length > 0 && <div className="adm-card"><StatusActions o={o} act={act} onDone={() => { reload(); onChanged(); }} /></div>}
              <div className="adm-card">
                <h3 className="adm-h3" style={{ marginTop: 0 }}>Items</h3>
                <ul className="adm-list">{data.items.map((i) => (
                  <li key={`${i.product_id}:${i.pack}`} className="adm-row"><span>{i.qty} × {i.name}<span className="adm-sub">{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''}</span></span><strong className="num">{rs(i.line_total)}</strong></li>
                ))}</ul>
                <p className="adm-row" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}><span>Total · {METHOD[o.paymentMethod]}</span><strong className="num">{rs(o.total)}</strong></p>
                <p style={{ marginTop: 6 }}><Badge map={PAYSTATUS} value={o.paymentStatus} /></p>
              </div>
              <div className="adm-card">
                <h3 className="adm-h3" style={{ marginTop: 0 }}>Ship to</h3>
                <Address a={o.address} />
                {data.customer && <p className="adm-muted" style={{ marginTop: 8 }}><Link to={`/admin/customers/${data.customer.id}`}>{data.customer.name}</Link> · {data.customer.orders} order(s) in total</p>}
              </div>
            </>
          )}
        </div>
        <div className="adm-drawer__foot">
          <Link className="adm-btn" to={`/admin/orders/${number}`}><ExternalLink size={15} /> Open full order</Link>
          <Link className="adm-btn is-ghost" to={`/admin/orders/print?numbers=${number}`}><Printer size={15} /> Packing slip</Link>
        </div>
      </aside>
    </>
  );
}

export function OrderDetail() {
  const { number } = useParams();
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/orders/${encodeURIComponent(number)}`);
  const act = useAction();
  const [refund, setRefund] = useState({ amount: '', reason: '' });
  const [staffNote, setStaffNote] = useState(null);
  const [returning, setReturning] = useState(false);
  const navigate = useNavigate();

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const { order: o, items, events, payments, refunds, customer, notifications = [] } = data;
  const refundable = can(staff, 'refunds') && ['paid', 'partially_refunded'].includes(o.paymentStatus) && o.total - o.refunded > 0;

  const doRefund = async (e) => {
    e.preventDefault();
    const amount = refund.amount ? toPaise(refund.amount) : undefined;
    const label = amount ? rs(amount) : rs(o.total - o.refunded);
    if (!window.confirm(`Refund ${label} for ${o.number}?${o.paymentMethod === 'cod' ? ' (Record only: pay the customer back by hand.)' : ' Razorpay will send the money back to the customer.'}`)) return;
    const r = await act.run(() => api(`/api/admin/orders/${o.number}/refund`, { method: 'POST', body: { amount, reason: refund.reason } }),
      (res) => `Refund of ${rs(res.amount)} ${res.method === 'razorpay' ? `sent through Razorpay (${res.status})` : 'recorded'}.`);
    if (r) { setRefund({ amount: '', reason: '' }); reload(); }
  };
  const saveNote = async () => {
    const r = await act.run(() => api(`/api/admin/orders/${o.number}/note`, { method: 'POST', body: { note: staffNote } }), 'Note saved.');
    if (r) { setStaffNote(null); reload(); }
  };

  return (
    <>
      <Link to="/admin/orders" className="adm-link adm-back no-print"><ArrowLeft size={15} /> Orders</Link>
      <PageHead title={`Order ${o.number}`} sub={`Placed ${dt(o.createdAt)}`}>
        <Badge value={o.status} /> <Badge map={PAYSTATUS} value={o.paymentStatus} />
        {o.status === 'delivered' && can(staff, 'orders.edit') && <button className="adm-btn is-ghost no-print" onClick={() => setReturning(true)}><Undo2 size={16} /> Start a return</button>}
        <Link className="adm-btn is-ghost no-print" to={`/admin/orders/print?numbers=${o.number}`}><Printer size={16} /> Packing slip</Link>
      </PageHead>
      {returning && <StartReturn number={o.number} onClose={() => setReturning(false)} onCreated={(r) => navigate(`/admin/returns?id=${r.id}`)} />}
      <ErrorBox>{act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      <section className="adm-card no-print">
        <Stepper status={o.status} />
        {can(staff, 'orders.edit') && o.next.length > 0 && <div style={{ marginTop: 16 }}><StatusActions o={o} act={act} onDone={reload} /></div>}
      </section>

      <div className="adm-grid2 is-wide-left">
        <div className="adm-stack" style={{ marginBottom: 0 }}>
          <section className="adm-card is-flush">
            <div className="adm-pad" style={{ paddingBottom: 0 }}><h2 className="adm-h2">Items</h2></div>
            <table className="adm-table">
              <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Each</th><th className="num">Total</th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={`${i.product_id}:${i.pack}`}><td>{i.name}<span className="adm-sub">{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''}</span></td><td className="num">{i.qty}</td><td className="num">{rs(i.unit_price)}</td><td className="num">{rs(i.line_total)}</td></tr>
              ))}</tbody>
              <tfoot>
                <tr><td colSpan={3}>Subtotal</td><td className="num">{rs(o.subtotal)}</td></tr>
                {o.discount > 0 && <tr><td colSpan={3}>Prepaid discount</td><td className="num">−{rs(o.discount)}</td></tr>}
                <tr><td colSpan={3}>Shipping</td><td className="num">{o.shipping ? rs(o.shipping) : 'Free'}</td></tr>
                <tr className="is-total"><td colSpan={3}>Total ({METHOD[o.paymentMethod]})</td><td className="num">{rs(o.total)}</td></tr>
                {o.refunded > 0 && <tr><td colSpan={3}>Refunded</td><td className="num">−{rs(o.refunded)}</td></tr>}
              </tfoot>
            </table>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Timeline</h2>
            <ol className="adm-timeline">
              {events.map((e, i) => (
                <li key={i}><Badge value={e.to_status} /> <span className="adm-muted">{dt(e.created_at)} · {e.actor.replace(/^staff:/, '')}</span>{e.note && <p>{e.note}</p>}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="adm-stack" style={{ marginBottom: 0 }}>
          <section className="adm-card">
            <h2 className="adm-h2">Customer</h2>
            {customer && <p><Link to={`/admin/customers/${customer.id}`}><strong>{customer.name}</strong></Link><br />+91 {customer.phone}<br />{o.email || customer.email || <span className="adm-muted">No email</span>}<br /><span className="adm-muted">{customer.orders} order(s) in total</span></p>}
            <h2 className="adm-h2" style={{ marginTop: 16 }}>Ship to</h2>
            <Address a={o.address} />
            {o.cancelReason && <p className="adm-muted" style={{ marginTop: 8 }}>Cancelled: {o.cancelReason}</p>}
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Payment</h2>
            {payments.length === 0 ? <p className="adm-muted">{o.paymentMethod === 'cod' ? 'Cash on delivery.' : 'No payment attempts.'}</p> : (
              <ul className="adm-list">{payments.map((p) => (
                <li key={p.provider_order_id}><Badge map={PAYSTATUS} value={p.status} /> {rs(p.amount)} {p.method ? `· ${p.method}` : ''}<span className="adm-sub">{p.provider_payment_id || p.provider_order_id} · {dt(p.created_at)}</span>{p.error && <span className="adm-sub is-bad">{p.error}</span>}</li>
              ))}</ul>
            )}
            {refunds.length > 0 && (<><h3 className="adm-h3">Refunds</h3><ul className="adm-list">{refunds.map((r, i) => (
              <li key={i}>{rs(r.amount)} · {r.method} · <Badge map={{ processed: ['Processed', 'ok'], pending: ['Pending', 'warn'], failed: ['Failed', 'bad'] }} value={r.status} /><span className="adm-sub">{r.reason} · {r.staff || '—'} · {dt(r.created_at)}</span></li>
            ))}</ul></>)}
            {refundable && (
              <form className="adm-form" onSubmit={doRefund} style={{ marginTop: 12 }}>
                <h3 className="adm-h3">Issue a refund</h3>
                <label>Amount in ₹ (empty = full {rs(o.total - o.refunded)})<input type="number" min="1" step="0.01" max={(o.total - o.refunded) / 100} value={refund.amount} onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} /></label>
                <label>Reason<input required minLength={3} maxLength={300} value={refund.reason} onChange={(e) => setRefund((r) => ({ ...r, reason: e.target.value }))} /></label>
                <button className="adm-btn is-danger" disabled={act.busy}>{o.paymentMethod === 'cod' ? 'Record refund' : 'Refund through Razorpay'}</button>
              </form>
            )}
          </section>

          {notifications.length > 0 && (
            <section className="adm-card">
              <h2 className="adm-h2">Messages to customer</h2>
              <ul className="adm-list">{notifications.map((n, i) => (
                <li key={i}><Badge map={{ sent: ['Sent', 'ok'], failed: ['Failed', 'bad'], sending: ['Sending', 'warn'] }} value={n.status} /> {n.event.replace(/_/g, ' ')} · {n.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                  <span className="adm-sub">{dt(n.sent_at || n.created_at)}</span>{n.error && <span className="adm-sub is-bad">{n.error}</span>}</li>
              ))}</ul>
            </section>
          )}

          <section className="adm-card">
            <h2 className="adm-h2">Staff note</h2>
            {staffNote === null ? (
              <>
                <p className={o.staffNote ? '' : 'adm-muted'}>{o.staffNote || 'No note.'}</p>
                {can(staff, 'orders.note') && <button className="adm-btn is-ghost is-sm" style={{ marginTop: 10 }} onClick={() => setStaffNote(o.staffNote || '')}>Edit note</button>}
              </>
            ) : (
              <div className="adm-form">
                <textarea rows={3} maxLength={2000} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} autoFocus />
                <div className="adm-actions"><button className="adm-btn is-sm" disabled={act.busy} onClick={saveNote}>Save</button><button className="adm-btn is-ghost is-sm" onClick={() => setStaffNote(null)}>Cancel</button></div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Packing slips for one or more orders, one per printed page. */
export function PrintSlips() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const numbers = params.get('numbers') || '';
  const { data, error } = useApi(numbers ? `/api/admin/orders/slips?numbers=${encodeURIComponent(numbers)}` : null);
  return (
    <div className="adm-content" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="adm-row no-print" style={{ marginBottom: 20 }}>
        <button className="adm-link" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        <button className="adm-btn" onClick={() => window.print()} disabled={!data}><Printer size={16} /> Print {data ? `${data.slips.length} slip${data.slips.length === 1 ? '' : 's'}` : ''}</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div className="adm-slips">
          {data.slips.map((s) => (
            <article className="adm-slip" key={s.number}>
              <header>
                <div><h2>TranzLife Biosciences</h2><span style={{ fontSize: 13 }}>Packing slip</span></div>
                <div style={{ textAlign: 'right' }}><strong style={{ fontSize: 18 }}>{s.number}</strong><br /><span style={{ fontSize: 13 }}>{dt(s.createdAt)}</span></div>
              </header>
              <p><strong>Ship to</strong><br />{s.address.name}<br />{s.address.line1}{s.address.line2 ? <>, {s.address.line2}</> : null}<br />{s.address.city}, {s.address.state} {s.address.pin}<br />Phone: +91 {s.address.phone}</p>
              <table>
                <thead><tr><th>Item</th><th>Pack</th><th>Batch</th><th style={{ textAlign: 'right' }}>Qty</th></tr></thead>
                <tbody>{s.items.map((i, k) => <tr key={k}><td>{i.name} <span style={{ color: '#666' }}>({i.size})</span></td><td>{i.pack > 1 ? `Pack of ${i.pack}` : 'Single'}</td><td style={{ fontSize: 12.5 }}>{(i.batches || []).map((b) => `${b.batchNo}${i.batches.length > 1 ? ` ×${b.qty}` : ''} (exp ${new Date(b.expiry).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`).join(', ') || '—'}</td><td style={{ textAlign: 'right' }}>{i.qty}</td></tr>)}</tbody>
              </table>
              {s.note && <p style={{ fontSize: 13 }}><strong>Note:</strong> {s.note}</p>}
              {s.paymentMethod === 'cod' && s.paymentStatus !== 'paid' ? <span className="cod">CASH ON DELIVERY: COLLECT {rs(s.total)}</span> : <span className="cod">PREPAID: DO NOT COLLECT CASH</span>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

