import { Link } from 'react-router-dom';
import { useCart, packPrice } from '../context/CartContext';
import { PACKS, onSale } from '../data/products';
import { inrDigits, pctOff } from '../utils/format';
import Stars from './pdp/Stars';
import '../styles/reviews.css';

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
  const off = sale ? pctOff(p.price, p.mrp) : 0;
  const best = sale ? bestPack(p) : null;
  return (
    <article className="pcard" style={{ '--p-accent': p.accent, '--tint': p.tint }}>
      <Link to={`/products/${p.id}`} className="pcard__media" aria-label={p.name}>
        {p.badge && <span className="pcard__badge" style={p.badgeStyle ? { background: p.badgeStyle.bg, color: p.badgeStyle.fg } : undefined}>{p.badge}</span>}
        {off > 0 && <span className="pcard__off">{off}% off</span>}
        <img src={p.images[0]} alt={p.name} loading="lazy" className="pcard__img" />
        {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" className="pcard__img pcard__img--alt" />}
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
                <p className="price">
                  <strong><Money value={p.price} /></strong>
                  {p.mrp > p.price && <s>MRP <Money value={p.mrp} /></s>}
                </p>
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
