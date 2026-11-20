import { useEffect, useRef, useState } from 'react';
import { Media, Slot, Ph, range } from '../ui.jsx';

const COUNT = 3;

export default function Hero() {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(0);

  // auto-advance every 6s; resets whenever the slide changes (dot click / swipe)
  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => (i + 1) % COUNT), 6000);
    return () => clearTimeout(t);
  }, [idx]);

  const go = (i) => setIdx((i + COUNT) % COUNT);

  return (
    <section
      className="hero"
      id="hero"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hero__slides" style={{ transform: `translateX(${-100 * idx}%)` }}>
        {range(COUNT).map((n) => (
          <div className={`hero__slide${n === idx ? ' is-active' : ''}`} key={n}>
            <Media className="media--fill hero__bg" />
            <div className="hero__shade" />
            <div className="hero__content page-pad">
              <Slot as="p" className="slot--eyebrow-w" />
              <Slot as="h2" className="slot--hero-title" />
              <Slot as="p" className="slot--hero-sub" />
              <Ph className="link-btn"><Slot className="slot--link" /></Ph>
            </div>
          </div>
        ))}
      </div>
      <div className="hero__dots page-pad" role="tablist">
        {range(COUNT).map((n) => (
          <button
            key={n}
            className={`hero__dot${n === idx ? ' is-active' : ''}`}
            type="button"
            aria-label={`Slide ${n + 1}`}
            onClick={() => go(n)}
          >
            <i />
          </button>
        ))}
      </div>
    </section>
  );
}
