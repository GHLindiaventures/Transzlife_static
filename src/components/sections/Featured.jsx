import { Link } from 'react-router-dom';
import { Media, Slot, ProductImg } from '../ui.jsx';
import { PRODUCTS, PRODUCTS_SECTION, priceLabel, productUrl } from '../../content/site.js';

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
  const url = productUrl(product.id);
  return (
    <article className="pcard" data-reveal>
      <div className="pcard__media">
        <Media className="media--fill media--product">
          <ProductImg n={product.photo} alt={product.name} />
        </Media>
        {/* the whole picture is clickable for pointer users; keyboard users get the title and button links */}
        <Link className="pcard__link" to={url} tabIndex={-1} aria-hidden="true" />
        <Slot className="pcard__badge slot--badge">{product.tag}</Slot>
        <Link className="pcard__quick" to={url} aria-label={`View details of ${product.short}`}><Slot className="slot--btn">View details</Slot></Link>
      </div>
      <h3 className="pcard__title">
        <Link to={url}><Slot className="slot--card-title">{product.short}</Slot></Link>
      </h3>
      <PriceRow product={product} />
    </article>
  );
}

/** All products, as a grid on wide screens and a swipeable row on phones. This is the "Shop" destination (#products). */
export default function Featured({ headline = PRODUCTS_SECTION.headline, sub = PRODUCTS_SECTION.sub }) {
  return (
    <section className="featured featured--titled" id={PRODUCTS_SECTION.id} aria-labelledby="productsHeading">
      <div className="featured__head" data-reveal>
        <Slot as="h2" className="headline slot--headline" id="productsHeading">{headline}</Slot>
        {sub && <p className="featured__sub">{sub}</p>}
      </div>
      <div className="featured__track" id="featuredTrack">
        {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
