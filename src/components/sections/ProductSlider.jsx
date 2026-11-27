import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { productUrl, STORE_ID } from '../../content/site.js';

// The 6 TranzLife Targeted Ayurvedic Formulations
// Static centered product image + top-to-bottom falling letters & floating botanicals.
// Strictly NO prices displayed. Changes only when the visitor picks a product (tabs, arrows, keyboard).
const ALL_FORMULATIONS = [
  {
    id: 'gummies',
    navTitle: 'PulmoClear',
    fullName: 'PulmoClear™ Lung Booster Gummies',
    subTitle: 'Respiratory Clarity & Daily Lung Detox',
    bgWord: 'PULMOCLEAR',
    bgColor: '#bca7dc', // Soft berry lilac matching Blendy reference & natural berry gummies
    bottleImg: '/assets/product-4.png?v=5',
    alt: 'PulmoClear™ Lung Booster Gummies packaging',
    tag: 'Lung Detox',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/ginger.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Dry Ginger' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/tulsi.webp', size: 80, rot: -8, delay: '0.12s', label: 'Tulsi' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/long-pepper.webp', size: 84, rot: 12, delay: '0.18s', label: 'Long Pepper' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/vasaka.webp', size: 105, rot: -20, delay: '0.22s', label: 'Vasaka Leaves' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/black-pepper.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Black Pepper' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/licorice.webp', size: 80, rot: 10, delay: '0.15s', label: 'Licorice' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/black-pepper.webp', size: 84, rot: -12, delay: '0.20s', label: 'Black Pepper' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/tulsi.webp', size: 100, rot: 24, delay: '0.25s', label: 'Tulsi' },
    ],
  },
  {
    id: 'liver',
    navTitle: 'LiverDetox',
    fullName: 'LiverDetox™ Polyherbal Concoction',
    subTitle: 'Hepatic Protection, Cell Repair & Digestion',
    bgWord: 'LIVERDETOX',
    bgColor: '#dfbe95', // Warm golden herbal ochre
    bottleImg: '/assets/product-5.png?v=5',
    alt: 'LiverDetox™ Polyherbal Concoction bottle',
    tag: 'Liver Booster',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/amla.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Amla' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/bhumyamalaki.webp', size: 80, rot: -8, delay: '0.12s', label: 'Bhumyamalaki' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/haritaki.webp', size: 84, rot: 14, delay: '0.18s', label: 'Haritaki' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/bhringraj.webp', size: 105, rot: -22, delay: '0.22s', label: 'Bhringraj' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/kalmegh.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Kalmegh' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/kutki.webp', size: 80, rot: 10, delay: '0.15s', label: 'Kutki' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/punarnava.webp', size: 84, rot: -14, delay: '0.20s', label: 'Punarnava' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/daruharidra.webp', size: 100, rot: 25, delay: '0.25s', label: 'Daruharidra' },
    ],
  },
  {
    id: 'rollon',
    navTitle: 'CycleRelief',
    fullName: 'CycleRelief™ Menstrual Comfort Roll-On',
    subTitle: 'Abdominal Soothing & Cramp Relief Ritual',
    bgWord: 'CYCLERELIEF',
    bgColor: '#c8b3e6', // Calming orchid lavender
    bottleImg: '/assets/product-1.png?v=5',
    alt: 'CycleRelief™ Menstrual Comfort Roll-On applicator',
    tag: 'Period Care',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/eucalyptus.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Eucalyptus' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/lavender.webp', size: 80, rot: -8, delay: '0.12s', label: 'Lavender' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/wintergreen.webp', size: 84, rot: 14, delay: '0.18s', label: 'Wintergreen' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/peppermint.webp', size: 105, rot: -20, delay: '0.22s', label: 'Peppermint' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/ginger.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Ginger' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/sesame.webp', size: 80, rot: 10, delay: '0.15s', label: 'Sesame' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/wintergreen.webp', size: 84, rot: -12, delay: '0.20s', label: 'Wintergreen' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/lavender.webp', size: 100, rot: 24, delay: '0.25s', label: 'Lavender' },
    ],
  },
  {
    id: 'energy',
    navTitle: 'Energy Booster',
    fullName: 'TranzLife Energy Booster™',
    subTitle: 'Bioactive Stamina, Vitality & Physical Endurance',
    bgWord: 'ENERGY BOOSTER',
    bgColor: '#ad98d6', // Vibrant energized royal violet
    bottleImg: '/assets/product-2.png?v=5',
    alt: 'TranzLife Energy Booster™ bottle',
    tag: 'Active Vitality',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/echinacea.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Echinacea' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/ruta.webp', size: 80, rot: -8, delay: '0.12s', label: 'Ruta' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/calc-phos.webp', size: 84, rot: 14, delay: '0.18s', label: 'Calc Phos' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/ruta.webp', size: 105, rot: -22, delay: '0.22s', label: 'Ruta' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/symphytum.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Symphytum' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/symphytum.webp', size: 80, rot: 10, delay: '0.15s', label: 'Symphytum' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/calc-phos.webp', size: 84, rot: -14, delay: '0.20s', label: 'Bioactive Minerals' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/echinacea.webp', size: 100, rot: 25, delay: '0.25s', label: 'Echinacea' },
    ],
  },
  {
    id: 'reviva',
    navTitle: 'Reviva',
    fullName: 'Reviva™ Botanical Massage Roll-On',
    subTitle: 'Morning Awakening & Vitality Self-Care Ritual',
    bgWord: 'REVIVA',
    bgColor: '#e8bfa1', // Warm sunrise apricot peach
    bottleImg: '/assets/product-3.png?v=5',
    alt: 'Reviva™ Botanical Massage Roll-On applicator',
    tag: 'Vitality Ritual',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/eucalyptus.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Eucalyptus' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/dill.webp', size: 80, rot: -8, delay: '0.12s', label: 'Dill Oil' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/eucalyptus.webp', size: 84, rot: 14, delay: '0.18s', label: 'Eucalyptus' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/eucalyptus.webp', size: 105, rot: -20, delay: '0.22s', label: 'Eucalyptus' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/dill.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Dill Oil' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/dill.webp', size: 80, rot: 10, delay: '0.15s', label: 'Dill Oil' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/eucalyptus.webp', size: 84, rot: -12, delay: '0.20s', label: 'Eucalyptus' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/dill.webp', size: 100, rot: 24, delay: '0.25s', label: 'Dill Oil' },
    ],
  },
  {
    id: 'inhaler',
    navTitle: 'BreatheFree',
    fullName: 'BreatheFree™ Aromatherapy Inhaler',
    subTitle: 'Fast-Acting Nicotine & Smoking Urge Relief',
    bgWord: 'BREATHEFREE',
    bgColor: '#9ecfc5', // Crisp cooling peppermint teal
    bottleImg: '/assets/product-6.png?v=5',
    alt: 'BreatheFree™ Aromatherapy Inhaler',
    tag: 'Quit Smoking Support',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/peppermint.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Peppermint' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/lavender.webp', size: 80, rot: -8, delay: '0.12s', label: 'Lavender' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/tulsi.webp', size: 84, rot: 14, delay: '0.18s', label: 'Tulsi' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/peppermint.webp', size: 105, rot: -22, delay: '0.22s', label: 'Peppermint' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/black-pepper.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Black Pepper' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/lemon.webp', size: 80, rot: 10, delay: '0.15s', label: 'Lemon' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/peppermint.webp', size: 84, rot: -12, delay: '0.20s', label: 'Peppermint' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/eucalyptus.webp', size: 100, rot: 25, delay: '0.25s', label: 'Eucalyptus' },
    ],
  },
  {
    id: 'drops',
    navTitle: 'BreatheFree Drops',
    fullName: 'BreatheFree™ Respiratory Wellness Drops',
    subTitle: 'Respiratory Wellness · Breathe Easy, Stay Clear',
    bgWord: 'BREATHEFREE DROPS',
    bgColor: '#a9cdb4', // Fresh eucalyptus green
    bottleImg: '/assets/product-7.png?v=5',
    alt: 'BreatheFree™ Respiratory Wellness Drops 30 ml bottle',
    tag: 'Respiratory Wellness',
    ingredients: [
      { key: 'tl-bokeh', zone: 'top-left-bokeh', src: '/assets/ingredients/cutout/peppermint.webp', blur: 10, size: 130, rot: -15, delay: '0.04s', label: 'Peppermint' },
      { key: 'tl-inner', zone: 'top-left-inner', src: '/assets/ingredients/cutout/tulsi.webp', size: 80, rot: -8, delay: '0.12s', label: 'Tulsi' },
      { key: 'mid-l', zone: 'mid-left', src: '/assets/ingredients/cutout/ginger.webp', size: 84, rot: 14, delay: '0.18s', label: 'Ginger' },
      { key: 'base-l', zone: 'base-left', src: '/assets/ingredients/cutout/peppermint.webp', size: 105, rot: -22, delay: '0.22s', label: 'Peppermint' },
      { key: 'tr-bokeh', zone: 'top-right-bokeh', src: '/assets/ingredients/cutout/tulsi.webp', blur: 10, size: 120, rot: 18, delay: '0.08s', label: 'Tulsi' },
      { key: 'tr-inner', zone: 'top-right-inner', src: '/assets/ingredients/cutout/eucalyptus.webp', size: 80, rot: 10, delay: '0.15s', label: 'Eucalyptus' },
      { key: 'mid-r', zone: 'mid-right', src: '/assets/ingredients/cutout/ginger.webp', size: 84, rot: -12, delay: '0.20s', label: 'Ginger' },
      { key: 'base-r', zone: 'base-right', src: '/assets/ingredients/cutout/peppermint.webp', size: 100, rot: 25, delay: '0.25s', label: 'Peppermint' },
    ],
  },
];


/**
 * The big white product name behind the bottle. It shows the FULL name and always fits: the font size is the
 * normal CSS size, scaled down only as far as needed so the longest line fits the stage width (no clipping, no
 * overflow). Names with two words (Energy Booster, BreatheFree Drops) stack on two lines, so they stay big.
 */
function FitWord({ word }) {
  const ref = useRef(null);
  const lines = word.split(' ');
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return undefined;
    const fit = () => {
      el.style.fontSize = '';
      const cap = parseFloat(getComputedStyle(el).fontSize) || 160;     // the size the stylesheet wants
      el.style.fontSize = '100px';
      let widest = 0;
      el.querySelectorAll('.blendy-word-line').forEach((l) => { widest = Math.max(widest, l.getBoundingClientRect().width); });
      const room = box.clientWidth * 0.94;
      el.style.fontSize = widest > 0 ? `${Math.floor(Math.min(cap, (100 * room) / widest))}px` : '';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    if (document.fonts?.ready) document.fonts.ready.then(fit);
    return () => ro.disconnect();
  }, [word]);
  return (
    <span ref={ref} key={word} className="blendy-word-text" aria-label={word}>
      {lines.map((l) => <span className="blendy-word-line" key={l} aria-hidden="true">{l}</span>)}
    </span>
  );
}

/** productIds: shop product ids in the order to show (from the dashboard); empty = all six. */
export default function ProductSlider({ productIds }) {
  const FORMULATIONS = (() => {
    if (!productIds?.length) return ALL_FORMULATIONS;
    const list = productIds.map((id) => ALL_FORMULATIONS.find((f) => STORE_ID[f.id] === id)).filter(Boolean);
    return list.length ? list : ALL_FORMULATIONS;
  })();
  const [activeIdx, setActiveIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef(null);
  const tabsRef = useRef(null);

  // Detect accessibility preference for reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const switchProduct = useCallback((idx) => {
    setActiveIdx(idx);
  }, []);

  const prevProduct = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + FORMULATIONS.length) % FORMULATIONS.length);
  }, []);

  const nextProduct = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % FORMULATIONS.length);
  }, []);

  // Keep the selected product's tab in view: when the tab row scrolls sideways (phones), slide it so the active
  // tab sits in the middle. Only the tab row moves, never the page.
  useEffect(() => {
    const nav = tabsRef.current;
    const tab = nav?.querySelector('.blendy-tab-btn.is-active');
    if (!nav || !tab) return;
    const n = nav.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    const left = nav.scrollLeft + (t.left - n.left) - (n.width - t.width) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeIdx, reduceMotion]);

  // No automatic transition: the visitor changes products with the tabs, the arrows or the keyboard.


  // Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') prevProduct();
      if (e.key === 'ArrowRight') nextProduct();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevProduct, nextProduct]);

  const current = FORMULATIONS[activeIdx];

  return (
    <section
      className="blendy-hero-stage"
      style={{ '--hero-bg': current.bgColor }}
      aria-label="Targeted Botanical Formulations Showcase"
    >
      {/* ==========================================================
          1. TOP NAVIGATION BAR (Exact Blendy Layout)
          Left: Brand Wordmark
          Center: Formulation Tabs (PulmoClear | LiverDetox | CycleRelief | Energy | Reviva | BreatheFree)
          Right: Formulation Category Tag
         ========================================================== */}
      <header className="blendy-top-nav">
        <div className="blendy-nav-brand">
          <Link to="/" className="blendy-brand-link" aria-label="TranzLife Biosciences Home">
            <span className="blendy-brand-text">TRANZLIFE</span>
          </Link>
        </div>

        <nav className="blendy-nav-tabs" ref={tabsRef} aria-label="Formulation selector">
          {FORMULATIONS.map((formulation, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={formulation.id}
                type="button"
                className={`blendy-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => switchProduct(idx)}
                aria-selected={isActive}
                role="tab"
              >
                <span>{formulation.navTitle}</span>
                {isActive && <span className="blendy-tab-underline" />}
              </button>
            );
          })}
        </nav>

        <div className="blendy-nav-meta">
          <span className="blendy-pill-badge">{current.tag}</span>
        </div>
      </header>

      {/* ==========================================================
          2. CENTER HERO STAGE
          - Large background letters falling smoothly from top to bottom
          - Floating ingredient images falling into designated positions
          - Completely STATIC product bottle in the center with NO movement
         ========================================================== */}
      <div className="blendy-center-stage">
        {/* Large background letters: falling smoothly from top to bottom */}
        <div className="blendy-backdrop-word" aria-hidden="true">
          <FitWord key={current.bgWord} word={current.bgWord} />
        </div>

        {/* Floating Botanicals Layer: evenly distributed with equal spacing, falling smoothly from top */}
        <div key={current.id} className="blendy-botanicals-layer" aria-hidden="true">
          {current.ingredients.map((ing) => (
            <div
              key={`${current.id}-${ing.key}`}
              className={`blendy-botanical-item bzone--${ing.zone}`}
              style={{
                '--ing-rot': `${ing.rot}deg`,
                '--fall-delay': ing.delay,
                '--ing-size': `${ing.size}px`,
                '--ing-blur': ing.blur ? `${ing.blur}px` : '0px',
              }}
            >
              <img src={ing.src} alt="" className="blendy-item-img" loading="lazy" decoding="async" />
            </div>
          ))}
        </div>

        {/* Central Product Packaging: COMPLETELY STATIC in the centre without any movement */}
        <div className="blendy-bottle-wrap">
          {/* Static Ground Contact Shadow */}
          <div className="blendy-ground-shadow" aria-hidden="true" />

          {/* Product Bottle Image: Fixed in position, no float, no rotation, no movement */}
          <img
            key={current.id}
            src={current.bottleImg}
            alt={current.alt}
            className="blendy-hero-bottle"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      {/* ==========================================================
          3. BOTTOM BAR (Exact Blendy Controls)
          - Left: Previous Arrow (←)
          - Center: Centered "SHOP NOW" link with clean underline
          - Right: Next Arrow (→)
         ========================================================== */}
      <footer className="blendy-bottom-bar">
        <button
          type="button"
          className="blendy-arrow-btn blendy-arrow--prev"
          onClick={prevProduct}
          aria-label={`Previous formulation: ${FORMULATIONS[(activeIdx - 1 + FORMULATIONS.length) % FORMULATIONS.length].fullName}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <div className="blendy-center-cta">
          <Link
            to={productUrl(current.id)}
            className="blendy-cta-link"
            aria-label={`Explore ${current.fullName}`}
          >
            <span>SHOP NOW</span>
            <span className="blendy-cta-underline" />
          </Link>
          <span className="blendy-variant-caption">
            {current.fullName} · {current.subTitle}
          </span>
        </div>

        <button
          type="button"
          className="blendy-arrow-btn blendy-arrow--next"
          onClick={nextProduct}
          aria-label={`Next formulation: ${FORMULATIONS[(activeIdx + 1) % FORMULATIONS.length].fullName}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </footer>
    </section>
  );
}
