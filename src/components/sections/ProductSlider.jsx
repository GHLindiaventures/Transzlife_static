import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Media, Slot, ProductImg } from '../ui.jsx';
import CompareStage from '../CompareStage.jsx';
import { PriceRow } from './Featured.jsx';
import { PRODUCTS } from '../../content/site.js';

const SLIDES = PRODUCTS.filter((p) => p.compare);
const COUNT = SLIDES.length;

/**
 * Split product slider (auto-plays every 5s, and holds while the visitor is using the comparison slider).
 * Left half: the product, name and price on the coloured panel.
 * Right half: the before / after comparison slider for that product (drag the handle).
 */
export default function ProductSlider() {
  const [idx, setIdx] = useState(0);
  const [hold, setHold] = useState(false); // pointer is on the comparison: do not slide away
  const secRef = useRef(null);
  const go = (i) => setIdx((i + COUNT) % COUNT);

  useEffect(() => {
    if (hold) return undefined;
    const t = setTimeout(() => setIdx((i) => (i + 1) % COUNT), 5000);
    return () => clearTimeout(t);
  }, [idx, hold]);

  // scroll parallax: --pp runs from 1 (section entering from below) to -1 (leaving above); layers move at different speeds
  useEffect(() => {
    const el = secRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (r.top + r.height / 2 - vh / 2) / ((vh + r.height) / 2);
      el.style.setProperty('--pp', Math.max(-1, Math.min(1, p)).toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="pslider" id="pslider" ref={secRef}>
      <div className="pslider__slides">
        {SLIDES.map((p, n) => (
          <div className={`pslider__slide${n === idx ? ' is-active' : ''}`} key={p.id}>
            <div className="pslider__left">
              <Media className="media--pslider media--product"><ProductImg n={p.photo} alt={p.short} /></Media>
              <h3 className="pslider__name"><Link to={`/product/${p.id}`}><Slot className="slot--card-title">{p.short}</Slot></Link></h3>
              <PriceRow product={p} />
            </div>
            <div
              className={`pslider__right pslider__right--${p.compare.kind}`}
              onPointerEnter={() => setHold(true)}
              onPointerLeave={() => setHold(false)}
            >
              <CompareStage data={p.compare} />
            </div>
          </div>
        ))}
      </div>

      <button className="pslider__next" type="button" aria-label="Next" onClick={() => go(idx + 1)}>
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 1.5L10 10l-8.5 8.5" /></svg>
      </button>

      <div className="pslider__dots">
        {SLIDES.map((p, n) => (
          <button key={p.id} className={`dot${n === idx ? ' is-active' : ''}`} type="button" aria-label={`Slide ${n + 1}`} onClick={() => go(n)} />
        ))}
      </div>
    </section>
  );
}
