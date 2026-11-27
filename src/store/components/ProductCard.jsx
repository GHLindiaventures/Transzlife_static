import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart, packPrice } from '../context/CartContext';
import { PACKS, onSale } from '../data/products';
import { inrDigits } from '../utils/format';
import Stars from './pdp/Stars';
import { getIngredient } from '../data/ingredients';
import PriceTag from '../../components/PriceTag.jsx';
import { PRODUCTS as SITE_PRODUCTS, STORE_ID } from '../../content/site.js';
import { packshot, hasPackshot } from '../lib/packshot';
import '../styles/reviews.css';

/** Short category label shown on the picture (from the site's product list). */
const CATEGORY = Object.fromEntries(SITE_PRODUCTS.filter((x) => STORE_ID[x.id]).map((x) => [STORE_ID[x.id], x.tag]));

/** A price with a smaller, raised ₹ and lining, equal-width digits. */
export function Money({ value, className = '' }) {
  return (
    <span className={`money ${className}`}>
      <span className="money__sym">₹</span>{inrDigits(value)}
    </span>
  );
}

/** The biggest pack that carries a discount, and its price per unit (null if packs have no discount). */
export function bestPack(product) {
  const pack = [...PACKS].filter((k) => k.off > 0).sort((a, b) => b.qty - a.qty)[0];
  if (!pack) return null;
  return { qty: pack.qty, each: Math.round(packPrice(product, pack.qty) / pack.qty) };
}

export default function ProductCard({ product: p }) {
  const { add } = useCart();
  const sale = onSale(p);
  const best = sale ? bestPack(p) : null;
  return (
    <article className="pcard" style={{ '--p-accent': p.accent, '--tint': p.tint }}>
      <Link to={`/products/${p.id}`} className="pcard__media" aria-label={p.name}>
        {p.badge && <span className="pcard__badge" style={p.badgeStyle ? { background: p.badgeStyle.bg, color: p.badgeStyle.fg } : undefined}>{p.badge}</span>}
        {/* clean white packshot: the cut-out when there is one, otherwise the product photo */}
        <img src={packshot(p)} alt={p.name} loading="lazy" decoding="async" className={`pcard__img${hasPackshot(p) ? ' pcard__img--cutout' : ''}`} />
      </Link>
      <div className="pcard__body">
        <p className="pcard__format">{p.format} · {p.size}</p>
        <h3 className="pcard__name"><Link to={`/products/${p.id}`}>{p.name}</Link></h3>
        {p.rating?.count > 0 && (
          <Link to={`/products/${p.id}#reviews`} className="pcard__rating" aria-label={`Rated ${p.rating.avg.toFixed(1)} out of 5 from ${p.rating.count} verified reviews`}>
            <Stars value={p.rating.avg} size={13} /> <strong>{p.rating.avg.toFixed(1)}</strong> <span>({p.rating.count})</span>
          </Link>
        )}
        <p className="pcard__tag">{p.tagline}</p>
        <div className="pcard__foot">
          {sale ? (
            <>
              <div className="pcard__pricing">
                <PriceTag price={p.price} mrp={p.mrp} />
                {best && best.each < p.price && (
                  <p className="pcard__deal">or <Money value={best.each} /> each in a pack of {best.qty}</p>
                )}
              </div>
              <button className="btn btn--sm" onClick={() => add(p.id)}>Add to cart</button>
            </>
          ) : (
            <>
              <p className="price price--soon"><strong>Price to be announced</strong></p>
              <Link to={`/products/${p.id}`} className="btn btn--sm btn--ghost">View</Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Catalogue card (product page "Complete your routine"): picture with a category pill, "01 / 05" counter,
 * bold product name, short description, ingredient chips, price and an "Add to bag" button.
 */
export function CatalogCard({ product: p, index = 0, total = 1 }) {
  const { add } = useCart();
  const sale = onSale(p);
  const chips = (p.ingredients || []).map((id) => getIngredient(id)?.name).filter(Boolean).slice(0, 4);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <article className="ccard">
      <Link to={`/products/${p.id}`} className="ccard__media" aria-label={p.name}>
        <span className="ccard__pill">{CATEGORY[p.id] || p.format}</span>
        <img src={packshot(p)} alt={p.name} loading="lazy" decoding="async" />
      </Link>
      <div className="ccard__body">
        <p className="ccard__count">{pad(index + 1)} / {pad(total)}</p>
        <h3 className="ccard__name"><Link to={`/products/${p.id}`}>{p.name}</Link></h3>
        <p className="ccard__desc">{p.summary || p.tagline}</p>
        {chips.length > 0 && <ul className="ccard__chips">{chips.map((c) => <li key={c}>{c}</li>)}</ul>}
        <div className="ccard__foot">
          {sale ? (
            <>
              <PriceTag price={p.price} mrp={p.mrp} />
              <p className="ccard__size">{p.size}</p>
              <button type="button" className="ccard__btn" onClick={() => add(p.id)}><span aria-hidden="true">+</span> Add to bag</button>
            </>
          ) : (
            <>
              <p className="ccard__soon">Price to be announced</p>
              <p className="ccard__size">{p.size}</p>
              <Link to={`/products/${p.id}`} className="ccard__btn ccard__btn--ghost">View product</Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** The catalogue cards in a sideways-scrolling row: 5 visible on desktop, < and > arrows reveal the rest. */
export function CatalogRow({ products }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const measure = () => {
    const el = ref.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [products.length]);
  // one click moves by one card (a little under the visible width keeps the previous card in view)
  const go = (dir) => {
    const el = ref.current;
    const card = el?.firstElementChild;
    if (el && card) el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 16) * 2, behavior: 'smooth' });
  };
  const arrow = (dir) => (
    <button type="button" className={`catalog__arrow catalog__arrow--${dir < 0 ? 'prev' : 'next'}`} onClick={() => go(dir)}
      disabled={dir < 0 ? edge.start : edge.end} aria-label={dir < 0 ? 'Previous products' : 'More products'}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
  return (
    <div className="catalog">
      {arrow(-1)}
      <div className="catalog-grid" ref={ref} onScroll={measure}>
        {products.map((r, i) => <CatalogCard key={r.id} product={r} index={i} total={products.length} />)}
      </div>
      {arrow(1)}
    </div>
  );
}
