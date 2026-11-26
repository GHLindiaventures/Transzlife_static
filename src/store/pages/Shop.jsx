import { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PRODUCTS, FORMATS } from '../data/products';
import { useCatalog } from '../lib/catalog';
import { CONCERNS } from '../data/concerns';
import ProductCard from '../components/ProductCard';
import { Breadcrumbs, TrustRow, useTitle } from '../components/Common';
import '../styles/shop-nav.css';

/**
 * Category + format filters as a compact circular control on the left of the page.
 * Desktop: hover (or keyboard focus) reveals the full panel from the left and it folds away when the pointer leaves.
 * Touch: tap to open / close. The filters themselves are unchanged: they still set ?concern= and ?format=.
 */
function ShopNav({ concern, format, set }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const timer = useRef(null);
  const canHover = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const active = (concern ? 1 : 0) + (format ? 1 : 0);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = () => { if (!canHover()) return; clearTimeout(timer.current); setOpen(true); };
  const leave = () => { if (!canHover()) return; clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 220); };
  const pick = (k, v) => { set(k, v); if (!canHover()) setOpen(false); };

  return (
    <div className={`shopnav${open ? ' is-open' : ''}`} ref={box} onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" className="shopnav__btn" aria-expanded={open} aria-controls="shopnav-panel" aria-label="Browse by concern and format"
        onClick={() => setOpen((v) => !v)} onFocus={(e) => { if (e.target.matches(':focus-visible')) setOpen(true); }}>
        {open ? <X size={22} aria-hidden="true" /> : <SlidersHorizontal size={22} aria-hidden="true" />}
        <span className="shopnav__label">Browse</span>
        {active > 0 && <span className="shopnav__count" aria-label={`${active} filter${active > 1 ? 's' : ''} applied`}>{active}</span>}
      </button>
      <aside className="shopnav__panel" id="shopnav-panel" aria-label="Filters" aria-hidden={!open} inert={!open ? '' : undefined}>
        <div className="filters__group">
          <h3>Concern</h3>
          <button className={!concern ? 'is-active' : ''} onClick={() => pick('concern', '')}>All concerns</button>
          {CONCERNS.map((c) => (
            <button key={c.id} className={concern === c.id ? 'is-active' : ''} onClick={() => pick('concern', c.id)}>{c.title}</button>
          ))}
        </div>
        <div className="filters__group">
          <h3>Format</h3>
          <button className={!format ? 'is-active' : ''} onClick={() => pick('format', '')}>All formats</button>
          {FORMATS.map((f) => (
            <button key={f} className={format === f ? 'is-active' : ''} onClick={() => pick('format', f)}>{f}</button>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function Shop() {
  useCatalog();
  useTitle('Shop all products');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const concern = params.get('concern') || '';
  const format = params.get('format') || '';
  const sort = params.get('sort') || 'featured';

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => {
    let l = PRODUCTS.filter((p) => {
      if (q && !(p.name + p.tagline + p.format + p.summary).toLowerCase().includes(q.toLowerCase())) return false;
      if (concern && !p.concerns.includes(concern)) return false;
      if (format && !p.format.toLowerCase().includes(format.toLowerCase())) return false;
      return true;
    });
    // products without a price yet go last either way
    if (sort === 'low') l = [...l].sort((a, b) => (a.price > 0 ? a.price : Infinity) - (b.price > 0 ? b.price : Infinity));
    if (sort === 'high') l = [...l].sort((a, b) => (b.price > 0 ? b.price : -Infinity) - (a.price > 0 ? a.price : -Infinity));
    return l;
  }, [q, concern, format, sort]);

  return (
    <>
      <section className="shop-hero">
        <div className="container">
          <Breadcrumbs items={[['Shop']]} />
          <h1>{q ? `Results for “${q}”` : 'Shop all products'}</h1>
          <p>Plant-powered wellness for energy, breathing, liver, period comfort and everyday calm.</p>
        </div>
      </section>
      <section className="container shop shop--solo">
        <ShopNav concern={concern} format={format} set={set} />
        <div>
          <div className="shop__bar">
            <p>{list.length} product{list.length === 1 ? '' : 's'}</p>
            {(q || concern || format) && <button className="link-btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
            <label className="shop__sort">
              Sort
              <select value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? '' : e.target.value)}>
                <option value="featured">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </label>
          </div>
          {list.length ? (
            <div className="grid-products grid-products--3">
              {list.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="empty">
              <p>No products match these filters.</p>
              <button className="btn" onClick={() => setParams({}, { replace: true })}>Show all products</button>
            </div>
          )}
        </div>
      </section>
      <section className="section section--tight">
        <div className="container"><TrustRow /></div>
      </section>
    </>
  );
}
