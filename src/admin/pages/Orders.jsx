import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, ErrorBox, Loading, METHOD, Notice, PAYSTATUS, PageHead, Pager, STATUS, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

const STATUS_FILTERS = ['all', 'pending_payment', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'rto'];

export function OrderList() {
  const [params, setParams] = useSearchParams();
  const f = { status: params.get('status') || 'all', payment: params.get('payment') || 'all', q: params.get('q') || '', from: params.get('from') || '', to: params.get('to') || '', page: params.get('page') || '1' };
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v && v !== 'all')).toString();
  const { data, error, loading } = useApi(`/api/admin/orders?${qs}`);
  const set = (k, v) => { const n = new URLSearchParams(params); if (v && v !== 'all') n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const [q, setQ] = useState(f.q);

  return (
    <>
      <PageHead title="Orders">
        <a className="adm-btn is-ghost" href={`/api/admin/orders.csv?${qs.replace(/(^|&)page=\d+/, '')}`}><Download size={16} /> Export CSV</a>
      </PageHead>
      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
          <input type="search" placeholder="Order no., name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        </form>
        <select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS[s][0]}</option>)}
        </select>
        <select value={f.payment} onChange={(e) => set('payment', e.target.value)} aria-label="Payment method">
          <option value="all">All payments</option>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="adm-inline">From<input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
        <label className="adm-inline">To<input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className={`adm-card is-flush ${loading ? 'is-loading' : ''}`}>
          {data.rows.length === 0 ? <p className="adm-muted adm-pad">No orders match.</p> : (
            <table className="adm-table">
              <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th className="num">Items</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>{data.rows.map((o) => (
                <tr key={o.order_number}>
                  <td><Link to={`/admin/orders/${o.order_number}`}><strong>{o.order_number}</strong></Link></td>
                  <td>{dt(o.created_at)}</td>
                  <td>{o.customer}<small className="adm-sub">{o.phone}</small></td>
                  <td className="num">{o.items}</td>
                  <td>{METHOD[o.payment_method]}<small className="adm-sub"><Badge map={PAYSTATUS} value={o.payment_status} /></small></td>
                  <td><Badge value={o.status} /></td>
                  <td className="num">{rs(o.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => set('page', String(p))} />
        </section>
      )}
    </>
  );
}

const ACTION_LABEL = {
  packed: 'Mark packed', shipped: 'Mark shipped', out_for_delivery: 'Out for delivery', delivered: 'Mark delivered',
  confirmed: 'Back to "to pack"', cancelled: 'Cancel order', rto: 'Returned to us (RTO)', returned: 'Mark returned',
};

export function OrderDetail() {
  const { number } = useParams();
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/orders/${encodeURIComponent(number)}`);
  const act = useAction();
  const [pending, setPending] = useState(null);          // status waiting for a reason / restock choice
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const [refund, setRefund] = useState({ amount: '', reason: '' });
  const [staffNote, setStaffNote] = useState(null);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const { order: o, items, events, payments, refunds, customer, notifications = [] } = data;
  const canEdit = can(staff, 'orders.edit');
  const refundable = can(staff, 'refunds') && ['paid', 'partially_refunded'].includes(o.paymentStatus) && o.total - o.refunded > 0;

  const move = async (status) => {
    const needsForm = status === 'cancelled' || status === 'rto' || status === 'returned';
    if (needsForm && pending !== status) { setPending(status); setNote(''); setRestock(true); return; }
    const r = await act.run(() => api(`/api/admin/orders/${o.number}/status`, { method: 'POST', body: { status, note, restock } }),
      (res) => (res.refundSuggested ? 'Order cancelled. It was paid online: issue a refund below.' : `Order moved to "${STATUS[status][0]}".`));
    if (r) { setPending(null); setNote(''); reload(); }
  };
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
  const a = o.address;

  return (
    <>
      <Link to="/admin/orders" className="adm-link adm-back no-print"><ArrowLeft size={15} /> Orders</Link>
      <PageHead title={`Order ${o.number}`} sub={`Placed ${dt(o.createdAt)}`}>
        <Badge value={o.status} /> <Badge map={PAYSTATUS} value={o.paymentStatus} />
        <button className="adm-btn is-ghost no-print" onClick={() => window.print()}><Printer size={16} /> Packing slip</button>
      </PageHead>
      <ErrorBox>{act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      {canEdit && o.next.length > 0 && (
        <section className="adm-card no-print">
          <div className="adm-actions">
            {o.next.map((s) => (
              <button key={s} className={`adm-btn ${s === 'cancelled' || s === 'rto' ? 'is-danger' : s === 'confirmed' ? 'is-ghost' : ''}`} disabled={act.busy} onClick={() => move(s)}>{ACTION_LABEL[s] || s}</button>
            ))}
          </div>
          {pending && (
            <div className="adm-form adm-pending">
              <label>{pending === 'cancelled' ? 'Reason for cancelling (required)' : 'Note (optional)'}
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus placeholder={pending === 'cancelled' ? 'e.g. Customer asked to cancel' : 'e.g. Courier returned: address not found'} />
              </label>
              {pending !== 'cancelled' && <label className="adm-check"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put the items back in stock</label>}
              <div className="adm-actions">
                <button className="adm-btn is-danger" disabled={act.busy || (pending === 'cancelled' && !note.trim())} onClick={() => move(pending)}>Confirm: {ACTION_LABEL[pending]}</button>
                <button className="adm-btn is-ghost" onClick={() => setPending(null)}>Back</button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="adm-grid2 is-wide-left">
        <div>
          <section className="adm-card print-slip">
            <h2 className="adm-h2">Items</h2>
            <table className="adm-table is-compact">
              <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Each</th><th className="num">Total</th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={`${i.product_id}:${i.pack}`}><td>{i.name}<small className="adm-sub">{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''}</small></td><td className="num">{i.qty}</td><td className="num">{rs(i.unit_price)}</td><td className="num">{rs(i.line_total)}</td></tr>
              ))}</tbody>
              <tfoot>
                <tr><td colSpan={3}>Subtotal</td><td className="num">{rs(o.subtotal)}</td></tr>
                {o.discount > 0 && <tr><td colSpan={3}>Prepaid discount</td><td className="num">−{rs(o.discount)}</td></tr>}
                <tr><td colSpan={3}>Shipping</td><td className="num">{o.shipping ? rs(o.shipping) : 'Free'}</td></tr>
                <tr className="is-total"><td colSpan={3}>Total ({METHOD[o.paymentMethod]})</td><td className="num">{rs(o.total)}</td></tr>
                {o.refunded > 0 && <tr><td colSpan={3}>Refunded</td><td className="num">−{rs(o.refunded)}</td></tr>}
              </tfoot>
            </table>
            <div className="print-only">
              <h2 className="adm-h2">Ship to</h2>
              <p>{a.name}<br />{a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />{a.city}, {a.state} {a.pin}<br />Phone: {a.phone}</p>
              {o.paymentMethod === 'cod' && <p><strong>Collect cash: {rs(o.total)}</strong></p>}
            </div>
          </section>

          <section className="adm-card no-print">
            <h2 className="adm-h2">Timeline</h2>
            <ol className="adm-timeline">
              {events.map((e, i) => (
                <li key={i}><Badge value={e.to_status} /> <span className="adm-muted">{dt(e.created_at)} · {e.actor}</span>{e.note && <p>{e.note}</p>}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="no-print">
          <section className="adm-card">
            <h2 className="adm-h2">Customer</h2>
            {customer && <p><Link to={`/admin/customers/${customer.id}`}><strong>{customer.name}</strong></Link><br />+91 {customer.phone}<br />{o.email || customer.email || 'No email'}<br /><span className="adm-muted">{customer.orders} order(s) in total</span></p>}
            <h2 className="adm-h2">Ship to</h2>
            <p>{a.name}<br />{a.line1}{a.line2 ? <>, {a.line2}</> : null}<br />{a.city}, {a.state} {a.pin}<br />{a.phone}</p>
            {o.cancelReason && <p className="adm-muted">Cancelled: {o.cancelReason}</p>}
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Payment</h2>
            {payments.length === 0 ? <p className="adm-muted">{o.paymentMethod === 'cod' ? 'Cash on delivery.' : 'No payment attempts.'}</p> : (
              <ul className="adm-list">{payments.map((p) => (
                <li key={p.provider_order_id}><Badge map={PAYSTATUS} value={p.status} /> {rs(p.amount)} {p.method ? `· ${p.method}` : ''}<small className="adm-sub">{p.provider_payment_id || p.provider_order_id} · {dt(p.created_at)}</small>{p.error && <small className="adm-sub is-bad">{p.error}</small>}</li>
              ))}</ul>
            )}
            {refunds.length > 0 && (<><h3 className="adm-h3">Refunds</h3><ul className="adm-list">{refunds.map((r, i) => (
              <li key={i}>{rs(r.amount)} · {r.method} · <Badge map={{ processed: ['Processed', 'ok'], pending: ['Pending', 'warn'], failed: ['Failed', 'bad'] }} value={r.status} /><small className="adm-sub">{r.reason} · {r.staff || '—'} · {dt(r.created_at)}</small></li>
            ))}</ul></>)}
            {refundable && (
              <form className="adm-form" onSubmit={doRefund}>
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
                  <small className="adm-sub">{dt(n.sent_at || n.created_at)}</small>{n.error && <small className="adm-sub is-bad">{n.error}</small>}</li>
              ))}</ul>
            </section>
          )}

          <section className="adm-card">
            <h2 className="adm-h2">Staff note</h2>
            {staffNote === null ? (
              <>
                <p className={o.staffNote ? '' : 'adm-muted'}>{o.staffNote || 'No note.'}</p>
                {can(staff, 'orders.note') && <button className="adm-btn is-ghost is-sm" onClick={() => setStaffNote(o.staffNote || '')}>Edit note</button>}
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
