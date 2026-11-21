import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRODUCTS, FORMATS } from '../data/products';
import { CONCERNS } from '../data/concerns';
import ProductCard from '../components/ProductCard';
import { Breadcrumbs, TrustRow, useTitle } from '../components/Common';

export default function Shop() {
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
    if (sort === 'low') l = [...l].sort((a, b) => a.price - b.price);
    if (sort === 'high') l = [...l].sort((a, b) => b.price - a.price);
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
      <section className="container shop">
        <aside className="filters" aria-label="Filters">
          <div className="filters__group">
            <h3>Concern</h3>
            <button className={!concern ? 'is-active' : ''} onClick={() => set('concern', '')}>All concerns</button>
            {CONCERNS.map((c) => (
              <button key={c.id} className={concern === c.id ? 'is-active' : ''} onClick={() => set('concern', c.id)}>{c.title}</button>
            ))}
          </div>
          <div className="filters__group">
            <h3>Format</h3>
            <button className={!format ? 'is-active' : ''} onClick={() => set('format', '')}>All formats</button>
            {FORMATS.map((f) => (
              <button key={f} className={format === f ? 'is-active' : ''} onClick={() => set('format', f)}>{f}</button>
            ))}
          </div>
        </aside>
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
