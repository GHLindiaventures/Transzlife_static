import { Link, useSearchParams } from 'react-router-dom';
import { Badge, ErrorBox, Loading, PAYSTATUS, PageHead, Pager, dt, rs, useApi } from '../ui';

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all', page = params.get('page') || '1';
  const { data, error } = useApi(`/api/admin/payments?${new URLSearchParams({ status, page })}`);
  return (
    <>
      <PageHead title="Payments" sub="Online payments through Razorpay. Cash-on-delivery orders appear under Orders." />
      {data && !data.razorpay && <p className="adm-notice">Razorpay is not connected yet, so checkout offers cash on delivery only. Add the Razorpay keys in the server settings to turn on online payments.</p>}
      <div className="adm-filters">
        <select value={status} onChange={(e) => setParams(e.target.value === 'all' ? {} : { status: e.target.value })} aria-label="Payment status">
          <option value="all">All payments</option><option value="paid">Paid</option><option value="created">Started, not paid</option><option value="failed">Failed</option>
        </select>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <>
          <section className="adm-card is-flush">
            {data.rows.length === 0 ? <p className="adm-muted adm-pad">No payments yet.</p> : (
              <table className="adm-table">
                <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Method</th><th>Status</th><th>Razorpay ID</th><th className="num">Amount</th></tr></thead>
                <tbody>{data.rows.map((p) => (
                  <tr key={p.provider_order_id}>
                    <td>{dt(p.created_at)}</td><td><Link to={`/admin/orders/${p.order_number}`}>{p.order_number}</Link></td><td>{p.customer}</td>
                    <td>{p.method || '—'}</td><td><Badge map={PAYSTATUS} value={p.status} />{p.error && <small className="adm-sub is-bad">{p.error}</small>}</td>
                    <td><code>{p.provider_payment_id || p.provider_order_id}</code></td><td className="num">{rs(p.amount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParams({ ...(status !== 'all' ? { status } : {}), page: String(p) })} />
          </section>
          <section className="adm-card">
            <h2 className="adm-h2">Recent refunds</h2>
            {data.refunds.length === 0 ? <p className="adm-muted">No refunds.</p> : (
              <table className="adm-table is-compact">
                <thead><tr><th>Date</th><th>Order</th><th>Method</th><th>Status</th><th>Reason</th><th className="num">Amount</th></tr></thead>
                <tbody>{data.refunds.map((r, i) => (
                  <tr key={i}><td>{dt(r.created_at)}</td><td><Link to={`/admin/orders/${r.order_number}`}>{r.order_number}</Link></td><td>{r.method}</td><td>{r.status}</td><td>{r.reason}</td><td className="num">{rs(r.amount)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
