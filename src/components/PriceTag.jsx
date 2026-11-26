import '../styles/price-tag.css';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/**
 * The one price style for every product (home cards, shop cards, product page):
 *   ₹249  ~~₹299~~  [17% OFF]
 * Selling price in bold dark green; MRP small, grey and struck through; discount in a small yellow pill.
 * No discount: the selling price alone. No usable price: nothing (callers show their own "Price to be announced").
 * size: "md" (cards, default) or "lg" (product page).
 */
export default function PriceTag({ price, mrp, size = 'md', className = '' }) {
  const now = Number(price);
  if (!Number.isFinite(now) || now <= 0) return null;
  const was = Number(mrp);
  const off = Number.isFinite(was) && was > now ? Math.round((1 - now / was) * 100) : 0;
  return (
    <p className={`ptag ptag--${size} ${className}`.trim()}>
      <span className="ptag__now"><span className="visually-hidden">Price </span>{inr(now)}</span>
      {off > 0 && (
        <>
          <s className="ptag__mrp"><span className="visually-hidden">MRP </span>{inr(was)}</s>
          <span className="ptag__off">{off}% off</span>
        </>
      )}
    </p>
  );
}
