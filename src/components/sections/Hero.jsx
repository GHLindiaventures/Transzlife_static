import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Media, Slot } from '../ui.jsx';
import { HERO } from '../../content/site.js';

const COUNT = HERO.length;
const BASE = import.meta.env.BASE_URL;

// Cloned list: [Clone of Slide 3, Slide 1, Slide 2, Slide 3, Clone of Slide 1]
// This enables infinite forward (1 -> 2 -> 3 -> 1) and backward (1 -> 3) sliding
// without any rewinding, blank screen, flickering, or sudden jumps.
const EXTENDED_SLIDES = [
  HERO[COUNT - 1], // index 0: Clone of Slide 3
  ...HERO,         // index 1..3: Slides 1..3
  HERO[0],         // index 4: Clone of Slide 1
];

export default function Hero() {
  const [slideIdx, setSlideIdx] = useState(1); // start at Slide 1 (real index 1)
  const [withTransition, setWithTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const slidesRef = useRef(null);
  const touchX = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Parallax scroll effect
  useEffect(() => {
    if (reduce) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollY = window.scrollY;
      setScrollOffset(scrollY * 0.3); // subtle parallax
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [reduce]);

  // Compute active dot (0, 1, or 2)
  const activeDot = (slideIdx - 1 + COUNT) % COUNT;
  const currentSlide = HERO[activeDot];
  const auto = !reduce && !paused;

  // Auto-advance timer (every 6 seconds)
  useEffect(() => {
    if (!auto || held) return undefined;
    const timer = setTimeout(() => {
      setWithTransition(true);
      setSlideIdx((prev) => prev + 1);
    }, 6000);
    return () => clearTimeout(timer);
  }, [slideIdx, auto, held]);

  // Seamless boundary wrap when transition completes on clone slides
  const onTransitionEnd = (e) => {
    if (e.target !== slidesRef.current) return;
    if (slideIdx === EXTENDED_SLIDES.length - 1) {
      // Reached Clone of Slide 1 -> silently snap to real Slide 1
      setWithTransition(false);
      setSlideIdx(1);
    } else if (slideIdx === 0) {
      // Reached Clone of Slide 3 -> silently snap to real Slide 3
      setWithTransition(false);
      setSlideIdx(COUNT);
    }
  };

  // When transition was temporarily disabled for silent snap, re-enable on next animation frame
  useEffect(() => {
    if (!withTransition) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWithTransition(true);
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [withTransition]);

  const goToSlide = (n) => {
    setWithTransition(true);
    setSlideIdx(n + 1);
  };

  return (
    <section
      className={`hero${currentSlide.tone === 'ink' ? ' hero--ink' : ''}${auto && !held ? '' : ' is-paused'}${auto ? ' is-auto' : ''}`}
      id="hero"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false); }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) {
          setWithTransition(true);
          setSlideIdx((prev) => prev + (dx < 0 ? 1 : -1));
        }
      }}
    >
      <div
        className="hero__slides"
        ref={slidesRef}
        onTransitionEnd={onTransitionEnd}
        style={{
          transform: `translateX(-${slideIdx * 100}%)`,
          transition: withTransition && !reduce ? 'transform 0.9s var(--ease)' : 'none',
        }}
      >
        {EXTENDED_SLIDES.map((s, index) => {
          const originalIndex = (index - 1 + COUNT) % COUNT;
          const isCurrent = index === slideIdx;
          return (
            <div
              className={`hero__slide hero__slide--${s.tone}${isCurrent ? ' is-active' : ''}`}
              key={index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${originalIndex + 1} of ${COUNT}`}
              aria-hidden={!isCurrent}
              inert={isCurrent ? undefined : ''}
            >
              <Media className="media--fill hero__bg" style={{ background: s.bg, transform: `translateY(${scrollOffset}px)` }}>
                <img
                  src={`${BASE}assets/${s.image}`}
                  alt={s.alt}
                  width="2000"
                  height="1116"
                  loading={index <= 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchpriority={index === 1 ? 'high' : undefined}
                />
              </Media>
              <div className="hero__shade" />
              <div className="hero__content page-pad">
                <Slot as="p" className="slot--eyebrow-w">{s.eyebrow}</Slot>
                {/* the first slide carries the page's main heading */}
                <Slot as={originalIndex === 0 ? 'h1' : 'h2'} className="slot--hero-title">
                  <span className="hero__title-word">{s.title}</span>
                </Slot>
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
            className={`hero__dot${n === activeDot ? ' is-active' : ''}`}
            type="button"
            aria-label={`Show slide ${n + 1}: ${s.title}`}
            aria-current={n === activeDot ? 'true' : undefined}
            onClick={() => goToSlide(n)}
          >
            <i key={`${n}-${n === activeDot ? slideIdx : 'idle'}`} />
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
