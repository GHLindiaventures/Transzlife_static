import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { productUrl } from '../../content/site.js';

// The 6 TranzLife Targeted Ayurvedic Formulations
// Exact 1:1 MotionSites Smoothie Slider layout, proportions, and motion mechanics.
// Single centered hero bottle + oversized background typography + 3D floating botanicals with bokeh blur.
// Strictly NO prices displayed.
const FORMULATIONS = [
  {
    id: 'gummies',
    navTitle: 'PulmoClear',
    fullName: 'PulmoClear™ Lung Booster Gummies',
    subTitle: 'Respiratory Clarity & Daily Lung Detox',
    bgWord: 'PULMO',
    bgColor: '#bca7dc', // Soft berry lilac matching Blendy reference and berry gummies
    bottleImg: '/assets/product-4.png',
    alt: 'PulmoClear™ Lung Booster Gummies packaging',
    tag: 'Lung Detox',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/amla.webp', blur: 14, size: 175, rot: -15, label: 'Indian Gooseberry (Amla)' },
      fgTR: { src: '/assets/ingredients/cutout/black-pepper.webp', blur: 12, size: 145, rot: 25, label: 'Black Pepper' },
      midTL: { src: '/assets/ingredients/cutout/tulsi.webp', size: 82, rot: -10, top: '22%', left: '26%', label: 'Holy Basil (Tulsi)' },
      midML: { src: '/assets/ingredients/cutout/amla.webp', size: 92, rot: 18, top: '55%', left: '19%', label: 'Amla' },
      baseL: { src: '/assets/ingredients/cutout/vasaka.webp', size: 115, rot: -22, bottom: '19%', left: 'calc(50% - 165px)', label: 'Vasaka Leaves' },
      baseR: { src: '/assets/ingredients/cutout/tulsi.webp', size: 105, rot: 28, bottom: '21%', right: 'calc(50% - 160px)', label: 'Tulsi' },
      midTR: { src: '/assets/ingredients/cutout/licorice.webp', size: 88, rot: 15, top: '27%', right: '24%', label: 'Mulethi (Licorice)' },
      midBR: { src: '/assets/ingredients/cutout/black-pepper.webp', size: 80, rot: -12, top: '65%', right: '27%', label: 'Black Pepper' },
      midFarR: { src: '/assets/ingredients/cutout/amla.webp', size: 90, rot: 30, top: '51%', right: '13%', label: 'Amla' },
    },
  },
  {
    id: 'liver',
    navTitle: 'LiverDetox',
    fullName: 'LiverDetox™ Polyherbal Concoction',
    subTitle: 'Hepatic Protection, Cell Repair & Digestion',
    bgWord: 'LIVER',
    bgColor: '#dfbe95', // Warm golden herbal ochre
    bottleImg: '/assets/product-5.png',
    alt: 'LiverDetox™ Polyherbal Concoction bottle',
    tag: 'Liver Booster',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/amla.webp', blur: 14, size: 175, rot: -18, label: 'Amla' },
      fgTR: { src: '/assets/ingredients/cutout/kutki.webp', blur: 12, size: 140, rot: 20, label: 'Kutki' },
      midTL: { src: '/assets/ingredients/cutout/bhumyamalaki.webp', size: 85, rot: -12, top: '23%', left: '25%', label: 'Bhumyamalaki' },
      midML: { src: '/assets/ingredients/cutout/haritaki.webp', size: 88, rot: 22, top: '56%', left: '20%', label: 'Haritaki' },
      baseL: { src: '/assets/ingredients/cutout/bhringraj.webp', size: 118, rot: -25, bottom: '19%', left: 'calc(50% - 165px)', label: 'Bhringraj' },
      baseR: { src: '/assets/ingredients/cutout/daruharidra.webp', size: 105, rot: 32, bottom: '21%', right: 'calc(50% - 160px)', label: 'Daruharidra' },
      midTR: { src: '/assets/ingredients/cutout/kutki.webp', size: 82, rot: 14, top: '28%', right: '24%', label: 'Kutki' },
      midBR: { src: '/assets/ingredients/cutout/amla.webp', size: 82, rot: -15, top: '64%', right: '28%', label: 'Amla' },
      midFarR: { src: '/assets/ingredients/cutout/bhumyamalaki.webp', size: 92, rot: 28, top: '49%', right: '14%', label: 'Bhumyamalaki' },
    },
  },
  {
    id: 'rollon',
    navTitle: 'CycleRelief',
    fullName: 'CycleRelief™ Menstrual Comfort Roll-On',
    subTitle: 'Abdominal Soothing & Cramp Relief Ritual',
    bgWord: 'CYCLE',
    bgColor: '#c8b3e6', // Calming botanical orchid lavender
    bottleImg: '/assets/product-1.png',
    alt: 'CycleRelief™ Menstrual Comfort Roll-On applicator',
    tag: 'Period Care',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/eucalyptus.webp', blur: 14, size: 175, rot: -12, label: 'Eucalyptus' },
      fgTR: { src: '/assets/ingredients/cutout/lavender.webp', blur: 12, size: 140, rot: 25, label: 'Lavender' },
      midTL: { src: '/assets/ingredients/cutout/lavender.webp', size: 82, rot: -15, top: '22%', left: '26%', label: 'Lavender' },
      midML: { src: '/assets/ingredients/cutout/dill.webp', size: 86, rot: 16, top: '54%', left: '19%', label: 'Dill Essential Oil' },
      baseL: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 115, rot: -20, bottom: '19%', left: 'calc(50% - 165px)', label: 'Eucalyptus' },
      baseR: { src: '/assets/ingredients/cutout/lavender.webp', size: 105, rot: 26, bottom: '21%', right: 'calc(50% - 160px)', label: 'Lavender' },
      midTR: { src: '/assets/ingredients/cutout/sesame.webp', size: 85, rot: 12, top: '27%', right: '24%', label: 'Sesame Seed Oil' },
      midBR: { src: '/assets/ingredients/cutout/dill.webp', size: 80, rot: -14, top: '65%', right: '27%', label: 'Dill Oil' },
      midFarR: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 92, rot: 22, top: '50%', right: '13%', label: 'Eucalyptus' },
    },
  },
  {
    id: 'energy',
    navTitle: 'Energy Booster',
    fullName: 'TranzLife Energy Booster™',
    subTitle: 'Bioactive Stamina, Vitality & Physical Endurance',
    bgWord: 'ENERGY',
    bgColor: '#ad98d6', // Vibrant energized royal violet
    bottleImg: '/assets/product-2.png',
    alt: 'TranzLife Energy Booster™ bottle',
    tag: 'Active Vitality',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/echinacea.webp', blur: 14, size: 175, rot: -16, label: 'Echinacea' },
      fgTR: { src: '/assets/ingredients/cutout/symphytum.webp', blur: 12, size: 145, rot: 22, label: 'Symphytum' },
      midTL: { src: '/assets/ingredients/cutout/ruta.webp', size: 82, rot: -10, top: '22%', left: '26%', label: 'Ruta' },
      midML: { src: '/assets/ingredients/cutout/calc-phos.webp', size: 88, rot: 15, top: '55%', left: '19%', label: 'Calcarea Phosphorica' },
      baseL: { src: '/assets/ingredients/cutout/ruta.webp', size: 115, rot: -24, bottom: '19%', left: 'calc(50% - 165px)', label: 'Ruta' },
      baseR: { src: '/assets/ingredients/cutout/echinacea.webp', size: 105, rot: 30, bottom: '21%', right: 'calc(50% - 160px)', label: 'Echinacea' },
      midTR: { src: '/assets/ingredients/cutout/symphytum.webp', size: 85, rot: 15, top: '27%', right: '24%', label: 'Symphytum' },
      midBR: { src: '/assets/ingredients/cutout/calc-phos.webp', size: 80, rot: -12, top: '65%', right: '27%', label: 'Bioactive Minerals' },
      midFarR: { src: '/assets/ingredients/cutout/ruta.webp', size: 90, rot: 25, top: '51%', right: '13%', label: 'Ruta' },
    },
  },
  {
    id: 'reviva',
    navTitle: 'Reviva',
    fullName: 'Reviva™ Botanical Massage Roll-On',
    subTitle: 'Morning Awakening & Vitality Self-Care Ritual',
    bgWord: 'REVIVA',
    bgColor: '#e8bfa1', // Warm sunrise apricot peach
    bottleImg: '/assets/product-3.png',
    alt: 'Reviva™ Botanical Massage Roll-On applicator',
    tag: 'Vitality Ritual',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/ginger.webp', blur: 14, size: 175, rot: -14, label: 'Ginger' },
      fgTR: { src: '/assets/ingredients/cutout/dill.webp', blur: 12, size: 140, rot: 24, label: 'Dill Oil' },
      midTL: { src: '/assets/ingredients/cutout/turmeric.webp', size: 82, rot: -12, top: '22%', left: '26%', label: 'Turmeric' },
      midML: { src: '/assets/ingredients/cutout/black-turmeric.webp', size: 88, rot: 18, top: '54%', left: '19%', label: 'Black Turmeric' },
      baseL: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 115, rot: -22, bottom: '19%', left: 'calc(50% - 165px)', label: 'Eucalyptus' },
      baseR: { src: '/assets/ingredients/cutout/ginger.webp', size: 105, rot: 28, bottom: '21%', right: 'calc(50% - 160px)', label: 'Ginger' },
      midTR: { src: '/assets/ingredients/cutout/dill.webp', size: 84, rot: 14, top: '27%', right: '24%', label: 'Dill Oil' },
      midBR: { src: '/assets/ingredients/cutout/turmeric.webp', size: 80, rot: -15, top: '65%', right: '27%', label: 'Turmeric' },
      midFarR: { src: '/assets/ingredients/cutout/ginger.webp', size: 92, rot: 25, top: '50%', right: '13%', label: 'Ginger' },
    },
  },
  {
    id: 'inhaler',
    navTitle: 'BreatheFree',
    fullName: 'Craving Control™ Aromatherapy Inhaler',
    subTitle: 'Fast-Acting Nicotine & Smoking Urge Relief',
    bgWord: 'BREATHE',
    bgColor: '#9ecfc5', // Crisp cooling peppermint teal
    bottleImg: '/assets/product-6.png',
    alt: 'Craving Control™ Aromatherapy Inhaler',
    tag: 'Craving Control',
    ingredients: {
      fgBL: { src: '/assets/ingredients/cutout/peppermint.webp', blur: 14, size: 175, rot: -15, label: 'Peppermint' },
      fgTR: { src: '/assets/ingredients/cutout/black-pepper.webp', blur: 12, size: 140, rot: 25, label: 'Black Pepper' },
      midTL: { src: '/assets/ingredients/cutout/lavender.webp', size: 82, rot: -10, top: '22%', left: '26%', label: 'Lavender' },
      midML: { src: '/assets/ingredients/cutout/tulsi.webp', size: 88, rot: 16, top: '55%', left: '19%', label: 'Tulsi' },
      baseL: { src: '/assets/ingredients/cutout/peppermint.webp', size: 115, rot: -24, bottom: '19%', left: 'calc(50% - 165px)', label: 'Peppermint' },
      baseR: { src: '/assets/ingredients/cutout/eucalyptus.webp', size: 105, rot: 30, bottom: '21%', right: 'calc(50% - 160px)', label: 'Eucalyptus' },
      midTR: { src: '/assets/ingredients/cutout/black-pepper.webp', size: 84, rot: 15, top: '27%', right: '24%', label: 'Black Pepper' },
      midBR: { src: '/assets/ingredients/cutout/peppermint.webp', size: 80, rot: -12, top: '65%', right: '27%', label: 'Peppermint' },
      midFarR: { src: '/assets/ingredients/cutout/tulsi.webp', size: 90, rot: 26, top: '51%', right: '13%', label: 'Tulsi' },
    },
  },
];

export default function ProductSlider() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(null);
  const timerRef = useRef(null);
  const heroRef = useRef(null);

  // Detect accessibility preference for reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const switchProduct = useCallback((idx) => {
    if (idx === activeIdx || isTransitioning) return;
    setIsTransitioning(true);
    setActiveIdx(idx);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, [activeIdx, isTransitioning]);

  const prevProduct = useCallback(() => {
    const nextIdx = (activeIdx - 1 + FORMULATIONS.length) % FORMULATIONS.length;
    switchProduct(nextIdx);
  }, [activeIdx, switchProduct]);

  const nextProduct = useCallback(() => {
    const nextIdx = (activeIdx + 1) % FORMULATIONS.length;
    switchProduct(nextIdx);
  }, [activeIdx, switchProduct]);

  // Autoplay cycle every 6 seconds, paused on user hover/touch
  useEffect(() => {
    if (isPaused || reduceMotion) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % FORMULATIONS.length);
    }, 6000);

    return () => clearInterval(timerRef.current);
  }, [isPaused, reduceMotion]);

  // Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') prevProduct();
      if (e.key === 'ArrowRight') nextProduct();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevProduct, nextProduct]);

  // Mouse parallax tracking
  const handleMouseMove = (e) => {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
    setIsPaused(false);
  };

  // Touch swipe support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) nextProduct();
    else if (diff < -50) prevProduct();
    touchStartX.current = null;
    setIsPaused(false);
  };

  const current = FORMULATIONS[activeIdx];
  const { ingredients } = current;

  return (
    <section
      ref={heroRef}
      className="blendy-hero-stage"
      style={{ '--hero-bg': current.bgColor }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Targeted Botanical Formulations Showcase"
    >
      {/* ==========================================================
          1. TOP NAVIGATION BAR (Exact Blendy Layout)
          Left: Logo / Brand Wordmark
          Center: Formulation Tabs (PulmoClear | LiverDetox | CycleRelief | Energy | Reviva | BreatheFree)
          Right: Badge / Botanical Purity indicator
         ========================================================== */}
      <header className="blendy-top-nav">
        <div className="blendy-nav-brand">
          <Link to="/" className="blendy-brand-link" aria-label="TranzLife Biosciences Home">
            <span className="blendy-brand-text">TRANZLIFE</span>
          </Link>
        </div>

        <nav className="blendy-nav-tabs" aria-label="Formulation selector">
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
          2. CENTER HERO STAGE (Exact Blendy Composition)
          - Giant Typography behind product
          - Centered floating product bottle with levitating ground shadow
          - 3D Floating Botanical Ingredients with Depth-of-Field Blur
         ========================================================== */}
      <div className="blendy-center-stage">
        {/* Giant Oversized Typography behind the product bottle */}
        <div
          className="blendy-backdrop-word"
          aria-hidden="true"
          style={{
            transform: `translate(calc(-50% + ${mouseOffset.x * -18}px), calc(-50% + ${mouseOffset.y * -14}px))`,
          }}
        >
          <span key={current.bgWord} className="blendy-word-text">
            {current.bgWord}
          </span>
        </div>

        {/* Floating Botanicals Layer (Layered Depth & Camera Bokeh) */}
        <div className="blendy-botanicals-layer" aria-hidden="true">
          {/* Foreground Bottom-Left (Extreme Bokeh Blur) */}
          <div
            className="blendy-botanical-item bitem--fg-bl"
            style={{
              transform: `translate(${mouseOffset.x * 32}px, ${mouseOffset.y * 28}px) rotate(${ingredients.fgBL.rot}deg)`,
              filter: `blur(${ingredients.fgBL.blur}px)`,
              width: `${ingredients.fgBL.size}px`,
              height: `${ingredients.fgBL.size}px`,
            }}
          >
            <img src={ingredients.fgBL.src} alt="" className="blendy-item-img" />
          </div>

          {/* Foreground Top-Right (Extreme Bokeh Blur) */}
          <div
            className="blendy-botanical-item bitem--fg-tr"
            style={{
              transform: `translate(${mouseOffset.x * -28}px, ${mouseOffset.y * 24}px) rotate(${ingredients.fgTR.rot}deg)`,
              filter: `blur(${ingredients.fgTR.blur}px)`,
              width: `${ingredients.fgTR.size}px`,
              height: `${ingredients.fgTR.size}px`,
            }}
          >
            <img src={ingredients.fgTR.src} alt="" className="blendy-item-img" />
          </div>

          {/* Midground Upper-Left (Sharp with Drop Shadow) */}
          <div
            className="blendy-botanical-item bitem--mid-tl"
            style={{
              top: ingredients.midTL.top,
              left: ingredients.midTL.left,
              transform: `translate(${mouseOffset.x * 16}px, ${mouseOffset.y * 14}px) rotate(${ingredients.midTL.rot}deg)`,
              width: `${ingredients.midTL.size}px`,
              height: `${ingredients.midTL.size}px`,
            }}
          >
            <img src={ingredients.midTL.src} alt="" className="blendy-item-img" />
          </div>

          {/* Midground Mid-Left (Sharp with Drop Shadow) */}
          <div
            className="blendy-botanical-item bitem--mid-ml"
            style={{
              top: ingredients.midML.top,
              left: ingredients.midML.left,
              transform: `translate(${mouseOffset.x * 20}px, ${mouseOffset.y * 18}px) rotate(${ingredients.midML.rot}deg)`,
              width: `${ingredients.midML.size}px`,
              height: `${ingredients.midML.size}px`,
            }}
          >
            <img src={ingredients.midML.src} alt="" className="blendy-item-img" />
          </div>

          {/* Base-Left Leaf (Peeking behind bottle base) */}
          <div
            className="blendy-botanical-item bitem--base-l"
            style={{
              bottom: ingredients.baseL.bottom,
              left: ingredients.baseL.left,
              transform: `translate(${mouseOffset.x * 8}px, ${mouseOffset.y * 8}px) rotate(${ingredients.baseL.rot}deg)`,
              width: `${ingredients.baseL.size}px`,
              height: `${ingredients.baseL.size}px`,
            }}
          >
            <img src={ingredients.baseL.src} alt="" className="blendy-item-img" />
          </div>

          {/* Base-Right Leaf (Peeking behind bottle base) */}
          <div
            className="blendy-botanical-item bitem--base-r"
            style={{
              bottom: ingredients.baseR.bottom,
              right: ingredients.baseR.right,
              transform: `translate(${mouseOffset.x * -8}px, ${mouseOffset.y * 8}px) rotate(${ingredients.baseR.rot}deg)`,
              width: `${ingredients.baseR.size}px`,
              height: `${ingredients.baseR.size}px`,
            }}
          >
            <img src={ingredients.baseR.src} alt="" className="blendy-item-img" />
          </div>

          {/* Midground Upper-Right (Sharp with Drop Shadow) */}
          <div
            className="blendy-botanical-item bitem--mid-tr"
            style={{
              top: ingredients.midTR.top,
              right: ingredients.midTR.right,
              transform: `translate(${mouseOffset.x * -16}px, ${mouseOffset.y * 14}px) rotate(${ingredients.midTR.rot}deg)`,
              width: `${ingredients.midTR.size}px`,
              height: `${ingredients.midTR.size}px`,
            }}
          >
            <img src={ingredients.midTR.src} alt="" className="blendy-item-img" />
          </div>

          {/* Midground Lower-Right (Sharp with Drop Shadow) */}
          <div
            className="blendy-botanical-item bitem--mid-br"
            style={{
              top: ingredients.midBR.top,
              right: ingredients.midBR.right,
              transform: `translate(${mouseOffset.x * -20}px, ${mouseOffset.y * 18}px) rotate(${ingredients.midBR.rot}deg)`,
              width: `${ingredients.midBR.size}px`,
              height: `${ingredients.midBR.size}px`,
            }}
          >
            <img src={ingredients.midBR.src} alt="" className="blendy-item-img" />
          </div>

          {/* Midground Far-Right (Sharp with Drop Shadow) */}
          <div
            className="blendy-botanical-item bitem--mid-far-r"
            style={{
              top: ingredients.midFarR.top,
              right: ingredients.midFarR.right,
              transform: `translate(${mouseOffset.x * -24}px, ${mouseOffset.y * 20}px) rotate(${ingredients.midFarR.rot}deg)`,
              width: `${ingredients.midFarR.size}px`,
              height: `${ingredients.midFarR.size}px`,
            }}
          >
            <img src={ingredients.midFarR.src} alt="" className="blendy-item-img" />
          </div>
        </div>

        {/* Central Levitating Product Packaging */}
        <div
          className="blendy-bottle-wrap"
          style={{
            transform: `perspective(1000px) rotateY(${mouseOffset.x * 9}deg) rotateX(${-mouseOffset.y * 6}deg)`,
          }}
        >
          {/* Ground Contact Shadow */}
          <div className="blendy-ground-shadow" aria-hidden="true" />

          {/* Bottle Image with Ambient Float Animation */}
          <img
            key={current.id}
            src={current.bottleImg}
            alt={current.alt}
            className="blendy-hero-bottle"
            loading="eager"
          />
        </div>
      </div>

      {/* ==========================================================
          3. BOTTOM BAR (Exact Blendy Controls)
          - Left: Previous Arrow (←)
          - Center: Centered "SHOP NOW" / "EXPLORE FORMULA" link with white underline
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
