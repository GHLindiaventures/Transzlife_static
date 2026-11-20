import { useEffect, useState } from 'react';
import { Media, Slot, ProductImg, range } from '../ui.jsx';
import { PriceRow } from './Featured.jsx';

const COUNT = 5;

/** Full-bleed coloured product slider (auto-plays every 5s). */
export default function ProductSlider() {
  const [idx, setIdx] = useState(0);

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
              <Slot as="h2" className="slot--pslider-title" />
            </div>
          </div>
        ))}
      </div>
      <div className="pslider__dots">
        {range(COUNT).map((n) => (
          <button key={n} className={`dot${n === idx ? ' is-active' : ''}`} type="button" aria-label={`Slide ${n + 1}`} onClick={() => setIdx(n)} />
        ))}
      </div>
    </section>
  );
}
