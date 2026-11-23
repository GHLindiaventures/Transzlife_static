import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { productUrl } from '../../content/site.js';

// The 6 TranzLife Formulations recreated in the exact Blendy 3D Floating Showcase design
const PRODUCTS_SHOWCASE = [
  {
    id: 'gummies',
    navLabel: 'PulmoClear',
    bgWord: 'PULMO',
    bgColor: '#c3b2db', // Soft berry lavender matching the natural berry flavour & reference
    bottleImg: '/assets/product-4.png', // PulmoClear Gummies Jar
    alt: 'PulmoClear™ Lung Booster Gummies',
    tagline: 'Lung Detox & Respiratory Clarity',
    // Floating ingredients matching Blendy composition
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/amla.webp', name: 'Amla', blur: 10, size: 145 },
      foregroundTR: { src: '/assets/ingredients/cutout/black-pepper.webp', name: 'Black Pepper', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/tulsi.webp', name: 'Tulsi', size: 68 },
      midLeftBottom: { src: '/assets/ingredients/cutout/turmeric.webp', name: 'Turmeric', size: 76 },
      midRightTop: { src: '/assets/ingredients/cutout/licorice.webp', name: 'Mulethi', size: 78 },
      midRightBottom: { src: '/assets/ingredients/cutout/ginger.webp', name: 'Sukku', size: 72 },
      farRight: { src: '/assets/ingredients/cutout/long-pepper.webp', name: 'Thippili', size: 82 },
      baseLeaf: { src: '/assets/ingredients/cutout/vasaka.webp', name: 'Vasaka Leaf', size: 95 },
    },
  },
  {
    id: 'liver',
    navLabel: 'Liver Booster',
    bgWord: 'LIVER',
    bgColor: '#dfc8a5', // Warm golden herbal amber
    bottleImg: '/assets/product-5.png', // Liver Booster Bottle
    alt: 'LiverDetox™ Polyherbal Concoction',
    tagline: 'Hepatic Protection & Digestion',
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/amla.webp', name: 'Amla', blur: 10, size: 145 },
      foregroundTR: { src: '/assets/ingredients/cutout/kutki.webp', name: 'Kutki', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/bhumyamalaki.webp', name: 'Bhumyamalaki', size: 70 },
      midLeftBottom: { src: '/assets/ingredients/cutout/kalmegh.webp', name: 'Kalmegh', size: 76 },
      midRightTop: { src: '/assets/ingredients/cutout/haritaki.webp', name: 'Milk Thistle', size: 76 },
      midRightBottom: { src: '/assets/ingredients/cutout/punarnava.webp', name: 'Punarnava', size: 72 },
      farRight: { src: '/assets/ingredients/cutout/daruharidra.webp', name: 'Daruharidra', size: 82 },
      baseLeaf: { src: '/assets/ingredients/cutout/bhringraj.webp', name: 'Bhringraj', size: 92 },
    },
  },
  {
    id: 'rollon',
    navLabel: 'CycleRelief',
    bgWord: 'CYCLE',
    bgColor: '#cfbde3', // Calming botanical orchid lavender
    bottleImg: '/assets/product-1.png', // CycleRelief Roll-On
    alt: 'CycleRelief™ Menstrual Comfort Roll-On',
    tagline: 'Abdominal Comfort Ritual',
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus', blur: 10, size: 140 },
      foregroundTR: { src: '/assets/ingredients/cutout/dill.webp', name: 'Dill', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/lavender.webp', name: 'Lavender', size: 66 },
      midLeftBottom: { src: '/assets/ingredients/cutout/dill.webp', name: 'Dill Seed', size: 74 },
      midRightTop: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus', size: 76 },
      midRightBottom: { src: '/assets/ingredients/cutout/sesame.webp', name: 'Sesame', size: 70 },
      farRight: { src: '/assets/ingredients/cutout/lavender.webp', name: 'Lavender', size: 78 },
      baseLeaf: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus Sprig', size: 90 },
    },
  },
  {
    id: 'energy',
    navLabel: 'Energy Booster',
    bgWord: 'ENERGY',
    bgColor: '#c7b6df', // Energized royal violet
    bottleImg: '/assets/product-2.png', // Energy Booster Bottle
    alt: 'TranzLife Energy Booster™',
    tagline: 'Bioactive Vitality & Stamina',
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/echinacea.webp', name: 'Echinacea', blur: 10, size: 145 },
      foregroundTR: { src: '/assets/ingredients/cutout/symphytum.webp', name: 'Comfrey', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/ruta.webp', name: 'Ruta', size: 68 },
      midLeftBottom: { src: '/assets/ingredients/cutout/calc-phos.webp', name: 'Calc-Phos', size: 74 },
      midRightTop: { src: '/assets/ingredients/cutout/echinacea.webp', name: 'Echinacea', size: 78 },
      midRightBottom: { src: '/assets/ingredients/cutout/hecla-lava.webp', name: 'Hecla Lava', size: 70 },
      farRight: { src: '/assets/ingredients/cutout/symphytum.webp', name: 'Symphytum', size: 80 },
      baseLeaf: { src: '/assets/ingredients/cutout/ruta.webp', name: 'Ruta Sprig', size: 92 },
    },
  },
  {
    id: 'reviva',
    navLabel: 'Reviva',
    bgWord: 'REVIVA',
    bgColor: '#edd0b4', // Warm morning apricot peach
    bottleImg: '/assets/product-3.png', // Reviva Roll-On
    alt: 'Reviva™ Botanical Massage Roll-On',
    tagline: 'Daily Vitality Self-Care Ritual',
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/ginger.webp', name: 'Ginger', blur: 10, size: 140 },
      foregroundTR: { src: '/assets/ingredients/cutout/dill.webp', name: 'Dill', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus', size: 66 },
      midLeftBottom: { src: '/assets/ingredients/cutout/turmeric.webp', name: 'Turmeric', size: 74 },
      midRightTop: { src: '/assets/ingredients/cutout/dill.webp', name: 'Dill', size: 76 },
      midRightBottom: { src: '/assets/ingredients/cutout/black-turmeric.webp', name: 'Black Turmeric', size: 70 },
      farRight: { src: '/assets/ingredients/cutout/sesame.webp', name: 'Sesame', size: 78 },
      baseLeaf: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus Sprig', size: 90 },
    },
  },
  {
    id: 'inhaler',
    navLabel: 'BreatheFree',
    bgWord: 'BREATHE',
    bgColor: '#b8ded6', // Crisp cooling peppermint teal
    bottleImg: '/assets/product-6.png', // Pocket Inhaler
    alt: 'Craving Control™ Aromatherapy Inhaler',
    tagline: 'Clean Pocket Aromatherapy Pause',
    ingredients: {
      foregroundBL: { src: '/assets/ingredients/cutout/peppermint.webp', name: 'Peppermint', blur: 10, size: 140 },
      foregroundTR: { src: '/assets/ingredients/cutout/black-pepper.webp', name: 'Black Pepper', blur: 8, size: 110 },
      midLeftTop: { src: '/assets/ingredients/cutout/lavender.webp', name: 'Lavender', size: 66 },
      midLeftBottom: { src: '/assets/ingredients/cutout/tulsi.webp', name: 'Tulsi', size: 74 },
      midRightTop: { src: '/assets/ingredients/cutout/peppermint.webp', name: 'Peppermint', size: 76 },
      midRightBottom: { src: '/assets/ingredients/cutout/eucalyptus.webp', name: 'Eucalyptus', size: 70 },
      farRight: { src: '/assets/ingredients/cutout/black-pepper.webp', name: 'Black Pepper', size: 80 },
      baseLeaf: { src: '/assets/ingredients/cutout/peppermint.webp', name: 'Peppermint Sprig', size: 90 },
    },
  },
];

export default function ProductSlider() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const total = PRODUCTS_SHOWCASE.length;
  const curr = PRODUCTS_SHOWCASE[activeIdx];
  const url = productUrl(curr.id);

  const prev = () => setActiveIdx((prev) => (prev - 1 + total) % total);
  const next = () => setActiveIdx((prev) => (prev + 1) % total);

  // Auto-advance every 5 seconds, pauses when hovered
  useEffect(() => {
    if (isPaused) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % total);
    }, 5500);

    return () => clearInterval(timerRef.current);
  }, [isPaused, total]);

  return (
    <section
      className="blendy-stage-wrap"
      aria-label="Product Showcase"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
    >
      <div
        className="blendy-canvas"
        style={{ '--bg-hue': curr.bgColor }}
      >
        {/* Top Navigation Bar */}
        <header className="blendy-nav">
          <div className="blendy-nav__brand">
            <span className="blendy-nav__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </span>
            <span className="blendy-nav__logo">TranzLife</span>
          </div>

          <nav className="blendy-nav__tabs" role="tablist" aria-label="Product variants">
            {PRODUCTS_SHOWCASE.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activeIdx === idx}
                className={`blendy-nav__tab ${activeIdx === idx ? 'is-active' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                {p.navLabel}
              </button>
            ))}
          </nav>

          <div className="blendy-nav__right">
            <Link to="/shop" className="blendy-nav__link">Shop</Link>
            <span className="blendy-nav__sep" aria-hidden="true">|</span>
            <Link to="/science" className="blendy-nav__link">Science</Link>
          </div>
        </header>

        {/* Oversized Background Typography Behind Product */}
        <div className="blendy-backdrop" aria-hidden="true">
          <span className="blendy-backdrop__text" key={curr.bgWord}>
            {curr.bgWord}
          </span>
        </div>

        {/* Center Hero Product Bottle & Ground Shadow */}
        <div className="blendy-hero">
          <div className="blendy-bottle-box" key={`bottle-${curr.id}`}>
            <img
              src={curr.bottleImg}
              alt={curr.alt}
              className="blendy-bottle"
              loading="eager"
            />
            {/* Green botanical leaves tucked behind bottle base */}
            <img
              src={curr.ingredients.baseLeaf.src}
              alt=""
              className="blendy-base-leaf"
              aria-hidden="true"
            />
            {/* Soft Elliptical Ground Shadow */}
            <div className="blendy-ground-shadow" aria-hidden="true" />
          </div>
        </div>

        {/* Floating 3D Ingredients with Depth of Field & Bokeh */}
        <div className="blendy-orbit" key={`orbit-${curr.id}`} aria-hidden="true">
          {/* Foreground Deep-Blur (Camera Bokeh) */}
          <div className="b-ing b-ing--fg-bl" style={{ '--blur': `${curr.ingredients.foregroundBL.blur}px`, '--size': `${curr.ingredients.foregroundBL.size}px` }}>
            <img src={curr.ingredients.foregroundBL.src} alt="" />
          </div>

          <div className="b-ing b-ing--fg-tr" style={{ '--blur': `${curr.ingredients.foregroundTR.blur}px`, '--size': `${curr.ingredients.foregroundTR.size}px` }}>
            <img src={curr.ingredients.foregroundTR.src} alt="" />
          </div>

          {/* Midground Sharp Orbiting Botanicals with Drop Shadows */}
          <div className="b-ing b-ing--ml-top" style={{ '--size': `${curr.ingredients.midLeftTop.size}px` }}>
            <img src={curr.ingredients.midLeftTop.src} alt="" />
          </div>

          <div className="b-ing b-ing--ml-bot" style={{ '--size': `${curr.ingredients.midLeftBottom.size}px` }}>
            <img src={curr.ingredients.midLeftBottom.src} alt="" />
          </div>

          <div className="b-ing b-ing--mr-top" style={{ '--size': `${curr.ingredients.midRightTop.size}px` }}>
            <img src={curr.ingredients.midRightTop.src} alt="" />
          </div>

          <div className="b-ing b-ing--mr-bot" style={{ '--size': `${curr.ingredients.midRightBottom.size}px` }}>
            <img src={curr.ingredients.midRightBottom.src} alt="" />
          </div>

          <div className="b-ing b-ing--far-right" style={{ '--size': `${curr.ingredients.farRight.size}px` }}>
            <img src={curr.ingredients.farRight.src} alt="" />
          </div>
        </div>

        {/* Bottom Bar: Prev / Next Controls & "SHOP NOW" (Zero Prices) */}
        <footer className="blendy-footer">
          <button
            type="button"
            className="blendy-arrow blendy-arrow--prev"
            onClick={prev}
            aria-label="Previous product"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <Link to={url} className="blendy-cta" aria-label={`Shop ${curr.alt}`}>
            SHOP NOW
          </Link>

          <button
            type="button"
            className="blendy-arrow blendy-arrow--next"
            onClick={next}
            aria-label="Next product"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </footer>
      </div>
    </section>
  );
}
