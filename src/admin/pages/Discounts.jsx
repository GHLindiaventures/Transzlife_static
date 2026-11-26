// Discounts & campaigns: what each offer, pack discount and the prepaid discount cost and brought in,
// and which traffic sources / campaigns turn visits into orders. Real orders only.
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Zap, Tag } from 'lucide-react';
import { Delta, Empty, ErrorBox, Loading, PageHead, RangePicker, dt, rs, rsCompact, useAdmin, useApi, useChartColors, useRange } from '../ui';
import { ChartCard, Tip } from './Analytics';

const pct = (v) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const STATUS = { live: ['Live', 'ok'], scheduled: ['Scheduled', 'info'], ended: ['Ended', 'off'], off: ['Off', 'off'] };
const SOURCE = { direct: 'Direct', share: 'Shared links', google: 'Google', instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', youtube: 'YouTube' };
const offerText = (o) => (o.discountType === 'percent' ? `${o.value}% off` : o.discountType === 'flat' ? `${rs(o.value)} off` : `Price ${rs(o.value)}`);

export default function Discounts() {
  const { theme } = useAdmin();
  const colors = useChartColors(theme);
  const rng = useRange();
  const { data, error, loading } = useApi(`/api/admin/discounts?${rng.qs}`);
  return (
    <>
      <PageHead title="Discounts & campaigns" sub="What discounts cost, what they brought in, and which campaigns turn visits into orders.">
        <RangePicker value={rng} />
      </PageHead>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <Kpis d={data} />
          <div className="adm-grid2 is-wide-left" style={{ marginBottom: 20 }}>
            <PaidVsDiscount d={data} colors={colors} />
            <Breakdown d={data} colors={colors} />
          </div>
          <Offers d={data} />
          <div className="adm-grid2" style={{ marginBottom: 20 }}>
            <Packs d={data} />
            <Prepaid d={data} colors={colors} />
          </div>
          <Campaigns d={data} />
        </div>
      )}
    </>
  );
}

function Kpis({ d }) {
  const c = d.current, p = d.previous;
  const tiles = [
    ['Discounts given', rsCompact(c.given), c.given, p.given, true, `${pct(c.rate)} of the value before discounts`],
    ['Revenue', rsCompact(c.revenue), c.revenue, p.revenue, false, `${c.orders} orders`],
    ['Orders with a discount', pct(c.discountedShare), c.discountedShare, p.discountedShare, false, `${c.discountedOrders} of ${c.orders}`, true],
    ['Average order, discounted', rsCompact(c.aovDiscounted), c.aovDiscounted, p.aovDiscounted, false, `without a discount: ${rsCompact(c.aovFull)}`],
  ];
  return (
    <div className="adm-kpis">
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

function PaidVsDiscount({ d, colors }) {
  return (
    <ChartCard title="Paid vs discounted" sub="Together the bars are the value before discounts"
      legend={<div className="adm-legend"><span><i className="is-sq" style={{ background: colors.c1 }} />Paid by customers</span><span><i className="is-sq" style={{ background: colors.c2 }} />Discount given</span></div>}
      table={<table className="adm-table is-compact"><thead><tr><th>Period</th><th className="num">Paid</th><th className="num">Discount</th></tr></thead><tbody>{d.series.map((s) => <tr key={s.label}><td>{s.label}</td><td className="num">{rs(s.paid)}</td><td className="num">{rs(s.discount)}</td></tr>)}</tbody></table>}>
      <div className="adm-chart" role="img" aria-label="Stacked bar chart of amounts paid and discounts given">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.series} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={(v) => rsCompact(v)} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={<Tip rows={(x) => [['Paid', rs(x.paid), colors.c1], ['Discount', rs(x.discount), colors.c2]]} />} />
            <Bar dataKey="paid" stackId="v" fill={colors.c1} stroke="var(--card)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="discount" stackId="v" fill={colors.c2} stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function Breakdown({ d }) {
  const k = d.current.byKind, total = d.current.given || 1;
  const rows = [['Offers & flash sales', k.offer], ['Pack discounts', k.pack], ['Prepaid discount', k.prepaid]];
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Where the discount went</h2>
      {d.current.given === 0 ? <p className="adm-muted">No discounts in this period.</p> : (
        <div className="adm-bars">{rows.map(([l, v]) => (
          <div key={l} className="adm-barrow"><span>{l}</span><span className="adm-bartrack"><i style={{ width: `${(v / total) * 100}%` }} /></span><b className="tabular">{rsCompact(v)}</b></div>
        ))}</div>
      )}
      <p className="adm-muted" style={{ marginTop: 12 }}>Offer discount = regular price minus offer price. Pack and prepaid discounts are counted after that, so nothing is counted twice.</p>
    </section>
  );
}

function Offers({ d }) {
  return (
    <section className="adm-card is-flush" style={{ marginBottom: 20 }}>
      <div className="adm-pad" style={{ paddingBottom: 0 }}>
        <h2 className="adm-h2"><Zap size={17} /> Offers in this period</h2>
        <p className="adm-muted">"Sales lift" compares units sold per day of the offer's products while it ran with the same number of days just before. It is a guide, not proof: festivals and campaigns also move sales.</p>
      </div>
      {d.offers.length === 0 ? <Empty title="No offers ran in this period"><Link to="/admin/pricing">Create an offer</Link></Empty> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Offer</th><th>When</th><th className="num">Orders</th><th className="num">Units</th><th className="num">Revenue</th><th className="num">Discount given</th><th className="num">Revenue per ₹1 of discount</th><th className="num">Sales lift</th></tr></thead>
            <tbody>{d.offers.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.name}</strong> <span className={`adm-badge is-${STATUS[o.status][1]}`}>{STATUS[o.status][0]}</span>{o.kind === 'flash' && <span className="adm-badge is-warn" style={{ marginLeft: 4 }}>Flash</span>}
                  <span className="adm-sub">{offerText(o)}</span></td>
                <td><span className="adm-sub" style={{ marginTop: 0 }}>{dt(o.startsAt)}</span><span className="adm-sub">→ {dt(o.endsAt)}</span></td>
                <td className="num">{o.orders}</td><td className="num">{o.units}</td><td className="num"><strong>{rs(o.revenue)}</strong></td><td className="num">{rs(o.given)}</td>
                <td className="num">{o.perRupee == null ? '—' : `₹${o.perRupee.toFixed(1)}`}</td>
                <td className="num">{o.lift == null ? <span className="adm-muted" title="No sales of these products in the days before">—</span> : <span className={o.lift >= 0 ? 'is-ok' : 'is-bad'}>{o.lift >= 0 ? '▲' : '▼'} {pct(Math.abs(o.lift))}</span>}
                  <span className="adm-sub">{o.unitsPerDay.toFixed(1)}/day vs {o.unitsPerDayBefore.toFixed(1)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Packs({ d }) {
  return (
    <section className="adm-card">
      <h2 className="adm-h2"><Tag size={17} /> Pack sizes</h2>
      {d.packs.length === 0 ? <p className="adm-muted">No orders in this period.</p> : (
        <table className="adm-table is-compact">
          <thead><tr><th>Pack</th><th className="num">Orders</th><th className="num">Units</th><th className="num">Revenue</th><th className="num">Pack discount</th></tr></thead>
          <tbody>{d.packs.map((k) => <tr key={k.pack}><td>Pack of {k.pack}</td><td className="num">{k.orders}</td><td className="num">{k.units}</td><td className="num">{rs(k.revenue)}</td><td className="num">{k.given ? rs(k.given) : '—'}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

function Prepaid({ d, colors }) {
  const p = d.prepaid, total = p.cod.orders + p.prepaid.orders;
  const share = total ? Math.round((p.prepaid.orders / total) * 100) : 0;
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Prepaid discount</h2>
      {total === 0 ? <p className="adm-muted">No orders in this period.</p> : (
        <>
          <div className="adm-split" role="img" aria-label={`Prepaid ${share}%, cash on delivery ${100 - share}%`}>
            {p.prepaid.orders > 0 && <i style={{ width: `${share}%`, background: colors.c1 }} />}
            {p.cod.orders > 0 && <i style={{ width: `${100 - share}%`, background: colors.c2 }} />}
          </div>
          <div className="adm-split__legend">
            <div><i style={{ background: colors.c1 }} />Prepaid<b>{share}% · returned undelivered {pct(p.prepaid.rtoRate)}</b></div>
            <div><i style={{ background: colors.c2 }} />Cash on delivery<b>{100 - share}% · returned undelivered {pct(p.cod.rtoRate)}</b></div>
          </div>
          <p className="adm-muted" style={{ marginTop: 10 }}>Prepaid discount given: <strong>{rs(d.current.byKind.prepaid)}</strong>. It pays for itself when it moves orders away from cash on delivery, which comes back undelivered more often.</p>
        </>
      )}
    </section>
  );
}

function Campaigns({ d }) {
  return (
    <section className="adm-card is-flush">
      <div className="adm-pad" style={{ paddingBottom: 0 }}>
        <h2 className="adm-h2">Campaigns & traffic sources</h2>
        <p className="adm-muted">Tag links in ads and posts with <code>?utm_source=instagram&amp;utm_campaign=diwali</code> to see each campaign here. Only visitors who accepted analytics are counted.</p>
      </div>
      {d.campaigns.length === 0 ? <Empty title="No tracked visits in this period" /> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Source</th><th>Campaign</th><th className="num">Visitors</th><th className="num">Orders</th><th className="num">Bought</th><th className="num">Revenue</th><th className="num">Per visitor</th><th className="num">Discount on these orders</th></tr></thead>
            <tbody>{d.campaigns.map((c) => (
              <tr key={`${c.source}|${c.medium}|${c.campaign}`}>
                <td><strong>{SOURCE[c.source] || c.source}</strong>{c.medium && <span className="adm-sub">{c.medium}</span>}</td>
                <td>{c.campaign || <span className="adm-muted">—</span>}</td>
                <td className="num">{c.visitors}</td><td className="num">{c.orders}</td><td className="num">{pct(c.conversion)}</td>
                <td className="num"><strong>{c.revenue ? rs(c.revenue) : '—'}</strong></td><td className="num">{c.perVisitor ? rs(Math.round(c.perVisitor)) : '—'}</td>
                <td className="num">{c.given ? rs(c.given) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
