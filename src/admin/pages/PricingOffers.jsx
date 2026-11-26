// Pricing & offers: regular prices and MRP, scheduled offers / flash sales, product badges, pack discounts.
// Rules enforced by the server (server/shop/offers.js): selling price never above the MRP; offers only lower
// prices; the struck-through price on the site is the MRP; badges only claim what is true.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Zap, Tag, Clock, Pencil, Power, Trash2, Save, Info, Package } from 'lucide-react';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

const STATUS = { live: ['Live', 'ok'], scheduled: ['Scheduled', 'info'], ended: ['Ended', 'off'], off: ['Off', 'off'] };
const toInput = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromInput = (v) => new Date(v).toISOString();
const discountText = (o) => (o.discountType === 'percent' ? `${o.value}% off` : o.discountType === 'flat' ? `${rs(o.value)} off` : `Price ${rs(o.value)}`);

export default function PricingOffers() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/pricing');
  const [editing, setEditing] = useState(null);   // null | 'new' | offer
  const edit = can(staff, 'products.edit');
  return (
    <>
      <PageHead title="Pricing & offers" sub="What customers pay. The crossed-out price on the site is always the MRP on the pack; offers only lower the selling price.">
        {edit && <button className="adm-btn" onClick={() => setEditing('new')}><Plus size={16} /> New offer</button>}
      </PageHead>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div className="adm-grid2 is-wide-left">
          <div className="adm-stack" style={{ marginBottom: 0 }}>
            <ProductPrices data={data} edit={edit} onSaved={reload} />
            <PackDiscounts packs={data.packs} owner={can(staff, 'settings')} onSaved={reload} />
          </div>
          <div className="adm-stack" style={{ marginBottom: 0 }}>
            {editing && <OfferForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} data={data} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />}
            <OfferList offers={data.offers} edit={edit} onEdit={setEditing} onChanged={reload} />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- product prices and badges ---------- */
function ProductPrices({ data, edit, onSaved }) {
  return (
    <section className="adm-card is-flush">
      <div className="adm-pad" style={{ paddingBottom: 0 }}>
        <h2 className="adm-h2"><Tag size={17} /> Prices & badges</h2>
        <p className="adm-muted">Best seller and Trending badges are given automatically from real sales and views. Offer badges (Hot deal, Limited offer, Special discount) show only while an offer runs.</p>
      </div>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Product</th><th className="num">MRP (₹)</th><th className="num">Selling price (₹)</th><th className="num">Customers pay now</th><th>Badge</th><th /></tr></thead>
          <tbody>{data.products.map((p) => <PriceRow key={p.id} p={p} data={data} edit={edit} onSaved={onSaved} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function PriceRow({ p, data, edit, onSaved }) {
  const [mrp, setMrp] = useState(p.mrp / 100);
  const [price, setPrice] = useState(p.price / 100);
  // the badge as staff last chose it (a switched-off or automatic-only badge shows as "No badge")
  const startBadge = useMemo(() => (p.badge?.key && data.manualBadges.includes(p.badge.key) && p.badge.enabled ? p.badge : { key: '', enabled: false, auto: p.badge?.auto }), [p.badge, data.manualBadges]);
  const [badge, setBadge] = useState(startBadge);
  const act = useAction();
  const dirty = toPaise(mrp) !== p.mrp || toPaise(price) !== p.price || JSON.stringify(badge) !== JSON.stringify(startBadge);
  const over = toPaise(price) > toPaise(mrp);
  const save = async () => {
    // no badge but automatic ones switched off: stored as a disabled badge that only carries auto: false
    const body = { mrp: toPaise(mrp), price: toPaise(price), badge: badge.key ? { ...badge, enabled: true } : (badge.auto === false ? { key: 'custom', text: 'off', enabled: false, auto: false } : null) };
    if (await act.run(() => api(`/api/admin/pricing/${p.id}`, { method: 'PATCH', body }), 'Saved.')) onSaved();
  };
  const off = p.effective < p.mrp ? Math.round((1 - p.effective / p.mrp) * 100) : 0;
  return (
    <tr>
      <td><Link to={`/admin/products/${p.id}`}><strong>{p.short || p.name}</strong></Link>{!p.active && <span className="adm-sub">Hidden from the shop</span>}
        {(p.auto.bestSeller || p.auto.trending) && <span className="adm-sub">Auto: {[p.auto.bestSeller && 'best seller', p.auto.trending && 'trending'].filter(Boolean).join(', ')}</span>}</td>
      <td className="num"><input type="number" min="1" step="1" value={mrp} onChange={(e) => setMrp(e.target.value)} disabled={!edit} aria-label={`MRP of ${p.name}`} style={{ width: 92, textAlign: 'right' }} /></td>
      <td className="num"><input type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!edit} aria-label={`Selling price of ${p.name}`} aria-invalid={over || undefined} style={{ width: 92, textAlign: 'right' }} />
        {over && <span className="adm-sub is-bad">Above MRP</span>}</td>
      <td className="num"><strong>{rs(p.effective)}</strong>{off > 0 && <span className="adm-sub">{off}% below MRP</span>}
        {p.offer && <span className="adm-sub"><Clock size={11} style={{ verticalAlign: -1 }} /> {p.offer.name}, ends {dt(p.offer.endsAt)}</span>}</td>
      <td>
        <BadgeEditor value={badge} onChange={setBadge} data={data} disabled={!edit} />
        {p.shownBadge ? <span className="adm-sub">Showing: <span className="adm-badgepill" style={{ background: p.shownBadge.bg, color: p.shownBadge.fg }}>{p.shownBadge.text}</span></span>
          : p.badgeProblem ? <span className="adm-sub"><Info size={11} style={{ verticalAlign: -1 }} /> {p.badgeProblem}</span> : null}
      </td>
      <td>{edit && <button className="adm-btn is-sm" disabled={!dirty || over || act.busy} onClick={save}><Save size={14} /> Save</button>}
        <ErrorBox>{act.error}</ErrorBox>{act.notice && <span className="adm-sub is-ok">{act.notice}</span>}</td>
    </tr>
  );
}

function BadgeEditor({ value, onChange, data, disabled }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 180 }}>
      <select value={value.key || ''} disabled={disabled} onChange={(e) => onChange({ ...value, key: e.target.value, tone: value.tone || data.badges[e.target.value]?.tone, startsAt: undefined })} aria-label="Badge">
        <option value="">No badge (automatic only)</option>
        {data.manualBadges.map((k) => <option key={k} value={k}>{k === 'custom' ? 'Custom text…' : data.badges[k].text}{data.badges[k].needsOffer ? ' (while an offer runs)' : k === 'new_arrival' ? ' (30 days)' : ''}</option>)}
      </select>
      {value.key === 'custom' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={value.text || ''} maxLength={18} placeholder="Badge text" onChange={(e) => set('text', e.target.value)} disabled={disabled} aria-label="Badge text" />
          <select value={value.tone || 'forest'} onChange={(e) => set('tone', e.target.value)} disabled={disabled} aria-label="Badge colour">
            {Object.keys(data.tones).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      <label className="adm-check" style={{ fontSize: 12 }}><input type="checkbox" checked={value.auto !== false} disabled={disabled} onChange={(e) => set('auto', e.target.checked)} /> Allow automatic badges</label>
    </div>
  );
}

/* ---------- offers ---------- */
function OfferList({ offers, edit, onEdit, onChanged }) {
  const act = useAction();
  const groups = [['live', 'Running now'], ['scheduled', 'Scheduled'], ['ended', 'Ended or switched off']];
  const toggle = async (o) => {
    const body = { name: o.name, kind: o.kind, productIds: o.productIds, discountType: o.discountType, value: o.value, startsAt: o.startsAt, endsAt: o.endsAt, active: !o.active, showCountdown: o.showCountdown, badge: o.badge };
    if (await act.run(() => api(`/api/admin/offers/${o.id}`, { method: 'PATCH', body }), o.active ? 'Switched off.' : 'Switched on.')) onChanged();
  };
  const remove = async (o) => { if (confirm(`Delete "${o.name}"? It has not started yet.`) && await act.run(() => api(`/api/admin/offers/${o.id}`, { method: 'DELETE', body: {} }), 'Deleted.')) onChanged(); };
  return (
    <section className="adm-card">
      <h2 className="adm-h2"><Zap size={17} /> Offers & flash sales</h2>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      {offers.length === 0 && <p className="adm-muted">No offers yet. Create one to lower prices for a set time; prices go back on their own when it ends.</p>}
      {groups.map(([g, title]) => {
        const list = offers.filter((o) => (g === 'ended' ? o.status === 'ended' || o.status === 'off' : o.status === g));
        if (!list.length) return null;
        return (
          <div key={g} style={{ marginTop: 14 }}>
            <p className="adm-eyebrow" style={{ marginBottom: 8 }}>{title}</p>
            <ul className="adm-list">{list.map((o) => (
              <li key={o.id} className="adm-offer">
                <div>
                  <strong>{o.name}</strong> <span className={`adm-badge is-${STATUS[o.status][1]}`}>{STATUS[o.status][0]}</span>{o.kind === 'flash' && <span className="adm-badge is-warn" style={{ marginLeft: 4 }}><Zap size={11} /> Flash</span>}
                  <span className="adm-sub">{discountText(o)} · {o.products.join(', ')}</span>
                  <span className="adm-sub">{dt(o.startsAt)} → {dt(o.endsAt)}{o.showCountdown ? ' · countdown shown' : ''}</span>
                  {o.used.orders > 0 && <span className="adm-sub">{o.used.orders} order{o.used.orders === 1 ? '' : 's'} · {rs(o.used.given)} given in discounts</span>}
                </div>
                {edit && (
                  <div className="adm-rowbtns" style={{ display: 'flex', gap: 4 }}>
                    <button className="adm-icon" title="Edit" aria-label={`Edit ${o.name}`} onClick={() => onEdit(o)}><Pencil size={15} /></button>
                    {o.status !== 'ended' && <button className="adm-icon" title={o.active ? 'Switch off' : 'Switch on'} aria-label={o.active ? `Switch off ${o.name}` : `Switch on ${o.name}`} onClick={() => toggle(o)} disabled={act.busy}><Power size={15} /></button>}
                    {o.status === 'scheduled' && <button className="adm-icon" title="Delete" aria-label={`Delete ${o.name}`} onClick={() => remove(o)} disabled={act.busy}><Trash2 size={15} /></button>}
                  </div>
                )}
              </li>
            ))}</ul>
          </div>
        );
      })}
    </section>
  );
}

function OfferForm({ initial, data, onDone, onCancel }) {
  const now = Date.now();
  const [f, setF] = useState(() => initial ? {
    name: initial.name, kind: initial.kind, productIds: initial.productIds, discountType: initial.discountType,
    value: initial.discountType === 'percent' ? initial.value : initial.value / 100, startsAt: toInput(initial.startsAt), endsAt: toInput(initial.endsAt),
    active: initial.active, showCountdown: initial.showCountdown, badge: initial.badge || '',
  } : { name: '', kind: 'sale', productIds: [], discountType: 'percent', value: 10, startsAt: toInput(now), endsAt: toInput(now + 7 * 86400000), active: true, showCountdown: false, badge: '' });
  const [preview, setPreview] = useState(null);
  const act = useAction();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const body = useMemo(() => ({
    name: f.name.trim() || 'Preview', kind: f.kind, productIds: f.productIds, discountType: f.discountType,
    value: f.discountType === 'percent' ? Number(f.value) : toPaise(f.value), startsAt: f.startsAt ? fromInput(f.startsAt) : '', endsAt: f.endsAt ? fromInput(f.endsAt) : '',
    active: f.active, showCountdown: f.showCountdown, badge: f.badge || null,
  }), [f]);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api('/api/admin/offers/preview', { method: 'POST', body }).then((r) => setPreview({ prices: r.prices })).catch((e) => setPreview({ error: e.message }));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [body]);
  const submit = async (e) => {
    e.preventDefault();
    const r = await act.run(() => api(initial ? `/api/admin/offers/${initial.id}` : '/api/admin/offers', { method: initial ? 'PATCH' : 'POST', body: { ...body, name: f.name.trim() } }));
    if (r) onDone();
  };
  const all = f.productIds.length === 0;
  return (
    <section className="adm-card adm-offerform">
      <h2 className="adm-h2">{initial ? 'Edit offer' : 'New offer'}</h2>
      <form className="adm-form" onSubmit={submit}>
        <label>Name customers see<input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder="e.g. Diwali offer" required /></label>
        <div className="adm-seg" role="group" aria-label="Kind">
          <button type="button" className={f.kind === 'sale' ? 'is-on' : ''} onClick={() => set('kind', 'sale')}><Tag size={14} /> Sale</button>
          <button type="button" className={f.kind === 'flash' ? 'is-on' : ''} onClick={() => setF((x) => ({ ...x, kind: 'flash', showCountdown: true, endsAt: x.startsAt ? toInput(Date.parse(fromInput(x.startsAt)) + 86400000) : x.endsAt }))}><Zap size={14} /> Flash sale</button>
        </div>
        <fieldset className="adm-fieldset">
          <legend>Products</legend>
          <label className="adm-check"><input type="checkbox" checked={all} onChange={(e) => set('productIds', e.target.checked ? [] : data.products.filter((p) => p.active).map((p) => p.id))} /> All products</label>
          {!all && <div className="adm-chips">{data.products.filter((p) => p.active).map((p) => {
            const on = f.productIds.includes(p.id);
            return <button type="button" key={p.id} className={`adm-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set('productIds', on ? f.productIds.filter((x) => x !== p.id) : [...f.productIds, p.id])}>{p.short || p.name}</button>;
          })}</div>}
        </fieldset>
        <div className="adm-pair">
          <label>Discount
            <select value={f.discountType} onChange={(e) => set('discountType', e.target.value)}>
              <option value="percent">% off the selling price</option><option value="flat">₹ off the selling price</option><option value="price">Fixed offer price (₹)</option>
            </select>
          </label>
          <label>{f.discountType === 'percent' ? 'Percent (1–90)' : 'Amount (₹)'}<input type="number" min="1" max={f.discountType === 'percent' ? 90 : undefined} step="1" value={f.value} onChange={(e) => set('value', e.target.value)} required /></label>
        </div>
        <div className="adm-pair">
          <label>Starts<input type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} required /></label>
          <label>Ends<input type="datetime-local" value={f.endsAt} min={f.startsAt} onChange={(e) => set('endsAt', e.target.value)} required /></label>
        </div>
        <label>Badge while it runs
          <select value={f.badge} onChange={(e) => set('badge', e.target.value)}>
            <option value="">None</option>{data.offerBadges.map((k) => <option key={k} value={k}>{data.badges[k].text}</option>)}
          </select>
        </label>
        <label className="adm-check"><input type="checkbox" checked={f.showCountdown} onChange={(e) => set('showCountdown', e.target.checked)} /> Show a countdown to the real end time (last 7 days)</label>
        <label className="adm-check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Switched on</label>

        <div className="adm-preview">
          <p className="adm-eyebrow">What customers will pay</p>
          {preview?.error ? <p className="adm-muted">{preview.error}</p> : !preview ? <p className="adm-muted">…</p> : (
            <table className="adm-table is-compact"><tbody>{preview.prices.map((x) => (
              <tr key={x.id}><td>{x.name}</td><td className="num"><s className="adm-muted">{rs(x.mrp)}</s></td><td className="num"><strong>{rs(x.price)}</strong></td>
                <td className="num">{x.noEffect ? <span className="adm-muted">no change</span> : `${x.offPct}% below MRP`}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <ErrorBox>{act.error}</ErrorBox>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn" disabled={act.busy}>{initial ? 'Save offer' : 'Create offer'}</button>
          <button type="button" className="adm-btn is-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

/* ---------- pack discounts ---------- */
function PackDiscounts({ packs, owner, onSaved }) {
  const [rows, setRows] = useState(packs);
  const act = useAction();
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    const body = { packs: rows.map((r) => ({ qty: Number(r.qty), label: r.label.trim(), discountPct: Number(r.discountPct) })) };
    if (await act.run(() => api('/api/admin/packs', { method: 'PUT', body }), 'Pack discounts saved. The site and checkout use them now.')) onSaved();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2"><Package size={17} /> Pack discounts</h2>
      <p className="adm-muted" style={{ marginBottom: 12 }}>Extra discount for buying several of the same product. Applies on top of a running offer; the prepaid discount (Settings) applies after that.</p>
      <table className="adm-table is-compact">
        <thead><tr><th>Pack size</th><th>Label</th><th className="num">Discount %</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td><input type="number" min="1" max="12" value={r.qty} onChange={(e) => set(i, 'qty', e.target.value)} disabled={!owner || Number(r.qty) === 1 && i === 0} style={{ width: 70 }} aria-label="Pack size" /></td>
            <td><input value={r.label} onChange={(e) => set(i, 'label', e.target.value)} disabled={!owner} maxLength={30} aria-label="Label" /></td>
            <td className="num"><input type="number" min="0" max="50" step="0.5" value={r.discountPct} onChange={(e) => set(i, 'discountPct', e.target.value)} disabled={!owner || Number(r.qty) === 1} style={{ width: 80, textAlign: 'right' }} aria-label="Discount percent" /></td>
            <td>{owner && Number(r.qty) !== 1 && <button className="adm-icon" aria-label="Remove pack size" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}</td>
          </tr>
        ))}</tbody>
      </table>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      {owner ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {rows.length < 6 && <button className="adm-btn is-ghost is-sm" onClick={() => setRows([...rows, { qty: Math.max(...rows.map((r) => Number(r.qty))) + 1, label: '', discountPct: 0 }])}><Plus size={14} /> Add pack size</button>}
          <button className="adm-btn is-sm" disabled={act.busy} onClick={save}><Save size={14} /> Save packs</button>
        </div>
      ) : <p className="adm-muted">Only an owner can change pack discounts.</p>}
    </section>
  );
}
