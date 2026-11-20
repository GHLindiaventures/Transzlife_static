import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Media, Slot } from '../ui.jsx';
import { HERO } from '../../content/site.js';

const COUNT = HERO.length;
const BASE = import.meta.env.BASE_URL;

/**
 * Home hero slideshow. Each slide is a full-bleed product image (/public/assets/hero) with the headline
 * on the empty left side. `tone: 'ink'` slides have light backgrounds, so their text and progress bars turn dark.
 *
 * Auto-advance is driven by the progress bar under the active dot: when its CSS "fill" animation ends, the next
 * slide shows. So pausing (button, hover, keyboard focus) simply pauses that animation and the timing stays in sync.
 * Visitors who prefer reduced motion get no auto-advance at all.
 */
export default function Hero() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false); // the visitor pressed pause
  const [held, setHeld] = useState(false); // pointer over / focus inside the hero
  const [reduce, setReduce] = useState(false);
  const touchX = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const go = (i) => setIdx((i + COUNT) % COUNT);
  const auto = !reduce && !paused;

  const onAnimationEnd = (e) => {
    if (auto && !held && e.animationName === 'fill') go(idx + 1);
  };

  return (
    <section
      className={`hero${HERO[idx].tone === 'ink' ? ' hero--ink' : ''}${auto && !held ? '' : ' is-paused'}${auto ? ' is-auto' : ''}`}
      id="hero"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onAnimationEnd={onAnimationEnd}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false); }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hero__slides" style={{ transform: `translateX(${-100 * idx}%)` }}>
        {HERO.map((s, n) => {
          const active = n === idx;
          return (
            <div
              className={`hero__slide hero__slide--${s.tone}${active ? ' is-active' : ''}`}
              key={n}
              role="group"
              aria-roledescription="slide"
              aria-label={`${n + 1} of ${COUNT}`}
              aria-hidden={!active}
              inert={active ? undefined : ''}
            >
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
                {/* the first slide carries the page's main heading */}
                <Slot as={n === 0 ? 'h1' : 'h2'} className="slot--hero-title">{s.title}</Slot>
                <Slot as="p" className="slot--hero-sub">{s.sub}</Slot>
                <Link className="link-btn" to={s.to}><Slot className="slot--link">{s.cta}</Slot></Link>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero__dots page-pad">
        {HERO.map((s, n) => (
          <button
            key={n}
            className={`hero__dot${n === idx ? ' is-active' : ''}`}
            type="button"
            aria-label={`Show slide ${n + 1}: ${s.title}`}
            aria-current={n === idx ? 'true' : undefined}
            onClick={() => go(n)}
          >
            <i />
          </button>
        ))}
        {!reduce && (
          <button
            className="hero__pause"
            type="button"
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M1 1v10l8-5z" /></svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M1 1h3v10H1zM6 1h3v10H6z" /></svg>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
