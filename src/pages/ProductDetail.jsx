import { Link, Navigate, useParams } from 'react-router-dom';
import { ProductImg } from '../components/ui.jsx';
import ProductShowcase from '../components/ProductShowcase.jsx';
import { getProduct, priceLabel, PRODUCTS, SHOWCASE } from '../content/site.js';

/**
 * Product page. Every product gets the summary; only products listed in SHOWCASE (LiverDetox)
 * also get the product + conceptual illustration section, so other product pages are unaffected.
 */
export default function ProductDetail() {
  const { id } = useParams();
  const product = getProduct(id);
  if (!product) return <Navigate to="/" replace />;

  const showcase = SHOWCASE[product.id];
  const others = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <>
      <section className="pdp">
        <div className="pdp__inner">
          <Link className="pdp__back" to="/">← All products</Link>

          <div className="pdp__grid">
            <div className="pdp__pack" data-reveal>
              <ProductImg n={product.photo} alt={`${product.name} packaging`} eager />
            </div>

            <div className="pdp__info" data-reveal>
              <p className="pdp__tag">{product.tag}</p>
              <h1 className="pdp__title">{product.name}</h1>
              <p className="pdp__price">
                <span>{priceLabel(product)}</span>
                <small>{product.size}</small>
              </p>
              <p className="pdp__desc">{product.desc}</p>

              <h2 className="pdp__k">Key ingredients</h2>
              <ul className="pdp__chips">
                {product.ingredients.map((i) => <li key={i}>{i}</li>)}
              </ul>

              <h2 className="pdp__k">How to use</h2>
              <p className="pdp__dose">{product.dosage}</p>
            </div>
          </div>
        </div>
      </section>

      {showcase && <ProductShowcase product={product} data={showcase} />}

      <section className="pdp-more">
        <div className="pdp__inner">
          <h2 className="pdp__k">More from TranzLife</h2>
          <ul className="pdp-more__grid">
            {others.map((p) => (
              <li key={p.id}>
                <Link to={`/product/${p.id}`}>
                  <span className="pdp-more__img"><ProductImg n={p.photo} alt={p.short} /></span>
                  <b>{p.short}</b>
                  <small>{p.tag}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
