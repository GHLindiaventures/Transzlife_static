import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { productUrl } from '../../content/site.js';

// The 6 TranzLife formulations grouped into two 3-panel sets
// Designed in the exact Blendy 3D floating visual style (no prices)
const SETS = [
  {
    id: 'set-1',
    label: 'Core Daily Support',
    products: [
      {
        id: 'gummies',
        title: 'PulmoClear™',
        sub: 'Respiratory Clarity & Lung Detox',
        bgWord: 'PULMO',
        bgColor: '#c3b2db', // Soft berry lavender matching natural berry flavour & Blendy reference
        bottleImg: '/assets/product-4.png',
        alt: 'PulmoClear™ Lung Booster Gummies',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/amla.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/black-pepper.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/tulsi.webp', size: 52 },
          midR: { src: '/assets/ingredients/cutout/licorice.webp', size: 56 },
          baseLeaf: { src: '/assets/ingredients/cutout/vasaka.webp', size: 68 },
        },
      },
      {
        id: 'liver',
        title: 'LiverDetox™',
        sub: 'Hepatic Protection & Digestion',
        bgWord: 'LIVER',
        bgColor: '#dfc8a5', // Warm golden herbal ochre
        bottleImg: '/assets/product-5.png',
        alt: 'LiverDetox™ Polyherbal Concoction',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/amla.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/kutki.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/bhumyamalaki.webp', size: 52 },
          midR: { src: '/assets/ingredients/cutout/haritaki.webp', size: 56 },
          baseLeaf: { src: '/assets/ingredients/cutout/bhringraj.webp', size: 68 },
        },
      },
      {
        id: 'rollon',
        title: 'CycleRelief™',
        sub: 'Menstrual Comfort Ritual',
        bgWord: 'CYCLE',
        bgColor: '#cfbde3', // Calming botanical orchid lavender
        bottleImg: '/assets/product-1.png',
        alt: 'CycleRelief™ Menstrual Comfort Roll-On',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/eucalyptus.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/dill.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/lavender.webp', size: 50 },
          midR: { src: '/assets/ingredients/cutout/sesame.webp', size: 54 },
          baseLeaf: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 68 },
        },
      },
    ],
  },
  {
    id: 'set-2',
    label: 'Targeted Vitality',
    products: [
      {
        id: 'energy',
        title: 'Energy Booster™',
        sub: 'Bioactive Vitality & Stamina',
        bgWord: 'ENERGY',
        bgColor: '#c7b6df', // Royal energized violet
        bottleImg: '/assets/product-2.png',
        alt: 'TranzLife Energy Booster™',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/echinacea.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/symphytum.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/ruta.webp', size: 50 },
          midR: { src: '/assets/ingredients/cutout/calc-phos.webp', size: 54 },
          baseLeaf: { src: '/assets/ingredients/cutout/ruta.webp', size: 68 },
        },
      },
      {
        id: 'reviva',
        title: 'Reviva™',
        sub: 'Daily Vitality Self-Care Ritual',
        bgWord: 'REVIVA',
        bgColor: '#edd0b4', // Warm morning apricot peach
        bottleImg: '/assets/product-3.png',
        alt: 'Reviva™ Botanical Massage Roll-On',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/ginger.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/dill.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/turmeric.webp', size: 52 },
          midR: { src: '/assets/ingredients/cutout/black-turmeric.webp', size: 54 },
          baseLeaf: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 68 },
        },
      },
      {
        id: 'inhaler',
        title: 'Craving Control™',
        sub: 'Pocket Aromatherapy Inhaler',
        bgWord: 'BREATHE',
        bgColor: '#b8ded6', // Crisp cooling peppermint teal
        bottleImg: '/assets/product-6.png',
        alt: 'Craving Control™ Aromatherapy Inhaler',
        ingredients: {
          fgBL: { src: '/assets/ingredients/cutout/peppermint.webp', blur: 8, size: 95 },
          fgTR: { src: '/assets/ingredients/cutout/black-pepper.webp', blur: 6, size: 75 },
          midL: { src: '/assets/ingredients/cutout/lavender.webp', size: 50 },
          midR: { src: '/assets/ingredients/cutout/tulsi.webp', size: 54 },
          baseLeaf: { src: '/assets/ingredients/cutout/peppermint.webp', size: 68 },
        },
      },
    ],
  },
];

export default function ProductSlider() {
  const [setIdx, setSetIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef(null);

  // Accessibility: detect reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Auto-switch sets every 6 seconds, pausing on hover/focus
  useEffect(() => {
    if (isPaused || reduceMotion) return undefined;
    timerRef.current = setInterval(() => {
      setSetIdx((prev) => (prev === 0 ? 1 : 0));
    }, 6000);

    return () => clearInterval(timerRef.current);
  }, [isPaused, reduceMotion]);

  const activeSet = SETS[setIdx];

  const prevSet = () => setSetIdx((prev) => (prev === 0 ? 1 : 0));
  const nextSet = () => setSetIdx((prev) => (prev === 0 ? 1 : 0));

  return (
    <section
      className="blendy-section"
      id="targeted-formulations"
      aria-label="Targeted Botanical Formulations"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      <header className="blendy-intro container" data-reveal>
        <p className="blendy-eyebrow">WHAT EACH FORMULA IS DESIGNED TO SUPPORT</p>
        <h2 className="blendy-headline">Targeted Botanical Formulations</h2>
        <p className="blendy-sub">
          Scientifically standardized Ayurvedic extracts and bioactive botanicals. Clean, targeted formulations designed for everyday wellness.
        </p>
      </header>

      <div className="container blendy-viewport">
        {/* The 3 Vertical Panoramic Panels */}
        <div
          className="blendy-trio"
          key={setIdx}
          role="region"
          aria-live="polite"
          aria-label={`${activeSet.label} set`}
        >
          {activeSet.products.map((p, k) => {
            const url = productUrl(p.id);
            return (
              <article
                key={p.id}
                className="blendy-panel"
                style={{
                  '--bg': p.bgColor,
                  '--delay': `${k * 100}ms`,
                }}
              >
                {/* 1. Oversized Background Typography (Behind Product) */}
                <div className="bpanel-backdrop" aria-hidden="true">
                  <span className="bpanel-backdrop__word">{p.bgWord}</span>
                </div>

                {/* 2. Floating 3D Ingredients with Depth-of-Field Blur */}
                <div className="bpanel-orbit" aria-hidden="true">
                  {/* Foreground Blurred Bokeh Botanicals */}
                  <div
                    className="bpanel-ing bpanel-ing--fg-bl"
                    style={{ '--blur': `${p.ingredients.fgBL.blur}px`, '--size': `${p.ingredients.fgBL.size}px` }}
                  >
                    <img src={p.ingredients.fgBL.src} alt="" />
                  </div>

                  <div
                    className="bpanel-ing bpanel-ing--fg-tr"
                    style={{ '--blur': `${p.ingredients.fgTR.blur}px`, '--size': `${p.ingredients.fgTR.size}px` }}
                  >
                    <img src={p.ingredients.fgTR.src} alt="" />
                  </div>

                  {/* Midground Sharp Botanicals with Drop Shadows */}
                  <div
                    className="bpanel-ing bpanel-ing--mid-l"
                    style={{ '--size': `${p.ingredients.midL.size}px` }}
                  >
                    <img src={p.ingredients.midL.src} alt="" />
                  </div>

                  <div
                    className="bpanel-ing bpanel-ing--mid-r"
                    style={{ '--size': `${p.ingredients.midR.size}px` }}
                  >
                    <img src={p.ingredients.midR.src} alt="" />
                  </div>
                </div>

                {/* 3. Center Hero Floating Product Bottle */}
                <div className="bpanel-hero">
                  <Link to={url} className="bpanel-bottle-box" aria-label={`View ${p.title} details`}>
                    <img
                      src={p.bottleImg}
                      alt={p.alt}
                      className="bpanel-bottle"
                      loading="lazy"
                    />
                    {/* Natural Botanical Leaf at Bottle Base */}
                    <img
                      src={p.ingredients.baseLeaf.src}
                      alt=""
                      className="bpanel-base-leaf"
                      aria-hidden="true"
                    />
                    {/* Elliptical Ground Shadow */}
                    <div className="bpanel-ground-shadow" aria-hidden="true" />
                  </Link>
                </div>

                {/* 4. Bottom Footer (Name, Subtitle, Shop CTA - Zero Prices) */}
                <div className="bpanel-footer">
                  <h3 className="bpanel-title">
                    <Link to={url}>{p.title}</Link>
                  </h3>
                  <p className="bpanel-sub">{p.sub}</p>
                  <Link to={url} className="bpanel-cta" aria-label={`Shop ${p.title}`}>
                    SHOP NOW
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Navigation Controls: Previous / Next & Segmented Set Switcher */}
        <div className="blendy-controls" aria-label="Formulation set controls">
          <button
            type="button"
            className="blendy-ctrl-btn blendy-ctrl-btn--prev"
            onClick={prevSet}
            aria-label="Previous formulations set"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="blendy-set-tabs" role="tablist" aria-label="Formulation sets">
            {SETS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={setIdx === idx}
                className={`blendy-set-tab ${setIdx === idx ? 'is-active' : ''}`}
                onClick={() => setSetIdx(idx)}
              >
                <span className="blendy-set-tab__num">0{idx + 1}</span>
                <span className="blendy-set-tab__label">{s.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="blendy-ctrl-btn blendy-ctrl-btn--next"
            onClick={nextSet}
            aria-label="Next formulations set"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
