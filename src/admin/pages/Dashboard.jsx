// Home: what needs doing today, how the business is doing (vs the previous period), and what's selling.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ArrowRight, CheckCircle2, Leaf, MessageCircle, Table2, LineChart as LineIcon, PackageOpen } from 'lucide-react';
import { Badge, Delta, Empty, ErrorBox, Loading, METHOD, RangePicker, Sparkline, dt, rs, rsCompact, useAdmin, useApi, useChartColors, useRange } from '../ui';

const RANGE_LABEL = { today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', '365d': '12 months', month: 'This month', custom: 'Chosen dates' };
const PREV_LABEL = { today: 'yesterday', '7d': 'previous 7 days', '30d': 'previous 30 days', '90d': 'previous 90 days', '365d': 'previous 12 months', month: 'same days last month', custom: 'previous period' };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard() {
  const { staff, theme } = useAdmin();
  const rng = useRange();
  const range = rng.range;
  const { data, error, loading } = useApi(`/api/admin/overview?${rng.qs}`);
  const colors = useChartColors(theme);

  return (
    <>
      <div className="adm-head adm-hello">
        <div>
          <p className="adm-eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greeting()}, {staff.name.split(' ')[0]}</h1>
        </div>
        <div className="adm-hello__right">
          <LiveNow />
          <RangePicker value={rng} />
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <Attention items={data.attention} />
          <Kpis data={data} range={range} colors={colors} />
          <div className="adm-grid2 is-wide-left" style={{ marginBottom: 20 }}>
            <Trend data={data} range={range} colors={colors} />
            <Pipeline pipeline={data.pipeline} />
          </div>
          <div className="adm-grid3" style={{ marginBottom: 20 }}>
            <BestSellers best={data.best} />
            <Mix data={data} colors={colors} />
            <Tulsi tulsi={data.tulsi} />
          </div>
          <Recent />
        </div>
      )}
    </>
  );
}

/** "● 12 on the site now" (same live count as Visitors > Right now), refreshed every 30 s. */
function LiveNow() {
  const { data, reload } = useApi('/api/admin/presence');
  useEffect(() => { const t = setInterval(reload, 30_000); return () => clearInterval(t); }, [reload]);
  if (!data) return null;
  return <Link to="/admin/visitors" className="adm-livechip"><span className="adm-livedot" aria-hidden="true" /> <b className="tabular">{data.total}</b> on the site now</Link>;
}

function Attention({ items }) {
  if (!items.length) return <div className="adm-allclear"><CheckCircle2 size={20} /> All clear: no orders waiting, nothing low on stock.</div>;
  return (
    <section aria-label="Needs your attention">
      <p className="adm-eyebrow" style={{ marginBottom: 10 }}>Needs your attention</p>
      <div className="adm-attn">
        {items.map((a) => (
          <Link key={a.key} to={a.to} className={`is-${a.tone}`}>
            <strong>{a.count}</strong>
            <span>{a.label}{a.detail && <small>{a.detail}</small>}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Kpis({ data, range, colors }) {
  const { current: c, previous: p, trend } = data;
  const tiles = [
    ['Revenue', rsCompact(c.revenue), c.revenue, p.revenue, trend.map((t) => t.revenue), rs(c.revenue)],
    ['Orders', c.orders, c.orders, p.orders, trend.map((t) => t.orders)],
    ['Average order', rsCompact(c.aov), c.aov, p.aov, null, rs(c.aov)],
    ['New customers', c.newCustomers, c.newCustomers, p.newCustomers, null],
  ];
  return (
    <div className="adm-kpis">
      {tiles.map(([label, shown, now, before, spark, full]) => (
        <div className="adm-kpi" key={label}>
          <div className="adm-kpi__label"><span className="adm-eyebrow">{label}</span><Delta now={now} before={before} /></div>
          <strong title={full}>{shown}</strong>
          {spark ? <Sparkline values={spark} color={colors.c1} /> : <span style={{ height: 34 }} aria-hidden="true" />}
          <div className="adm-kpi__foot">vs {PREV_LABEL[range]}: {label === 'Revenue' || label === 'Average order' ? rsCompact(before) : before}</div>
        </div>
      ))}
    </div>
  );
}

function TrendTip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const f = metric === 'revenue' ? rs : (v) => v;
  return (
    <div className="adm-tip">
      <b>{label}</b>
      <div><span><i />This period</span><strong>{f(d[metric])}</strong></div>
      <div><span><i className="is-prev" />Previous</span><span>{f(metric === 'revenue' ? d.prevRevenue : d.prevOrders)}</span></div>
    </div>
  );
}

function Trend({ data, range, colors }) {
  const [metric, setMetric] = useState('revenue');
  const [asTable, setAsTable] = useState(false);
  const prevKey = metric === 'revenue' ? 'prevRevenue' : 'prevOrders';
  const total = data.trend.reduce((s, t) => s + t[metric], 0);
  return (
    <section className="adm-card">
      <div className="adm-card__head">
        <div>
          <h2 className="adm-h2">Sales trend</h2>
          <p className="adm-muted">{metric === 'revenue' ? rs(total) : `${total} orders`} in {RANGE_LABEL[range].toLowerCase()}</p>
        </div>
        <div className="adm-actions">
          <div className="adm-seg" role="group" aria-label="Measure">
            <button className={metric === 'revenue' ? 'is-on' : ''} onClick={() => setMetric('revenue')}>Revenue</button>
            <button className={metric === 'orders' ? 'is-on' : ''} onClick={() => setMetric('orders')}>Orders</button>
          </div>
          <button className="adm-icon" onClick={() => setAsTable((v) => !v)} aria-label={asTable ? 'Show chart' : 'Show as table'} title={asTable ? 'Show chart' : 'Show as table'}>
            {asTable ? <LineIcon size={18} /> : <Table2 size={18} />}
          </button>
        </div>
      </div>
      <div className="adm-legend" aria-hidden="true"><span><i />This period</span><span><i className="is-prev" />{PREV_LABEL[range][0].toUpperCase() + PREV_LABEL[range].slice(1)}</span></div>
      {asTable ? (
        <div className="adm-tablewrap" style={{ maxHeight: 280, marginTop: 10 }}>
          <table className="adm-table is-compact">
            <thead><tr><th>{data.trend.length === 24 && range === 'today' ? 'Hour' : 'Day'}</th><th className="num">This period</th><th className="num">Previous</th></tr></thead>
            <tbody>{data.trend.map((t) => <tr key={t.label}><td>{t.label}</td><td className="num">{metric === 'revenue' ? rs(t[metric]) : t[metric]}</td><td className="num">{metric === 'revenue' ? rs(t[prevKey]) : t[prevKey]}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="adm-chart" role="img" aria-label={`Line chart of daily ${metric} for this period compared with the previous period`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11.5 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={metric === 'revenue' ? 52 : 32} allowDecimals={false}
                tick={{ fill: colors.muted, fontSize: 11.5 }} tickFormatter={(v) => (metric === 'revenue' ? rsCompact(v) : v)} />
              <Tooltip content={<TrendTip metric={metric} />} cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey={prevKey} stroke={colors.prev} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey={metric} stroke={colors.c1} strokeWidth={2.4} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

const PIPE = [
  ['confirmed', 'To pack', '/admin/orders?stage=to_pack'], ['packed', 'Ready to ship', '/admin/orders?stage=ready_to_ship'],
  ['shipped', 'Shipped', '/admin/orders?stage=in_transit'], ['out_for_delivery', 'Out for delivery', '/admin/orders?stage=in_transit'],
  ['delivered', 'Delivered', '/admin/orders?stage=delivered'], ['rto', 'Returned (RTO)', '/admin/orders?stage=returns'],
  ['returned', 'Returned', '/admin/orders?stage=returns'], ['cancelled', 'Cancelled', '/admin/orders?stage=cancelled'],
];
function Pipeline({ pipeline }) {
  const rows = PIPE.map(([k, label, to]) => ({ k, label, to, n: pipeline[k] || 0 })).filter((r) => r.n > 0 || ['confirmed', 'packed', 'shipped', 'delivered'].includes(r.k));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Order pipeline</h2><p className="adm-muted">Orders placed in this period, by where they are now</p></div></div>
      <div className="adm-bars">
        {rows.map((r) => (
          <Link key={r.k} to={r.to} className="adm-barrow" style={{ color: 'inherit' }} title={`${r.n} ${r.label.toLowerCase()}`}>
            <span>{r.label}</span>
            <span className="adm-bartrack"><i style={{ width: `${(r.n / max) * 100}%`, background: ['cancelled', 'rto', 'returned'].includes(r.k) ? 'var(--c-prev)' : undefined }} /></span>
            <b>{r.n}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BestSellers({ best }) {
  const max = Math.max(1, ...best.map((b) => b.revenue));
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Best sellers</h2><p className="adm-muted">By revenue in this period</p></div><Link to="/admin/products" className="adm-link">Products <ArrowRight size={14} /></Link></div>
      {best.length === 0 ? <Empty icon={PackageOpen} title="No sales yet in this period" /> : (
        <div className="adm-bars">
          {best.map((b) => (
            <div key={b.id} className="adm-barrow" title={`${b.name}: ${rs(b.revenue)}, ${b.units} units`}>
              <span>{b.name.replace(/^TranzLife /, '')}</span>
              <span className="adm-bartrack"><i style={{ width: `${(b.revenue / max) * 100}%` }} /></span>
              <b>{rsCompact(b.revenue)}<span className="adm-sub" style={{ display: 'inline', marginLeft: 6 }}>{b.units} u</span></b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Split({ title, sub, a, b, colors }) {
  const total = a.n + b.n;
  const pa = total ? Math.round((a.n / total) * 100) : 0;
  return (
    <div>
      <h3 className="adm-h3" style={{ marginTop: 0 }}>{title}</h3>
      {total === 0 ? <p className="adm-muted">No orders in this period.</p> : (
        <>
          <div className="adm-split" role="img" aria-label={`${a.label} ${pa}%, ${b.label} ${100 - pa}%`}>
            {a.n > 0 && <i style={{ width: `${pa}%`, background: colors.c1 }} />}
            {b.n > 0 && <i style={{ width: `${100 - pa}%`, background: colors.c2 }} />}
          </div>
          <div className="adm-split__legend">
            <div><i style={{ background: colors.c1 }} />{a.label}<b>{pa}% · {a.text}</b></div>
            <div><i style={{ background: colors.c2 }} />{b.label}<b>{100 - pa}% · {b.text}</b></div>
          </div>
        </>
      )}
      {sub && <p className="adm-muted" style={{ marginTop: 8 }}>{sub}</p>}
    </div>
  );
}

function Mix({ data, colors }) {
  const { payments: p, customers: c } = data;
  return (
    <section className="adm-card" style={{ display: 'grid', gap: 22 }}>
      <Split title="Prepaid vs cash on delivery" colors={colors}
        a={{ label: 'Prepaid', n: p.prepaid.orders, text: `${p.prepaid.orders} orders` }}
        b={{ label: 'Cash on delivery', n: p.cod.orders, text: `${p.cod.orders} orders` }}
        sub={p.cod.orders > p.prepaid.orders ? 'Most customers pay cash. Prepaid orders get returned less often.' : null} />
      <Split title="New vs returning customers" colors={colors}
        a={{ label: 'First order', n: c.first, text: `${c.first}` }}
        b={{ label: 'Returning', n: c.repeat, text: `${c.repeat}` }} />
    </section>
  );
}

function Tulsi({ tulsi }) {
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2"><MessageCircle size={17} /> Customers ask Tulsi about</h2><p className="adm-muted">Topics from the chat assistant (anonymous)</p></div></div>
      {!tulsi || tulsi.topics.length === 0 ? <Empty icon={Leaf} title="No chat topics yet">As visitors chat with Tulsi, their most common concerns show here.</Empty> : (
        <>
          <div className="adm-topics">
            {tulsi.topics.map((t) => <span key={t.name} className={`adm-topic ${t.hasProduct ? '' : 'is-gap'}`} title={t.hasProduct ? 'We have a product for this' : 'No product for this yet'}>{t.name} <b>{t.n}</b></span>)}
          </div>
          <p className="adm-muted" style={{ marginTop: 12 }}>{tulsi.conversations} conversation{tulsi.conversations === 1 ? '' : 's'}. Gold topics have no TranzLife product yet: ideas for the range.</p>
        </>
      )}
    </section>
  );
}

function Recent() {
  const { data } = useApi('/api/admin/orders?page=1');
  const rows = data?.rows.slice(0, 6) || [];
  return (
    <section className="adm-card is-flush">
      <div className="adm-card__head adm-pad" style={{ marginBottom: 0 }}><h2 className="adm-h2">Latest orders</h2><Link to="/admin/orders" className="adm-link">All orders <ArrowRight size={14} /></Link></div>
      {!data ? <Loading /> : rows.length === 0 ? <Empty icon={PackageOpen} title="No orders yet">Orders appear here the moment a customer checks out.</Empty> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th data-hide-sm>Placed</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.order_number}>
                <td className="adm-ordercell"><Link to={`/admin/orders/${o.order_number}`}><strong>{o.order_number}</strong></Link></td>
                <td>{o.customer}<span className="adm-sub">{o.city}</span></td>
                <td data-hide-sm>{dt(o.created_at)}</td>
                <td>{METHOD[o.payment_method]}</td>
                <td><Badge value={o.status} /></td>
                <td className="num">{rs(o.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
