// Analytics & reports: sales over time, new vs returning, products (with return rates), where
// customers are, payments & RTO, return reasons, top customers. Downloadable as CSV.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Download, Table2, BarChart3 } from 'lucide-react';
import { Delta, Empty, ErrorBox, Loading, PageHead, rs, rsCompact, useAdmin, useApi, useChartColors } from '../ui';

const RANGES = [['30d', '30 days'], ['90d', '90 days'], ['365d', '12 months']];
const pct = (v) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;

export default function Analytics() {
  const { theme } = useAdmin();
  const colors = useChartColors(theme);
  const [range, setRange] = useState(() => { try { return localStorage.getItem('tl-admin-arange') || '30d'; } catch { return '30d'; } });
  const { data, error, loading } = useApi(`/api/admin/analytics?range=${range}`);
  const pick = (r) => { setRange(r); try { localStorage.setItem('tl-admin-arange', r); } catch { /* ignore */ } };

  return (
    <>
      <PageHead title="Analytics" sub="How sales, products and customers are doing. Compared with the period before.">
        <div className="adm-seg" role="group" aria-label="Period">{RANGES.map(([k, l]) => <button key={k} className={range === k ? 'is-on' : ''} aria-pressed={range === k} onClick={() => pick(k)}>{l}</button>)}</div>
        <Downloads range={range} />
      </PageHead>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <Kpis a={data} />
          <div className="adm-grid2" style={{ marginBottom: 18 }}>
            <SalesChart a={data} colors={colors} />
            <CustomerMixChart a={data} colors={colors} />
          </div>
          <Products a={data} />
          <div className="adm-grid3" style={{ marginBottom: 18 }}>
            <BarList title="Top states" sub="By revenue" rows={data.states.map((s) => ({ key: s.name, label: s.name, value: s.revenue, text: `${rsCompact(s.revenue)} · ${s.orders}` }))} />
            <BarList title="Top cities" sub="By revenue" rows={data.cities.map((s) => ({ key: s.name, label: s.name, value: s.revenue, text: `${rsCompact(s.revenue)} · ${s.orders}` }))} />
            <Payments a={data} colors={colors} />
          </div>
          <div className="adm-grid2">
            <BarList title="Why customers return" sub="Returns logged in this period" empty="No returns in this period." rows={data.returns.map((r) => ({ key: r.reason, label: r.label, value: r.n, text: String(r.n) }))} muted />
            <section className="adm-card">
              <div className="adm-card__head"><div><h2 className="adm-h2">Top customers</h2><p className="adm-muted">By spend in this period</p></div></div>
              {data.topCustomers.length === 0 ? <p className="adm-muted">No orders in this period.</p> : (
                <ol className="adm-list">{data.topCustomers.map((c, i) => (
                  <li key={c.id} className="adm-row"><span><b className="tabular" style={{ color: 'var(--muted)', marginRight: 8 }}>{i + 1}</b><Link to={`/admin/customers/${c.id}`}>{c.name}</Link></span><span className="tabular">{rs(c.spent)} <span className="adm-muted">· {c.orders} order{c.orders === 1 ? '' : 's'}</span></span></li>
                ))}</ol>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function Downloads({ range }) {
  return (
    <details className="adm-menu">
      <summary className="adm-btn is-ghost"><Download size={15} /> Download</summary>
      <div className="adm-pop" style={{ width: 230 }}>
        {[['sales', 'Sales by period'], ['products', 'Product performance'], ['customers', 'Top customers']].map(([k, l]) => (
          <a key={k} className="adm-result" href={`/api/admin/analytics.csv?range=${range}&report=${k}`}><Download size={15} /><span><strong>{l}</strong><span className="adm-sub">CSV, opens in Excel</span></span></a>
        ))}
      </div>
    </details>
  );
}

function Kpis({ a }) {
  const c = a.current, p = a.previous;
  const tiles = [
    ['Net revenue', rsCompact(c.netRevenue), c.netRevenue, p.netRevenue, false, `${rs(c.revenue)} sales − ${rs(c.refunds)} refunds`],
    ['Orders', c.orders, c.orders, p.orders, false, `${c.buyers} customer${c.buyers === 1 ? '' : 's'}`],
    ['Average order', rsCompact(c.aov), c.aov, p.aov, false, `was ${rsCompact(p.aov)}`],
    ['Repeat customers', pct(c.repeatRate), c.repeatRate, p.repeatRate, false, 'bought more than once', true],
    ['Returned to us (RTO)', pct(c.rtoRate), c.rtoRate, p.rtoRate, true, 'of shipped orders', true],
    ['Cancelled', pct(c.cancelRate), c.cancelRate, p.cancelRate, true, 'of orders placed', true],
  ];
  return (
    <div className="adm-kpis is-6">
      {tiles.map(([label, shown, now, before, invert, foot, points]) => (
        <div className="adm-kpi" key={label}>
          <div className="adm-kpi__label"><span className="adm-eyebrow">{label}</span><Delta now={now} before={before} invert={invert} points={points} /></div>
          <strong>{shown}</strong>
          <div className="adm-kpi__foot">{foot}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, sub, legend, table, children }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="adm-card">
      <div className="adm-card__head">
        <div><h2 className="adm-h2">{title}</h2>{sub && <p className="adm-muted">{sub}</p>}</div>
        <button className="adm-icon" onClick={() => setAsTable((v) => !v)} aria-label={asTable ? 'Show chart' : 'Show as table'} title={asTable ? 'Show chart' : 'Show as table'}>{asTable ? <BarChart3 size={18} /> : <Table2 size={18} />}</button>
      </div>
      {legend}
      {asTable ? <div className="adm-tablewrap" style={{ maxHeight: 280, marginTop: 8 }}>{table}</div> : children}
    </section>
  );
}

const Tip = ({ active, payload, label, rows }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <div className="adm-tip"><b>{label}</b>{rows(d).map(([name, v, color]) => <div key={name}><span>{color && <i style={{ background: color }} />}{name}</span><strong>{v}</strong></div>)}</div>;
};

function SalesChart({ a, colors }) {
  const total = a.series.reduce((s, x) => s + x.revenue, 0);
  return (
    <ChartCard title="Revenue" sub={`${rs(total)} · by ${a.unit}`}
      table={<table className="adm-table is-compact"><thead><tr><th>Period</th><th className="num">Revenue</th><th className="num">Orders</th></tr></thead><tbody>{a.series.map((s) => <tr key={s.label}><td>{s.label}</td><td className="num">{rs(s.revenue)}</td><td className="num">{s.orders}</td></tr>)}</tbody></table>}>
      <div className="adm-chart" role="img" aria-label={`Bar chart of revenue by ${a.unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={a.series} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={(v) => rsCompact(v)} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={<Tip rows={(d) => [['Revenue', rs(d.revenue), colors.c1], ['Orders', d.orders]]} />} />
            <Bar dataKey="revenue" fill={colors.c1} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function CustomerMixChart({ a, colors }) {
  const first = a.series.reduce((s, x) => s + x.first, 0), repeat = a.series.reduce((s, x) => s + x.repeat, 0);
  return (
    <ChartCard title="New vs returning orders" sub={`${first} first orders · ${repeat} from returning customers`}
      legend={<div className="adm-legend"><span><i className="is-sq" style={{ background: colors.c1 }} />First order</span><span><i className="is-sq" style={{ background: colors.c2 }} />Returning customer</span></div>}
      table={<table className="adm-table is-compact"><thead><tr><th>Period</th><th className="num">First</th><th className="num">Returning</th></tr></thead><tbody>{a.series.map((s) => <tr key={s.label}><td>{s.label}</td><td className="num">{s.first}</td><td className="num">{s.repeat}</td></tr>)}</tbody></table>}>
      <div className="adm-chart" role="img" aria-label="Stacked bar chart of first orders and orders from returning customers">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={a.series} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} tick={{ fill: colors.muted, fontSize: 11 }} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={<Tip rows={(d) => [['First order', d.first, colors.c1], ['Returning', d.repeat, colors.c2]]} />} />
            {/* 2px card-coloured stroke = the gap between stacked segments */}
            <Bar dataKey="first" stackId="m" fill={colors.c1} stroke="var(--card)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="repeat" stackId="m" fill={colors.c2} stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function Products({ a }) {
  const total = a.products.reduce((s, p) => s + p.revenue, 0) || 1;
  return (
    <section className="adm-card is-flush" style={{ marginBottom: 18 }}>
      <div className="adm-pad" style={{ paddingBottom: 0 }}><h2 className="adm-h2">Product performance</h2></div>
      {a.products.length === 0 ? <Empty title="No sales in this period" /> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Orders</th><th className="num">Revenue</th><th style={{ width: '22%' }}>Share of revenue</th><th className="num">Returned</th></tr></thead>
            <tbody>{a.products.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/admin/products/${p.id}`}><strong>{p.name}</strong></Link></td>
                <td className="num">{p.units}</td><td className="num">{p.orders}</td><td className="num"><strong>{rs(p.revenue)}</strong></td>
                <td><span className="adm-barrow" style={{ gridTemplateColumns: '1fr auto' }}><span className="adm-bartrack"><i style={{ width: `${(p.revenue / total) * 100}%` }} /></span><b>{pct(p.revenue / total)}</b></span></td>
                <td className="num"><span className={p.returnRate > 0.05 ? 'is-bad' : ''}>{p.returned ? `${p.returned} (${pct(p.returnRate)})` : '—'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BarList({ title, sub, rows, empty = 'No data in this period.', muted }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">{title}</h2>{sub && <p className="adm-muted">{sub}</p>}</div></div>
      {rows.length === 0 ? <p className="adm-muted">{empty}</p> : (
        <div className="adm-bars">{rows.map((r) => (
          <div key={r.key} className="adm-barrow" title={`${r.label}: ${r.text}`}>
            <span>{r.label}</span><span className="adm-bartrack"><i style={{ width: `${(r.value / max) * 100}%`, background: muted ? 'var(--c-prev)' : undefined }} /></span><b>{r.text}</b>
          </div>
        ))}</div>
      )}
    </section>
  );
}

function Payments({ a, colors }) {
  const p = a.payments, total = p.cod.orders + p.prepaid.orders;
  const share = total ? Math.round((p.prepaid.orders / total) * 100) : 0;
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Payments & returns to origin</h2><p className="adm-muted">RTO = parcel came back undelivered</p></div></div>
      {total === 0 ? <p className="adm-muted">No orders in this period.</p> : (
        <>
          <div className="adm-split" role="img" aria-label={`Prepaid ${share}%, cash on delivery ${100 - share}%`}>
            {p.prepaid.orders > 0 && <i style={{ width: `${share}%`, background: colors.c1 }} />}
            {p.cod.orders > 0 && <i style={{ width: `${100 - share}%`, background: colors.c2 }} />}
          </div>
          <div className="adm-split__legend">
            <div><i style={{ background: colors.c1 }} />Prepaid<b>{share}% · RTO {pct(p.prepaid.rtoRate)}</b></div>
            <div><i style={{ background: colors.c2 }} />Cash on delivery<b>{100 - share}% · RTO {pct(p.cod.rtoRate)}</b></div>
          </div>
          {p.cod.rtoRate > p.prepaid.rtoRate && p.cod.rto > 0 && <p className="adm-muted" style={{ marginTop: 10 }}>COD parcels come back more often. Nudging customers to prepay (the 5% discount) cuts these costs.</p>}
        </>
      )}
    </section>
  );
}
