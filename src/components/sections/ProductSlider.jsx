import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Media, ProductImg } from '../ui.jsx';
import { PRODUCTS, COMPARE_INTRO, productUrl } from '../../content/site.js';

// 6 products divided into two distinct therapeutic sets (3 at a time)
const SETS = [
  {
    id: 'core-daily',
    label: 'Core Daily Support',
    sub: 'Respiratory, Liver & Menstrual Comfort',
    products: [PRODUCTS[0], PRODUCTS[1], PRODUCTS[2]], // PulmoClear, LiverDetox, CycleRelief
  },
  {
    id: 'vitality',
    label: 'Targeted Vitality',
    sub: 'Bioactive Energy, Body Harmony & Craving Control',
    products: [PRODUCTS[4], PRODUCTS[3], PRODUCTS[5]], // Energy Booster, Reviva Roll-On, Craving Control Inhaler
  },
];

export default function ProductSlider() {
  const [setIdx, setSetIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef(null);

  // Check accessibility motion preferences
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Auto-advance every 6.5s, pausing when hovered or focused
  useEffect(() => {
    if (isPaused || reduceMotion) return undefined;
    timerRef.current = setInterval(() => {
      setSetIdx((prev) => (prev === 0 ? 1 : 0));
    }, 6500);

    return () => clearInterval(timerRef.current);
  }, [isPaused, reduceMotion]);

  const activeSet = SETS[setIdx];

  const prevSet = () => setSetIdx((prev) => (prev === 0 ? 1 : 0));
  const nextSet = () => setSetIdx((prev) => (prev === 0 ? 1 : 0));

  return (
    <section
      className="vcascade-section"
      id="targeted-formulations"
      aria-labelledby="vcascadeHeading"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      <header className="vcascade-intro container" data-reveal>
        <p className="vcascade-eyebrow">{COMPARE_INTRO.eyebrow || 'What each formula is designed to support'}</p>
        <h2 className="vcascade-headline" id="vcascadeHeading">Targeted Botanical Formulations</h2>
        <p className="vcascade-sub">
          Scientifically standardized Ayurvedic extracts and bioactive botanicals. Clean, targeted formulations designed for everyday wellness.
        </p>
      </header>

      <div className="container vcascade-stage">
        {/* The 3-up Vertical Card Grid */}
        <div
          className="vcascade-grid"
          key={setIdx}
          role="region"
          aria-live="polite"
          aria-label={`${activeSet.label} set`}
        >
          {activeSet.products.map((p, k) => {
            const url = productUrl(p.id);
            // Curate clean key actives without raw milligram dosage numbers
            const keyActives = (p.ingredients || [])
              .slice(0, 3)
              .map((ing) => ing.replace(/\s*\d+(mg|ml)?/gi, '').trim());

            return (
              <article
                key={p.id}
                className="vcascade-card"
                style={{ '--delay': `${k * 85}ms` }}
              >
                {/* Top Badge: Health Goal & Pack Size */}
                <div className="vcascade-card__meta">
                  <span className="vcascade-card__tag">{p.tag}</span>
                  <span className="vcascade-card__size">{p.size}</span>
                </div>

                {/* Media Stage: Premium Botanical Showcase */}
                <Link to={url} className="vcascade-card__media" tabIndex={-1} aria-hidden="true">
                  {p.showcase ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${p.showcase.replace(/^\//, '')}`}
                      alt={p.name}
                      className="vcascade-card__img"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Media className="media--fill media--product">
                      <ProductImg n={p.photo} alt={p.name} />
                    </Media>
                  )}
                  <span className="vcascade-card__halo" aria-hidden="true" />
                </Link>

                {/* Content Block (NO PRICES) */}
                <div className="vcascade-card__body">
                  <h3 className="vcascade-card__title">
                    <Link to={url}>{p.short || p.name}</Link>
                  </h3>

                  <p className="vcascade-card__desc">
                    {p.story?.text || p.desc}
                  </p>

                  <div className="vcascade-card__actives">
                    <span className="vcascade-card__actives-title">Key Botanicals</span>
                    <div className="vcascade-card__chips">
                      {keyActives.map((act, i) => (
                        <span key={i} className="vcascade-card__chip">{act}</span>
                      ))}
                    </div>
                  </div>

                  <Link to={url} className="vcascade-card__cta" aria-label={`Explore ${p.name} formulation`}>
                    <span>Explore Formulation</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Global Controls: Previous / Next & Segmented Set Switcher */}
        <div className="vcascade-controls" aria-label="Formulation set controls">
          <button
            type="button"
            className="vcascade-btn vcascade-btn--prev"
            onClick={prevSet}
            aria-label="Previous formulations set"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="vcascade-tabs" role="tablist" aria-label="Formulation categories">
            {SETS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={setIdx === idx}
                className={`vcascade-tab ${setIdx === idx ? 'is-active' : ''}`}
                onClick={() => setSetIdx(idx)}
              >
                <span className="vcascade-tab__num">0{idx + 1}</span>
                <span className="vcascade-tab__label">{s.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="vcascade-btn vcascade-btn--next"
            onClick={nextSet}
            aria-label="Next formulations set"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
