import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Badge, ErrorBox, Loading, METHOD, PageHead, rs, dt, useApi, useAdmin } from '../ui';

export default function Dashboard() {
  const { staff } = useAdmin();
  const { data, error } = useApi('/api/admin/dashboard');
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const { periods: p, work: w, daily, lowStock, recent } = data;
  const max = Math.max(1, ...daily.map((x) => x.revenue));

  return (
    <>
      <PageHead title={`Hello, ${staff.name.split(' ')[0]}`} sub="Sales count confirmed orders (not awaiting payment or cancelled)." />
      <div className="adm-kpis">
        <Kpi label="Today" value={rs(p.today_revenue)} sub={`${p.today_orders} order${p.today_orders === 1 ? '' : 's'}`} />
        <Kpi label="Last 7 days" value={rs(p.week_revenue)} sub={`${p.week_orders} orders`} />
        <Kpi label="Last 30 days" value={rs(p.month_revenue)} sub={`${p.month_orders} orders`} />
      </div>

      <h2 className="adm-h2">Work to do</h2>
      <div className="adm-kpis is-work">
        <Work to="/admin/orders?status=confirmed" n={w.to_pack} label="To pack" hot />
        <Work to="/admin/orders?status=packed" n={w.to_ship} label="Packed, to ship" hot />
        <Work to="/admin/orders?status=shipped" n={w.in_transit} label="In transit" />
        <Work to="/admin/orders?status=pending_payment" n={w.awaiting_payment} label="Awaiting payment" />
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2 className="adm-h2">Sales, last 14 days</h2>
          <div className="adm-bars" role="img" aria-label="Daily sales for the last 14 days">
            {daily.map((x) => (
              <div key={x.day} className="adm-bar" title={`${x.day}: ${rs(x.revenue)}, ${x.orders} orders`}>
                <span style={{ height: `${Math.max(2, (x.revenue / max) * 100)}%` }} />
                <small>{x.day.slice(8)}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="adm-card">
          <h2 className="adm-h2"><AlertTriangle size={16} /> Low stock</h2>
          {lowStock.length === 0 ? <p className="adm-muted">All products are above their alert level.</p> : (
            <table className="adm-table is-compact">
              <thead><tr><th>Product</th><th className="num">Available</th><th className="num">Alert at</th></tr></thead>
              <tbody>{lowStock.map((s) => (
                <tr key={s.id}><td><Link to="/admin/products">{s.name}</Link></td><td className={`num ${s.available <= 0 ? 'is-bad' : 'is-warn'}`}>{s.available}</td><td className="num">{s.low_stock_at}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-row"><h2 className="adm-h2">Recent orders</h2><Link to="/admin/orders" className="adm-link">All orders →</Link></div>
        {recent.length === 0 ? <p className="adm-muted">No orders yet.</p> : (
          <table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>{recent.map((o) => (
              <tr key={o.order_number}>
                <td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link></td>
                <td>{o.customer}</td><td>{dt(o.created_at)}</td><td>{METHOD[o.payment_method]}</td>
                <td><Badge value={o.status} /></td><td className="num">{rs(o.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}

const Kpi = ({ label, value, sub }) => <div className="adm-kpi"><small>{label}</small><strong>{value}</strong><span>{sub}</span></div>;
const Work = ({ to, n, label, hot }) => (
  <Link to={to} className={`adm-kpi is-link ${hot && n > 0 ? 'is-hot' : ''}`}><strong>{n}</strong><span>{label}</span></Link>
);
