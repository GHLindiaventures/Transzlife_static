import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Media, Slot, ProductImg } from '../ui.jsx';
import { PRODUCTS, PRODUCTS_SECTION, STORE_ID, hasPrice, priceLabel, productUrl, mrpOf } from '../../content/site.js';
import { setBuyNow, BUY_NOW_URL } from '../../store/lib/checkoutIntent';
import { getProduct as getStoreProduct } from '../../store/data/products';
import { useCatalog } from '../../store/lib/catalog';
import PriceTag from '../PriceTag.jsx';

/** Homepage card data + the live price, MRP and stock from the shop catalogue. */
const withLive = (product) => {
  const live = product && STORE_ID[product.id] && getStoreProduct(STORE_ID[product.id]);
  return live ? { ...product, price: live.price, mrp: live.mrp, stock: live.stock } : product;
};


/** Price block: final price, struck-out MRP and discount. Pass no product for the empty placeholder version. */
export function PriceRow({ product: base }) {
  // until the live prices arrive, show the placeholder: never flash an old built-in price first
  const loaded = useCatalog() > 0;
  const product = withLive(base);
  if (!product || !loaded) {
    return (
      <div className="pcard__price">
        <Slot className="slot--price" />
        <Slot className="slot--pill" />
      </div>
    );
  }
  if (!hasPrice(product)) {
    return <p className="pcard__price pcard__price--tba">{priceLabel(product)}</p>;
  }
  return <PriceTag price={product.price} mrp={mrpOf(product)} className="pcard__price" />;
}

/** Buy now (like Amazon): just this item, straight to checkout (sign-in first if needed). The cart is untouched. */
function BuyNow({ product: base, url }) {
  useCatalog();
  const product = withLive(base);
  const navigate = useNavigate();
  const storeId = STORE_ID[product.id];
  if (!hasPrice(product) || !storeId) {
    return <Link className="pcard__buy pcard__buy--ghost" to={url}>Explore</Link>;
  }
  return (
    <button
      type="button"
      className="pcard__buy"
      onClick={() => { setBuyNow({ id: storeId, pack: 1, qty: 1 }); navigate(BUY_NOW_URL); }}
      aria-label={`Buy ${product.short} now`}
    >
      Buy now
    </button>
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
              width={800}
              height={800}
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
      <p className="pcard__size">{product.size}</p>
      <PriceRow product={product} />
      <BuyNow product={product} url={url} />
    </article>
  );
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

      const trackRect = track.getBoundingClientRect();
      const viewCenter = trackRect.left + trackRect.width / 2;
      let closest = null;
      let closestDist = Infinity;

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.right < trackRect.left + 8 || rect.left > trackRect.right - 8) return;
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
    const initTimer = setTimeout(apply, 80);
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    mqMobile.addEventListener('change', onScroll);
    mqReduce.addEventListener('change', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(initTimer);
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
 * layout="slider" (home): an automatic, continuous, infinite-looping carousel with navigation arrows.
 * layout="grid" (/products): every product at once in a static grid.
 */
/** productIds: shop product ids in the order to show (from the dashboard); empty = all. */
const pick = (ids) => {
  if (!ids?.length) return PRODUCTS;
  const byStore = Object.fromEntries(PRODUCTS.map((p) => [STORE_ID[p.id], p]));
  const list = ids.map((id) => byStore[id]).filter(Boolean);
  return list.length ? list : PRODUCTS;
};

export default function Featured({ headline = PRODUCTS_SECTION.headline, sub = PRODUCTS_SECTION.sub, layout = 'slider', productIds }) {
  const items = pick(productIds);
  const COUNT = items.length;
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const metricsRef = useRef(null);
  const isSlider = layout === 'slider';
  const isJumpingRef = useRef(false);
  useCardFront(trackRef, isSlider);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [inView, setInView] = useState(true);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // For slider mode, render 3 sets of products so the loop wraps around infinitely and seamlessly
  const displayProducts = isSlider
    ? [...items, ...items, ...items]
    : items;

  const measureMetrics = useCallback(() => {
    const el = trackRef.current;
    if (!el) return null;
    const cards = el.children;
    const first = cards[0];
    const startCard = cards[COUNT] || first;
    if (!first || !startCard) return null;
    const style = window.getComputedStyle(el);
    const gap = parseFloat(style.columnGap || style.gap) || 16;
    const cardW = first.offsetWidth;
    const stepWidth = cardW + gap;
    const singleSetWidth = stepWidth * COUNT;
    const isMobile = window.matchMedia('(max-width: 749px)').matches;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const restScroll = isMobile
      ? startCard.offsetLeft - (el.clientWidth - cardW) / 2
      : startCard.offsetLeft - padLeft;
    const m = { stepWidth, singleSetWidth, restScroll };
    metricsRef.current = m;
    return m;
  }, [COUNT]);

  // Start scroll at middle set (Set 1) so user can scroll left or right indefinitely
  useEffect(() => {
    if (!isSlider) return;
    const el = trackRef.current;
    if (!el) return;

    const init = () => {
      const m = measureMetrics();
      if (m && m.singleSetWidth > 0) {
        const prevBehavior = el.style.scrollBehavior;
        const prevSnap = el.style.scrollSnapType;
        el.style.scrollBehavior = 'auto';
        el.style.scrollSnapType = 'none';
        el.scrollLeft = m.restScroll;
        requestAnimationFrame(() => {
          el.style.scrollBehavior = prevBehavior;
          el.style.scrollSnapType = prevSnap;
        });
      }
    };
    init();
    const t = setTimeout(init, 60);
    window.addEventListener('resize', init);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', init);
    };
  }, [isSlider, measureMetrics]);

  // Handle scroll events: seamless wrapping using cached metrics (zero forced reflow per frame)
  useEffect(() => {
    if (!isSlider) return;
    const el = trackRef.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const m = metricsRef.current || measureMetrics();
        if (!m || m.singleSetWidth <= 0 || isJumpingRef.current) return;

        const { scrollLeft } = el;
        const { singleSetWidth, stepWidth, restScroll } = m;

        // When scrolling past the middle set into the 3rd set, wrap back silently
        if (scrollLeft >= restScroll + singleSetWidth) {
          isJumpingRef.current = true;
          el.style.scrollBehavior = 'auto';
          el.style.scrollSnapType = 'none';
          el.scrollLeft -= singleSetWidth;
          requestAnimationFrame(() => {
            el.style.scrollBehavior = '';
            el.style.scrollSnapType = '';
            isJumpingRef.current = false;
          });
        } else if (scrollLeft < restScroll - singleSetWidth * 0.5) {
          // When scrolling backwards into the 1st set, wrap forward silently
          isJumpingRef.current = true;
          el.style.scrollBehavior = 'auto';
          el.style.scrollSnapType = 'none';
          el.scrollLeft += singleSetWidth;
          requestAnimationFrame(() => {
            el.style.scrollBehavior = '';
            el.style.scrollSnapType = '';
            isJumpingRef.current = false;
          });
        }

        const rel = ((el.scrollLeft - restScroll) % singleSetWidth + singleSetWidth) % singleSetWidth;
        const currentCard = Math.round(rel / stepWidth) % COUNT;
        setActiveIdx((prev) => (prev === currentCard ? prev : currentCard));
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [isSlider, measureMetrics]);

  // Pause auto-cycling when section is offscreen
  useEffect(() => {
    const sec = sectionRef.current;
    if (!isSlider || !sec || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(sec);
    return () => io.disconnect();
  }, [isSlider]);

  // Step helper for next/prev
  const step = useCallback((dir) => {
    const el = trackRef.current;
    if (!el) return;
    const m = metricsRef.current || measureMetrics();
    const by = m ? m.stepWidth : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * by, behavior: reduce ? 'auto' : 'smooth' });
  }, [measureMetrics, reduce]);

  // Automatic cycling loop (every 3.5s, paused when offscreen or hidden)
  useEffect(() => {
    if (!isSlider || isInteracting || reduce || !inView) return undefined;
    const interval = setInterval(() => {
      if (!document.hidden) step(1);
    }, 3500);
    return () => clearInterval(interval);
  }, [isSlider, isInteracting, reduce, inView, step]);

  return (
    <section
      ref={sectionRef}
      className={`featured featured--titled featured--${layout}`}
      id={PRODUCTS_SECTION.id}
      aria-labelledby="productsHeading"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsInteracting(false); }}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
    >
      <div className="featured__head" data-reveal>
        <Slot as="h2" className="headline slot--headline" id="productsHeading">{headline}</Slot>
        {sub && <p className="featured__sub">{sub}</p>}
      </div>
      <div className="featured__viewport">
        <div
          className="featured__track"
          id="featuredTrack"
          ref={trackRef}
          {...(isSlider ? { tabIndex: 0, role: 'region', 'aria-label': 'Products carousel, auto-advancing' } : {})}
        >
          {displayProducts.map((p, i) => (
            <ProductCard key={isSlider ? `${p.id}-${i}` : p.id} product={p} />
          ))}
        </div>
        {isSlider && (
          <>
            <button
              type="button"
              className="featured__arrow featured__arrow--prev"
              aria-label="Previous products"
              aria-controls="featuredTrack"
              onClick={() => step(-1)}
            >
              <Arrow dir="prev" />
            </button>
            <button
              type="button"
              className="featured__arrow featured__arrow--next"
              aria-label="Next products"
              aria-controls="featuredTrack"
              onClick={() => step(1)}
            >
              <Arrow dir="next" />
            </button>
          </>
        )}
      </div>
      {isSlider && (
        /* progress line and "View all" share one row inside the carousel frame */
        <div className="featured__foot">
          <div className="featured__progress" aria-hidden="true">
            <span
              style={{
                width: `${(1 / COUNT) * 100}%`,
                left: `${(activeIdx / COUNT) * 100}%`,
                transition: 'left 0.35s ease-out',
              }}
            />
          </div>
          <div className="featured__all">
            <Link className="link-btn link-btn--dark" to="/products"><Slot className="slot--link">View all</Slot></Link>
          </div>
        </div>
      )}
    </section>
  );
}
