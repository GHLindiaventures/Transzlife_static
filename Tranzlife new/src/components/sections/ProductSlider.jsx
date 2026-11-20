import { useEffect, useState } from 'react';
import { Media, Slot, ProductImg, range } from '../ui.jsx';
import { PriceRow } from './Featured.jsx';

const COUNT = 5;

/**
 * Split product slider (auto-plays every 5s).
 * Left half: coloured panel with product, caption, price. Right half: full-bleed image + title.
 */
export default function ProductSlider() {
  const [idx, setIdx] = useState(0);
  const go = (i) => setIdx((i + COUNT) % COUNT);

  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => (i + 1) % COUNT), 5000);
    return () => clearTimeout(t);
  }, [idx]);

  return (
    <section className="pslider" id="pslider">
      <div className="pslider__slides">
        {range(COUNT).map((n) => (
          <div className={`pslider__slide${n === idx ? ' is-active' : ''}`} key={n}>
            <div className="pslider__left">
              <Media className="media--pslider media--product"><ProductImg n={n + 1} /></Media>
              <Slot as="h3" className="slot--card-title" />
              <PriceRow />
            </div>
            <div className="pslider__right">
              {/* image / video for this slide */}
              <Media />
              <div className="pslider__title"><Slot as="h2" className="slot--pslider-title" /></div>
            </div>
          </div>
        ))}
      </div>

      <button className="pslider__next" type="button" aria-label="Next" onClick={() => go(idx + 1)}>
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 1.5L10 10l-8.500 8.500" /></svg>
      </button>

      <div className="pslider__dots">
        {range(COUNT).map((n) => (
          <button key={n} className={`dot${n === idx ? ' is-active' : ''}`} type="button" aria-label={`Slide ${n + 1}`} onClick={() => go(n)} />
        ))}
      </div>
    </section>
  );
}
