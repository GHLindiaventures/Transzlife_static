import { Link } from 'react-router-dom';
import { Media, Slot, Ph, ProductImg } from '../ui.jsx';
import { PRODUCTS, priceLabel } from '../../content/site.js';

/** Price row: price + size pill. Pass no product for the empty placeholder version. */
export function PriceRow({ product }) {
  return (
    <div className="pcard__price">
      <Slot className="slot--price">{product ? priceLabel(product) : undefined}</Slot>
      {!product && <Slot className="slot--price" />}
      <Slot className="slot--pill">{product ? product.size : undefined}</Slot>
    </div>
  );
}

export function ProductCard({ product }) {
  return (
    <article className="pcard" data-reveal>
      <div className="pcard__media">
        <Media className="media--fill media--product">
          {product ? <ProductImg n={product.photo} alt={product.short} /> : null}
        </Media>
        {product && <Link className="pcard__link" to={`/product/${product.id}`} aria-label={`View ${product.short}`} />}
        <Slot className="pcard__badge slot--badge">{product ? product.tag : undefined}</Slot>
        <button className="pcard__quick" type="button"><Slot className="slot--btn">{product ? 'Add to bag' : undefined}</Slot></button>
      </div>
      <h3 className="pcard__title">
        {product ? (
          <Link to={`/product/${product.id}`}><Slot className="slot--card-title">{product.short}</Slot></Link>
        ) : (
          <Slot className="slot--card-title" />
        )}
      </h3>
      <PriceRow product={product} />
    </article>
  );
}

/** Product card carousel. `titled` adds the section headline (used on the About page). */
export default function Featured({ titled = false, headline = 'Our products' }) {
  return (
    <section className={`featured${titled ? ' featured--titled' : ''}`}>
      {titled && <Slot as="h2" className="headline slot--headline" data-reveal>{headline}</Slot>}
      <div className="featured__track" id="featuredTrack">
        {PRODUCTS.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
      <div className="featured__foot">
        <Ph className="link-btn link-btn--dark"><Slot className="slot--link">View all</Slot></Ph>
      </div>
    </section>
  );
}
