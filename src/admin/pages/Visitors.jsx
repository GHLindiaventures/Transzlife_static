// Visitors & engagement: who comes, from where, what they look at, where they drop off, and the
// carts they leave behind. Data comes from the site's own first-party tracking (no mock data):
// numbers start from the day tracking went live. Orders and revenue come from real orders.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Send, ShoppingCart, Users } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Delta, Empty, ErrorBox, Loading, Notice, PageHead, Pager, can, d, dt, rs, rsCompact, useAction, useAdmin, useApi, useChartColors, STATUS } from '../ui';
import { BarList, ChartCard, Tip } from './Analytics';

const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['custom', 'Custom']];
const pct = (v) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const SOURCE_LABEL = { direct: 'Direct / typed in', share: 'Shared links', google: 'Google search', bing: 'Bing search', instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', youtube: 'YouTube', x: 'X (Twitter)' };
const srcLabel = (s) => SOURCE_LABEL[s] || s;
const PATH_LABEL = { '/': 'Home', '/shop': 'Shop', '/cart': 'Cart', '/checkout': 'Checkout', '/about': 'About', '/science': 'Science', '/faq': 'FAQ', '/contact': 'Contact', '/ingredients': 'Ingredients', '/journal': 'Journal', '/account': 'My account', '/login': 'Sign in' };
const STATUS_ORDER = ['pending_payment', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'returned', 'rto'];

export default function Visitors() {
  const { theme } = useAdmin();
  const colors = useChartColors(theme);
  const [params, setParams] = useSearchParams();
  const range = params.get('range') || '30d';
  const [from, setFrom] = useState(params.get('from') || today());
  const [to, setTo] = useState(params.get('to') || today());
  const qs = range === 'custom' ? `range=custom&from=${params.get('from') || today()}&to=${params.get('to') || today()}` : `range=${range}`;
  const { data, error, loading } = useApi(`/api/admin/traffic?${qs}`);
  const pick = (r) => setParams(r === 'custom' ? { range: r, from, to } : { range: r });

  return (
    <>
      <PageHead title="Visitors & engagement" sub="Real visits to the website, compared with the period before. Staff and bots are not counted.">
        <div className="adm-seg" role="group" aria-label="Period">
          {RANGES.map(([k, l]) => <button key={k} className={range === k ? 'is-on' : ''} aria-pressed={range === k} onClick={() => pick(k)}>{l}</button>)}
        </div>
      </PageHead>
      {range === 'custom' && (
        <form className="adm-filters" onSubmit={(e) => { e.preventDefault(); setParams({ range: 'custom', from, to }); }}>
          <label className="adm-inline">From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required /></label>
          <label className="adm-inline">To <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} required /></label>
          <button className="adm-btn is-sm">Apply</button>
          <span className="adm-muted">Up to 366 days.</span>
        </form>
      )}
      <RightNow />
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          {data.current.visitors === 0 && data.current.pageViews === 0 && (
            <Notice>No visits recorded in this period yet. Tracking only counts real visitors from the day it went live; there is no sample data.</Notice>
          )}
          <Kpis t={data} />
          <div className="adm-grid2" style={{ marginBottom: 18 }}>
            <Trend t={data} colors={colors} />
            <Funnel t={data} />
          </div>
          <div className="adm-grid2" style={{ marginBottom: 18 }}>
            <OrdersChart t={data} colors={colors} />
            <OrderStatuses t={data} />
          </div>
          <Sources t={data} />
          <div className="adm-grid3" style={{ marginBottom: 18 }}>
            <BarList title="Most viewed pages" sub="Page views" rows={data.pages.map((p) => ({ key: p.path, label: pageName(p.path), value: p.views, text: `${p.views} · ${p.visitors} visitors` }))} />
            <BarList title="Where visits start" sub="Landing page · left after one page" rows={data.landing.map((p) => ({ key: p.path, label: pageName(p.path), value: p.visits, text: `${p.visits} · ${pct(p.bounceRate)}` }))} />
            <Devices t={data} />
          </div>
          <ProductTable t={data} />
          <div className="adm-grid2" style={{ marginBottom: 18 }}>
            <Interested t={data} />
            <Engagement t={data} />
          </div>
          <Carts />
        </div>
      )}
    </>
  );
}

/** Live: people on the site in the last 90 seconds (refreshed every 15 s). */
function RightNow() {
  const { data, reload } = useApi('/api/admin/presence');
  useEffect(() => { const t = setInterval(reload, 15_000); return () => clearInterval(t); }, [reload]);
  if (!data) return null;
  return (
    <section className="adm-card" style={{ marginBottom: 18 }}>
      <div className="adm-card__head">
        <div><h2 className="adm-h2"><span className="adm-livedot" aria-hidden="true" /> Right now</h2>
          <p className="adm-muted">Browsers active in the last 90 seconds (each counted once, however many tabs). Updates every 15 seconds.</p></div>
        <strong className="tabular" style={{ fontSize: 34 }}>{data.total}</strong>
      </div>
      {data.total === 0 ? <p className="adm-muted">Nobody on the site at the moment.</p> : (
        <div className="adm-grid3">
          <div><p className="adm-eyebrow">On these pages</p><ul className="adm-list">{data.pages.map((p) => <li key={p.key} className="adm-row"><span>{pageName(p.key)}</span><b className="tabular">{p.n}</b></li>)}</ul></div>
          <div><p className="adm-eyebrow">Looking at products</p>{data.products.length === 0 ? <p className="adm-muted">None</p> : <ul className="adm-list">{data.products.map((p) => <li key={p.key} className="adm-row"><span>{p.name}</span><b className="tabular">{p.n}</b></li>)}</ul>}</div>
          <div><p className="adm-eyebrow">Carts being filled</p><p style={{ margin: 0 }}><b className="tabular">{data.carts.n}</b> active in the last 30 minutes{data.carts.value ? `, ${rs(data.carts.value)} in total` : ''}</p>
            <p className="adm-muted" style={{ marginTop: 8 }}>Visitors see "N people are browsing" only from 3 people, and "N others viewing this product" from 2.</p></div>
        </div>
      )}
    </section>
  );
}

const pageName = (path) => {
  const m = path?.match(/^\/products\/(.+)$/);
  if (m) return `Product: ${m[1].replace(/-/g, ' ')}`;
  return PATH_LABEL[path] || path;
};

function Kpis({ t }) {
  const c = t.current, p = t.previous;
  const tiles = [
    ['Visitors', c.visitors, c.visitors, p.visitors, false, `${c.newVisitors} new · ${c.returningVisitors} returning`],
    ['Page views', c.pageViews, c.pageViews, p.pageViews, false, c.anonViews ? `${c.anonViews} from visitors who chose "only essential"` : `${c.pagesPerVisit.toFixed(1)} pages per visit`],
    ['Visitors who bought', pct(c.conversion), c.conversion, p.conversion, false, `${c.orders} orders · ${rsCompact(c.revenue)}`, true],
    ['Abandoned carts', c.abandoned, c.abandoned, p.abandoned, true, `${rsCompact(c.abandonedValue)} left in carts`],
    ['Left after one page', pct(c.bounceRate), c.bounceRate, p.bounceRate, true, `of ${c.visits} visits`, true],
    ['Shares', c.shares, c.shares, p.shares, false, `${c.shareVisits} visits came from shared links`],
  ];
  return (
    <div className="adm-kpis is-6">
      {tiles.map(([label, shown, now, before, invert, foot, points]) => (
        <div className="adm-kpi" key={label}>
          <div className="adm-kpi__label"><span className="adm-eyebrow">{label}</span><Delta now={now} before={before} invert={invert} points={points} /></div>
          <strong className="tabular">{shown}</strong>
          <div className="adm-kpi__foot">{foot}</div>
        </div>
      ))}
    </div>
  );
}

const Axis = ({ colors, width = 34 }) => (
  <>
    <CartesianGrid vertical={false} stroke={colors.grid} />
    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
    <YAxis tickLine={false} axisLine={false} width={width} allowDecimals={false} tick={{ fill: colors.muted, fontSize: 11 }} />
  </>
);
const SeriesTable = ({ t, cols }) => (
  <table className="adm-table is-compact">
    <thead><tr><th>{t.unit === 'hour' ? 'Hour' : 'Day'}</th>{cols.map(([, l]) => <th key={l} className="num">{l}</th>)}</tr></thead>
    <tbody>{t.series.map((s) => <tr key={s.label}><td>{s.label}</td>{cols.map(([k, l]) => <td key={l} className="num">{s[k]}</td>)}</tr>)}</tbody>
  </table>
);

function Trend({ t, colors }) {
  return (
    <ChartCard title="Visitors" sub={`${t.current.visitors} people · ${t.current.visits} visits · by ${t.unit}`} table={<SeriesTable t={t} cols={[['visitors', 'Visitors'], ['views', 'Page views']]} />}>
      <div className="adm-chart" role="img" aria-label={`Area chart of visitors by ${t.unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={t.series} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
            <Axis colors={colors} />
            <Tooltip cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }} content={<Tip rows={(x) => [['Visitors', x.visitors, colors.c1], ['Page views', x.views]]} />} />
            <Area type="monotone" dataKey="visitors" stroke={colors.c1} strokeWidth={2} fill={colors.c1} fillOpacity={0.12} isAnimationActive={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function OrdersChart({ t, colors }) {
  return (
    <ChartCard title="Orders" sub={`${t.current.orders} orders · ${rs(t.current.revenue)}`} table={<SeriesTable t={t} cols={[['orders', 'Orders']]} />}>
      <div className="adm-chart" role="img" aria-label={`Bar chart of orders by ${t.unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={t.series} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
            <Axis colors={colors} width={28} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={<Tip rows={(x) => [['Orders', x.orders, colors.c2], ['Visitors', x.visitors]]} />} />
            <Bar dataKey="orders" fill={colors.c2} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Each step as a bar of the first step, with the share that made it from the step before. */
function Funnel({ t }) {
  const top = t.funnel[0]?.n || 0;
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">From visit to order</h2><p className="adm-muted">Visitors who reached each step</p></div></div>
      {top === 0 ? <p className="adm-muted">No visits in this period yet.</p> : (
        <div className="adm-bars">{t.funnel.map((f, i) => {
          const prev = i ? t.funnel[i - 1].n : f.n;
          return (
            <div key={f.key} className="adm-barrow" title={`${f.label}: ${f.n}`}>
              <span>{f.label}</span>
              <span className="adm-bartrack"><i style={{ width: `${(f.n / top) * 100}%` }} /></span>
              <b className="tabular">{f.n}{i > 0 && <span className="adm-muted" style={{ fontWeight: 500 }}> · {prev ? pct(f.n / prev) : '—'}</span>}</b>
            </div>
          );
        })}</div>
      )}
      {top > 0 && <p className="adm-muted" style={{ marginTop: 10 }}>The percentage is how many made it from the step before. The biggest drop is where to improve first.</p>}
    </section>
  );
}

function OrderStatuses({ t }) {
  const rows = STATUS_ORDER.map((s) => t.statuses.find((x) => x.status === s)).filter(Boolean);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Orders by status</h2><p className="adm-muted">Orders placed in this period, where they are now</p></div><Link className="adm-link" to="/admin/orders">All orders</Link></div>
      {rows.length === 0 ? <p className="adm-muted">No orders in this period.</p> : (
        <div className="adm-bars">{rows.map((r) => (
          <div key={r.status} className="adm-barrow" title={`${STATUS[r.status]?.[0] || r.status}: ${r.n}`}>
            <span>{STATUS[r.status]?.[0] || r.status}</span>
            <span className="adm-bartrack"><i style={{ width: `${(r.n / max) * 100}%`, background: ['cancelled', 'refunded', 'returned', 'rto'].includes(r.status) ? 'var(--c-prev)' : undefined }} /></span>
            <b className="tabular">{r.n} <span className="adm-muted" style={{ fontWeight: 500 }}>· {rsCompact(r.value)}</span></b>
          </div>
        ))}</div>
      )}
    </section>
  );
}

function Sources({ t }) {
  return (
    <section className="adm-card is-flush" style={{ marginBottom: 18 }}>
      <div className="adm-pad" style={{ paddingBottom: 0 }}><h2 className="adm-h2">Where visitors come from</h2>
        <p className="adm-muted">Add <code>?utm_source=instagram&amp;utm_campaign=diwali</code> to links in ads and posts to see each campaign here.</p></div>
      {t.sources.length === 0 ? <Empty title="No visits in this period" /> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Source</th><th className="num">Visitors</th><th className="num">Visits</th><th className="num">Orders</th><th className="num">Revenue</th><th className="num">Bought</th></tr></thead>
            <tbody>{t.sources.map((s) => (
              <tr key={s.source}>
                <td><strong>{srcLabel(s.source)}</strong>{s.medium && <span className="adm-sub">{s.medium}</span>}</td>
                <td className="num">{s.visitors}</td><td className="num">{s.visits}</td><td className="num">{s.orders}</td>
                <td className="num"><strong>{s.revenue ? rs(s.revenue) : '—'}</strong></td>
                <td className="num">{s.visitors ? pct(Math.min(1, s.orders / s.visitors)) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {t.campaigns.length > 0 && (
        <div className="adm-tablewrap">
          <table className="adm-table is-compact">
            <thead><tr><th>Campaign</th><th>Source</th><th className="num">Visitors</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
            <tbody>{t.campaigns.map((c) => <tr key={`${c.campaign}-${c.source}`}><td>{c.campaign}</td><td>{srcLabel(c.source)}</td><td className="num">{c.visitors}</td><td className="num">{c.orders}</td><td className="num">{c.revenue ? rs(c.revenue) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Devices({ t }) {
  const total = t.devices.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Devices</h2><p className="adm-muted">Visitors</p></div></div>
      {t.devices.length === 0 ? <p className="adm-muted">No data in this period.</p> : (
        <>
          <div className="adm-bars">{t.devices.map((x) => (
            <div key={x.name} className="adm-barrow"><span style={{ textTransform: 'capitalize' }}>{x.name}</span><span className="adm-bartrack"><i style={{ width: `${(x.n / total) * 100}%` }} /></span><b className="tabular">{pct(x.n / total)}</b></div>
          ))}</div>
          <p className="adm-muted" style={{ marginTop: 12 }}>Browsers: {t.browsers.map((b) => `${b.name} ${b.n}`).join(' · ')}</p>
        </>
      )}
    </section>
  );
}

function ProductTable({ t }) {
  return (
    <section className="adm-card is-flush" style={{ marginBottom: 18 }}>
      <div className="adm-pad" style={{ paddingBottom: 0 }}><h2 className="adm-h2">Product interest</h2>
        <p className="adm-muted">From first look to order. Low "viewed → cart" means the product page isn't convincing; views while out of stock are lost sales.</p></div>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr>
            <th>Product</th><th className="num">Views</th><th className="num">Viewers</th><th className="num">Clicks from lists</th><th className="num">Added to cart</th>
            <th className="num">Viewed → cart</th><th className="num">Orders</th><th className="num">Cart → order</th><th className="num">Saved</th><th className="num">Shared</th><th className="num">Views while out of stock</th>
          </tr></thead>
          <tbody>{t.products.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/admin/products/${p.id}`}><strong>{p.name}</strong></Link>{!p.active && <span className="adm-sub">hidden from the shop</span>}</td>
              <td className="num">{p.views}</td><td className="num">{p.viewers}</td><td className="num">{p.clicks}</td><td className="num">{p.adds}</td>
              <td className="num">{p.viewers ? pct(p.viewToCart) : '—'}</td><td className="num"><strong>{p.orders}</strong></td>
              <td className="num">{p.adders ? pct(p.cartToOrder) : '—'}</td>
              <td className="num" title={`${p.savedNow} signed-in customers have it saved now`}>{p.wishlist}</td><td className="num">{p.shares}</td>
              <td className="num"><span className={p.oosViews ? 'is-bad' : ''}>{p.oosViews || '—'}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Interested({ t }) {
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Interested, not bought yet</h2><p className="adm-muted">Signed-in customers who viewed products or added to cart in this period and haven't ordered since</p></div></div>
      {t.interested.length === 0 ? <p className="adm-muted">Nobody in this period.</p> : (
        <ol className="adm-list">{t.interested.map((c) => (
          <li key={c.id} className="adm-row">
            <span><Link to={`/admin/customers/${c.id}`}><strong>{c.name || 'Customer'}</strong></Link>
              <span className="adm-sub">{c.products.slice(0, 3).join(', ')}{c.products.length > 3 ? ` +${c.products.length - 3}` : ''}</span></span>
            <span className="tabular" style={{ textAlign: 'right' }}>{c.cartValue ? <>{rs(c.cartValue)} in cart</> : `${c.views} views`}
              <span className="adm-sub">{dt(c.lastAt)}{c.consent ? ' · reminders on' : ''}</span></span>
          </li>
        ))}</ol>
      )}
    </section>
  );
}

function Engagement({ t }) {
  const e = t.engagement;
  const rows = [
    ['Opened the Tulsi chat', e.chat_open], ['Tapped WhatsApp', e.whatsapp_click], ['Downloaded a brochure', e.brochure_download],
    ['Saved a product', e.wishlist_add], ['Shared a product', e.share], ['Online payment failed or closed', e.payment_failed],
  ];
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Other actions</h2><p className="adm-muted">Times in this period</p></div></div>
      <dl className="adm-kv">{rows.map(([l, n]) => <div key={l} style={{ display: 'contents' }}><dt>{l}</dt><dd className="tabular">{n || 0}</dd></div>)}</dl>
      {t.shareMethods.length > 0 && <p className="adm-muted" style={{ marginTop: 12 }}>Shared by: {t.shareMethods.map((s) => `${s.method === 'native' ? 'phone share sheet' : s.method === 'copy_link' ? 'copied link' : s.method} ${s.n}`).join(' · ')}</p>}
      {(e.payment_failed || 0) > 0 && <p className="adm-muted" style={{ marginTop: 8 }}>Customers with a failed payment can retry from their order page; their stock is held for 30 minutes.</p>}
    </section>
  );
}

const CART_TABS = [['abandoned', 'Abandoned'], ['checkout', 'Reached checkout'], ['active', 'Active now'], ['bought', 'Bought']];

function Carts() {
  const { staff } = useAdmin();
  const [status, setStatus] = useState('abandoned');
  const [who, setWho] = useState('all');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi(`/api/admin/carts?status=${status}&who=${who}&page=${page}`);
  const act = useAction();
  const remind = async (id) => { if (await act.run(() => api(`/api/admin/carts/${id}/remind`, { method: 'POST', body: {} }), 'Reminder sent.')) reload(); };
  return (
    <section className="adm-card is-flush">
      <div className="adm-pad" style={{ paddingBottom: 0 }}>
        <div className="adm-card__head"><div><h2 className="adm-h2"><ShoppingCart size={18} style={{ verticalAlign: -3 }} /> Carts</h2>
          <p className="adm-muted">Abandoned = items left for over an hour with no order. Only visitors who accepted analytics are listed; we can message signed-in customers who agreed to reminders.</p></div>
          <label className="adm-inline"><Users size={15} /><select value={who} onChange={(e) => { setWho(e.target.value); setPage(1); }}><option value="all">Everyone</option><option value="customers">Signed-in customers</option></select></label>
        </div>
        <div className="adm-tabs" role="tablist" aria-label="Cart status">
          {CART_TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={status === k} className={`adm-tab ${status === k ? 'is-on' : ''} ${k === 'abandoned' && data?.counts?.abandoned ? 'is-hot' : ''}`} onClick={() => { setStatus(k); setPage(1); }}>
              {l} <b>{data?.counts?.[k] ?? '…'}</b>
            </button>
          ))}
        </div>
        {status === 'abandoned' && data?.counts?.abandoned_value > 0 && <p className="adm-muted">{rs(data.counts.abandoned_value)} is sitting in abandoned carts.</p>}
        <ErrorBox>{error || act.error}</ErrorBox><Notice>{act.notice}</Notice>
        {data && !data.remindersReady && status !== 'bought' && <p className="adm-muted">To send reminders, set up customer messages (Settings → Connected services).</p>}
      </div>
      {!data ? <div className="adm-pad"><Loading /></div> : data.rows.length === 0 ? <Empty icon={ShoppingCart} title="No carts here" /> : (
        <>
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead><tr><th>Who</th><th>Items</th><th className="num">Value</th><th>Came from</th><th>Last change</th><th>{status === 'bought' ? 'Order' : 'Reminder'}</th></tr></thead>
              <tbody>{data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.customer_id ? <Link to={`/admin/customers/${r.customer_id}`}><strong>{r.customer}</strong></Link> : <span className="adm-muted">Visitor (not signed in)</span>}
                    {r.checkout_at && status !== 'checkout' && <span className="adm-sub">reached checkout</span>}</td>
                  <td>{r.items.map((i) => `${i.name.replace(/^TranzLife /, '')}${i.pack > 1 ? ` (pack of ${i.pack})` : ''} × ${i.qty}`).join(', ')}</td>
                  <td className="num"><strong>{rs(r.value)}</strong></td>
                  <td>{r.source ? srcLabel(r.source) : '—'}</td>
                  <td>{dt(r.updated_at)}</td>
                  <td>{status === 'bought' ? (r.order_number ? <Link to={`/admin/orders/${r.order_number}`}>{r.order_number}</Link> : '—')
                    : r.reminded_at ? <span className="adm-badge is-ok">Sent {d(r.reminded_at)}</span>
                    : r.customer_id && r.marketing_consent && can(staff, 'customers.edit') && data.remindersReady
                      ? <button className="adm-btn is-ghost is-sm" disabled={act.busy} onClick={() => remind(r.id)}><Send size={14} /> Remind</button>
                      : <span className="adm-muted">{!r.customer_id ? 'Not signed in' : !r.marketing_consent ? 'No consent' : '—'}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="adm-pad"><Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></div>
        </>
      )}
    </section>
  );
}
