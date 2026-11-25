import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { onSale } from '../data/products';
import { inr, pctOff } from '../utils/format';

export default function ProductCard({ product: p }) {
  const { add } = useCart();
  const sale = onSale(p);
  const off = sale ? pctOff(p.price, p.mrp) : 0;
  return (
    <article className="pcard" style={{ '--p-accent': p.accent, '--tint': p.tint }}>
      <Link to={`/products/${p.id}`} className="pcard__media" aria-label={p.name}>
        {p.badge && <span className="pcard__badge">{p.badge}</span>}
        {off > 0 && <span className="pcard__off">{off}% off</span>}
        <img src={p.images[0]} alt={p.name} loading="lazy" className="pcard__img" />
        {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" className="pcard__img pcard__img--alt" />}
      </Link>
      <div className="pcard__body">
        <p className="pcard__format">{p.format} · {p.size}</p>
        <h3 className="pcard__name"><Link to={`/products/${p.id}`}>{p.name}</Link></h3>
        <p className="pcard__tag">{p.tagline}</p>
        <div className="pcard__foot">
          {sale ? (
            <>
              <p className="price">
                <strong>{inr(p.price)}</strong>
                {p.mrp > p.price && <s>{inr(p.mrp)}</s>}
              </p>
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
