import { useEffect, useRef, useState } from 'react';
import { Media, Slot, Ph } from '../ui.jsx';
import { HERO } from '../../content/site.js';

const COUNT = HERO.length;
const BASE = import.meta.env.BASE_URL;

/**
 * Home hero slideshow. Each slide is a full-bleed product image (/public/assets/hero) with the headline
 * on the empty left side. `tone: 'ink'` slides have light backgrounds, so their text and progress bars turn dark.
 */
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
      className={`hero${HERO[idx].tone === 'ink' ? ' hero--ink' : ''}`}
      id="hero"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hero__slides" style={{ transform: `translateX(${-100 * idx}%)` }}>
        {HERO.map((s, n) => (
          <div className={`hero__slide hero__slide--${s.tone}${n === idx ? ' is-active' : ''}`} key={n}>
            <Media className="media--fill hero__bg" style={{ background: s.bg }}>
              <img
                src={`${BASE}assets/${s.image}`}
                alt={s.alt}
                width="2000"
                height="1116"
                loading={n === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchpriority={n === 0 ? 'high' : undefined}
              />
            </Media>
            <div className="hero__shade" />
            <div className="hero__content page-pad">
              <Slot as="p" className="slot--eyebrow-w">{s.eyebrow}</Slot>
              <Slot as="h2" className="slot--hero-title">{s.title}</Slot>
              <Slot as="p" className="slot--hero-sub">{s.sub}</Slot>
              <Ph className="link-btn"><Slot className="slot--link">{s.cta}</Slot></Ph>
            </div>
          </div>
        ))}
      </div>
      <div className="hero__dots page-pad" role="tablist">
        {HERO.map((_, n) => (
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
