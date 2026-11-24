// Catalogue: every product with photo, price, stock health, days of stock left, sales trend,
// next batch expiry and listing completeness. Click a product to edit it.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Leaf, Search, X, CalendarClock } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Empty, ErrorBox, Loading, PageHead, Sparkline, can, d, rs, toPaise, useAction, useAdmin, useApi, useChartColors } from '../ui';

export const health = (p) => (p.available <= 0 ? 'out' : p.available <= p.low_stock_at ? 'low' : 'ok');
const HEALTH = { ok: ['In stock', 'ok'], low: ['Running low', 'warn'], out: ['Out of stock', 'bad'] };
const daysTo = (date) => (date ? Math.round((new Date(date) - new Date(new Date().toDateString())) / 86400000) : null);

const FILTERS = [
  ['all', 'All', () => true], ['active', 'On sale', (p) => p.active], ['hidden', 'Hidden', (p) => !p.active],
  ['low', 'Running low', (p) => health(p) === 'low'], ['out', 'Out of stock', (p) => health(p) === 'out'],
  ['expiring', 'Expiring soon', (p) => { const n = daysTo(p.next_expiry); return n != null && n <= 90; }],
  ['incomplete', 'Needs details', (p) => p.completeness.score < 100],
];

export function Completeness({ score, size = 'sm' }) {
  const tone = score >= 90 ? 'ok' : score >= 60 ? 'warn' : 'bad';
  return (
    <span className={`adm-meter is-${tone} is-${size}`} title={`Listing ${score}% complete`}>
      <span className="adm-meter__track"><i style={{ width: `${score}%` }} /></span><b>{score}%</b>
    </span>
  );
}

export default function Products() {
  const { staff, theme } = useAdmin();
  const colors = useChartColors(theme);
  const navigate = useNavigate();
  const { data, error } = useApi('/api/admin/products');
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const [view, setView] = useState(() => { try { return localStorage.getItem('tl-admin-products-view') || 'grid'; } catch { return 'grid'; } });
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const pickView = (v) => { setView(v); try { localStorage.setItem('tl-admin-products-view', v); } catch { /* ignore */ } };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const counts = Object.fromEntries(FILTERS.map(([k, , fn]) => [k, data.products.filter(fn).length]));
  const fn = (FILTERS.find(([k]) => k === filter) || FILTERS[0])[2];
  const shown = data.products.filter(fn).filter((p) => !q || `${p.name} ${p.id} ${p.format}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="Products & stock" sub="Click a product to edit its details, photos, price, stock and batches.">
        <div className="adm-seg" role="group" aria-label="View">
          <button className={view === 'grid' ? 'is-on' : ''} onClick={() => pickView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><LayoutGrid size={15} /></button>
          <button className={view === 'list' ? 'is-on' : ''} onClick={() => pickView('list')} aria-label="List view" aria-pressed={view === 'list'}><List size={15} /></button>
        </div>
        {can(staff, 'products.edit') && <button className="adm-btn" onClick={() => setAdding(true)}><Plus size={16} /> Add product</button>}
      </PageHead>

      <div className="adm-filters">
        <form onSubmit={(e) => e.preventDefault()}><Search size={16} /><input type="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" /></form>
      </div>
      <div className="adm-chips" role="group" aria-label="Filter">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`adm-chip ${filter === k ? 'is-on' : ''}`} aria-pressed={filter === k} onClick={() => setParams(k === 'all' ? {} : { filter: k })}>{label} <b>{counts[k]}</b></button>
        ))}
      </div>

      {shown.length === 0 ? <section className="adm-card"><Empty icon={Leaf} title="No products here">{filter !== 'all' && <button className="adm-link" onClick={() => setParams({})}>Show all products</button>}</Empty></section>
        : view === 'grid' ? (
          <div className="adm-pgrid">
            {shown.map((p) => {
              const [hl, ht] = HEALTH[health(p)];
              const exp = daysTo(p.next_expiry);
              return (
                <Link key={p.id} to={`/admin/products/${p.id}`} className="adm-pcard">
                  <span className="adm-pcard__img">
                    {p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <Leaf size={34} strokeWidth={1.3} />}
                    <span className={`adm-badge ${p.active ? 'is-ok' : 'is-off'}`}>{p.active ? 'On sale' : 'Hidden'}</span>
                  </span>
                  <span className="adm-pcard__body">
                    <strong>{p.name}</strong>
                    <span className="adm-sub">{[p.format, p.size].filter(Boolean).join(' · ')}</span>
                    <span className="adm-pcard__price">{rs(p.price)}{p.mrp > p.price && <s>{rs(p.mrp)}</s>}</span>
                    <span className="adm-pcard__row"><span className={`adm-badge is-${ht}`}>{hl}</span><span className="adm-muted">{p.available} available{p.days_left != null && p.available > 0 ? ` · ~${p.days_left} days` : ''}</span></span>
                    <span className="adm-pcard__row"><span className="adm-muted">Sold {p.sold_30d} in 30 days</span></span>
                    <Sparkline values={p.spark} color={colors.c1} />
                    <span className="adm-pcard__row">
                      <Completeness score={p.completeness.score} />
                      {exp != null && <span className={`adm-muted ${exp <= 30 ? 'is-bad' : exp <= 90 ? 'is-warn' : ''}`} title={`Next batch expires ${d(p.next_expiry)}`}><CalendarClock size={13} style={{ verticalAlign: '-2px' }} /> {exp}d</span>}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <section className="adm-card is-flush">
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Product</th><th className="num">Price</th><th className="num">Available</th><th className="num">Days left</th><th>Sold (30 days)</th><th>Next expiry</th><th>Listing</th><th>Status</th></tr></thead>
                <tbody>{shown.map((p) => {
                  const [hl, ht] = HEALTH[health(p)];
                  const exp = daysTo(p.next_expiry);
                  return (
                    <tr key={p.id} className="is-click" onClick={() => navigate(`/admin/products/${p.id}`)}>
                      <td><span className="adm-prow"><span className="adm-prow__img">{p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <Leaf size={18} />}</span><span><strong>{p.name}</strong><span className="adm-sub">{p.size}</span></span></span></td>
                      <td className="num">{rs(p.price)}{p.mrp > p.price && <span className="adm-sub"><s>{rs(p.mrp)}</s></span>}</td>
                      <td className="num">{p.available}<span className="adm-sub"><span className={`adm-badge is-${ht}`}>{hl}</span></span></td>
                      <td className="num">{p.days_left != null && p.available > 0 ? `~${p.days_left}` : '—'}</td>
                      <td style={{ minWidth: 140 }}><span className="adm-row" style={{ flexWrap: 'nowrap' }}><b className="num">{p.sold_30d}</b><span style={{ width: 90 }}><Sparkline values={p.spark} color={colors.c1} /></span></span></td>
                      <td>{p.next_expiry ? <span className={exp <= 30 ? 'is-bad' : exp <= 90 ? 'is-warn' : ''}>{d(p.next_expiry)}<span className="adm-sub">{exp} days</span></span> : <span className="adm-muted">No batches</span>}</td>
                      <td><Completeness score={p.completeness.score} /></td>
                      <td><span className={`adm-badge ${p.active ? 'is-ok' : 'is-off'}`}>{p.active ? 'On sale' : 'Hidden'}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
        )}
      {adding && <AddProduct onClose={() => setAdding(false)} onCreated={(id) => navigate(`/admin/products/${id}`)} />}
    </>
  );
}

function AddProduct({ onClose, onCreated }) {
  const act = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await act.run(() => api('/api/admin/products', { method: 'POST', body: { name: f.name, format: f.format, size: f.size, price: toPaise(f.price), mrp: toPaise(f.mrp || f.price) } }));
    if (r) onCreated(r.id);
  };
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <form className="adm-palette adm-modal" onSubmit={submit} role="dialog" aria-label="Add a product">
        <div className="adm-drawer__head"><h2 style={{ flex: 1 }}>Add a product</h2><button type="button" className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="adm-form adm-pad">
          <p className="adm-muted">It starts hidden. Add photos, details and stock, then switch it on sale.</p>
          <label>Product name<input name="name" required minLength={2} maxLength={120} autoFocus placeholder="e.g. Ashwagandha Calm Tablets" /></label>
          <div className="adm-pair">
            <label>Format<input name="format" maxLength={40} placeholder="e.g. Tablets" list="adm-formats" /></label>
            <label>Pack size<input name="size" maxLength={40} placeholder="e.g. 60 tablets" /></label>
          </div>
          <datalist id="adm-formats"><option>Gummies</option><option>Oral liquid</option><option>Roll-On</option><option>Massage Roll-On</option><option>Inhaler</option><option>Tablets</option><option>Capsules</option><option>Powder</option><option>Oil</option></datalist>
          <div className="adm-pair">
            <label>Selling price (₹)<input name="price" type="number" min="1" step="1" required /></label>
            <label>MRP (₹)<input name="mrp" type="number" min="1" step="1" placeholder="Same as price" /></label>
          </div>
          <ErrorBox>{act.error}</ErrorBox>
          <button className="adm-btn" disabled={act.busy}>{act.busy ? 'Creating…' : 'Create and continue'}</button>
        </div>
      </form>
    </>
  );
}
