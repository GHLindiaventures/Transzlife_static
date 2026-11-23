import { useEffect, useRef, useState } from 'react';
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
    <article className="pcard" data-product={product.id} data-reveal>
      <div className="pcard__media">
        <Media className="media--fill media--product">
          {product.showcase ? (
            <img
              src={`${import.meta.env.BASE_URL}${product.showcase.replace(/^\//, '')}`}
              alt={product.name}
              className="pcard__showcase-img"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <ProductImg n={product.photo} alt={product.name} />
          )}
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

/** Tracks how far the row has been scrolled: drives the progress bar and enables/disables the arrows. */
function useScrollState(ref) {
  const [state, setState] = useState({ size: 1, offset: 0, canPrev: false, canNext: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const size = scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1;
        const max = scrollWidth - clientWidth;
        const offset = max > 0 ? (scrollLeft / max) * (1 - size) : 0;
        setState({ size, offset, canPrev: scrollLeft > 2, canNext: scrollLeft < max - 2 });
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ref]);
  return state;
}

/** On mobile, bring the card nearest the viewport center slightly forward. */
function useCardFront(trackRef, enabled) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !enabled) return undefined;

    const mqMobile = window.matchMedia('(max-width: 749px)');
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const apply = () => {
      frame = 0;
      const cards = track.querySelectorAll('.pcard');
      if (!cards.length) return;

      if (!mqMobile.matches || mqReduce.matches) {
        cards.forEach((card) => card.classList.remove('is-front'));
        return;
      }

      const viewCenter = window.innerWidth / 2;
      let closest = null;
      let closestDist = Infinity;

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.right < 8 || rect.left > window.innerWidth - 8) return;
        const dist = Math.abs(rect.left + rect.width / 2 - viewCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = card;
        }
      });

      cards.forEach((card) => {
        card.classList.toggle('is-front', card === closest);
      });
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    mqMobile.addEventListener('change', onScroll);
    mqReduce.addEventListener('change', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mqMobile.removeEventListener('change', onScroll);
      mqReduce.removeEventListener('change', onScroll);
      track.querySelectorAll('.pcard.is-front').forEach((card) => card.classList.remove('is-front'));
    };
  }, [trackRef, enabled]);
}

const Arrow = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'prev' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);

/**
 * All products.
 * layout="slider" (home): a sideways row with arrow buttons, a progress bar and a "View all" link.
 * layout="grid" (/products): every product at once.
 */
export default function Featured({ headline = PRODUCTS_SECTION.headline, sub = PRODUCTS_SECTION.sub, layout = 'slider' }) {
  const trackRef = useRef(null);
  const scroll = useScrollState(trackRef);
  const isSlider = layout === 'slider';
  useCardFront(trackRef, isSlider);

  /* move by one card (card width + gap), so the row always lands on a card edge */
  const step = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.pcard');
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const by = card ? card.offsetWidth + gap : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * by, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section className={`featured featured--titled featured--${layout}`} id={PRODUCTS_SECTION.id} aria-labelledby="productsHeading">
      <div className="featured__head" data-reveal>
        <Slot as="h2" className="headline slot--headline" id="productsHeading">{headline}</Slot>
        {sub && <p className="featured__sub">{sub}</p>}
      </div>
      <div className="featured__viewport">
        <div
          className="featured__track"
          id="featuredTrack"
          ref={trackRef}
          {...(isSlider ? { tabIndex: 0, role: 'region', 'aria-label': 'Products, scroll sideways for more' } : {})}
        >
          {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {isSlider && (
          <>
            <button type="button" className="featured__arrow featured__arrow--prev" aria-label="Previous products" aria-controls="featuredTrack" disabled={!scroll.canPrev} onClick={() => step(-1)}><Arrow dir="prev" /></button>
            <button type="button" className="featured__arrow featured__arrow--next" aria-label="Next products" aria-controls="featuredTrack" disabled={!scroll.canNext} onClick={() => step(1)}><Arrow dir="next" /></button>
          </>
        )}
      </div>
      {isSlider && scroll.size < 1 && (
        <div className="featured__progress" aria-hidden="true">
          <span style={{ width: `${scroll.size * 100}%`, left: `${scroll.offset * 100}%` }} />
        </div>
      )}
      {isSlider && (
        <div className="featured__all">
          <Link className="link-btn link-btn--dark" to="/products"><Slot className="slot--link">View all</Slot></Link>
        </div>
      )}
    </section>
  );
}
