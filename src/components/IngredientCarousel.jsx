import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BOTANICAL_INGREDIENTS, INGREDIENT_CATEGORIES } from '../store/data/botanicalIngredients';
import '../styles/ingredients-carousel.css';

const PHOTOS = new Set(['haritaki']);
const VISIBLE = 2; // cards visible on each side of center

export default function IngredientCarousel() {
  const [cat, setCat] = useState('all');
  const [deck, setDeck] = useState(() => [...BOTANICAL_INGREDIENTS]);
  const [active, setActive] = useState(1);
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  const stageRef = useRef(null);
  const pointerDownX = useRef(null);
  const wasSwiped = useRef(false);

  // Filter deck when category changes
  useEffect(() => {
    const nextDeck =
      cat === 'all'
        ? [...BOTANICAL_INGREDIENTS]
        : BOTANICAL_INGREDIENTS.filter((item) => item.category && item.category.includes(cat));
    setDeck(nextDeck);
    setActive(0);
  }, [cat]);

  const go = useCallback(
    (step) => {
      if (deck.length < 2) return;
      setActive((prev) => (prev + step + deck.length) % deck.length);
    },
    [deck.length]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIngredient) {
        if (e.key === 'Escape') setSelectedIngredient(null);
        return;
      }
      if (!stageRef.current || !stageRef.current.contains(document.activeElement)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [go, selectedIngredient]);

  // Pointer / Swipe Handling
  const handlePointerDown = (e) => {
    pointerDownX.current = e.clientX;
    wasSwiped.current = false;
  };

  const handlePointerUp = (e) => {
    if (pointerDownX.current === null) return;
    const dx = e.clientX - pointerDownX.current;
    pointerDownX.current = null;
    if (Math.abs(dx) > 40) {
      wasSwiped.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };

  const handleCardClick = (i, d, item) => {
    if (wasSwiped.current) return;
    if (d === 0) {
      setSelectedIngredient(item);
    } else {
      setActive(i);
    }
  };

  const scrollToDirectory = (e) => {
    e.preventDefault();
    const dirEl = document.getElementById('directory') || document.querySelector('.ing-tools');
    if (dirEl) {
      dirEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const n = deck.length;

  return (
    <section className="ix-hero" data-slot="carousel" aria-label="Our Ingredients Showcase">
      {/* Background imagery & light veil */}
      <div className="ix-bg" aria-hidden="true">
        <img
          src="/assets/ingredients-hero-light.webp"
          alt=""
          loading="eager"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="ix-bg-shade" />
        <div className="ix-bg-rays" />
      </div>

      {/* Floating botanical leaves */}
      <div className="ix-drift" aria-hidden="true">
        <svg className="ix-leaf l1" viewBox="0 0 40 40">
          <path d="M5 35 C10 15, 25 5, 35 5 C35 25, 25 35, 5 35 Z" />
          <path className="v" d="M5 35 Q20 20 35 5" />
        </svg>
        <svg className="ix-leaf l2" viewBox="0 0 40 40">
          <path d="M5 35 C10 15, 25 5, 35 5 C35 25, 25 35, 5 35 Z" />
          <path className="v" d="M5 35 Q20 20 35 5" />
        </svg>
        <svg className="ix-leaf l3" viewBox="0 0 40 40">
          <path d="M5 35 C10 15, 25 5, 35 5 C35 25, 25 35, 5 35 Z" />
        </svg>
        <svg className="ix-leaf l4" viewBox="0 0 40 40">
          <path d="M5 35 C10 15, 25 5, 35 5 C35 25, 25 35, 5 35 Z" />
        </svg>
      </div>

      <div className="ix-inner">
        {/* Section Header */}
        <header className="ix-head">
          <span className="ix-kicker">Ethical Sourcing &amp; Standardized Botany</span>
          <h1 className="ix-title">
            Our <em>Ingredients</em>
          </h1>
          <p className="ix-sub">
            Classical botanicals, essential oils and standardized extracts powering TranzLife formulations.
          </p>
          <div className="ix-flourish" aria-hidden="true">
            <i />
            <svg viewBox="0 0 24 24">
              <path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" />
            </svg>
            <i />
          </div>
        </header>

        {/* Benefit filter pills */}
        <div className="ix-filters" role="group" aria-label="Filter ingredients by benefit">
          <button
            type="button"
            className={`ix-pill ${cat === 'all' ? 'is-on' : ''}`}
            onClick={() => setCat('all')}
          >
            All Ingredients <span className="ix-pill-n">({BOTANICAL_INGREDIENTS.length})</span>
          </button>
          {INGREDIENT_CATEGORIES.map((c) => {
            const count = BOTANICAL_INGREDIENTS.filter(
              (item) => item.category && item.category.includes(c.id)
            ).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`ix-pill ${cat === c.id ? 'is-on' : ''}`}
                onClick={() => setCat(c.id)}
              >
                {c.label} <span className="ix-pill-n">({count})</span>
              </button>
            );
          })}
        </div>

        {/* 3D Carousel Stage */}
        <div
          ref={stageRef}
          className="ix-stage"
          role="region"
          aria-roledescription="carousel"
          aria-label="Botanical ingredient showcase"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          {/* Navigation Arrows */}
          <button
            className="ix-arrow prev"
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous ingredient"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* Ambient center ripple pool */}
          <div className="ix-pool" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          {/* Perspective 3D Track */}
          <div className="ix-track">
            {deck.map((item, i) => {
              let d = i - active;
              if (d > n / 2) d -= n;
              if (d < -n / 2) d += n;
              const ad = Math.abs(d);
              const isCenter = d === 0;
              const isOff = ad > VISIBLE;
              const isPhoto = PHOTOS.has(item.id);

              return (
                <article
                  key={item.id}
                  className={`ix-card ${isCenter ? 'is-center' : ''} ${isOff ? 'is-off' : ''}`}
                  style={{
                    '--d': d,
                    '--ad': ad,
                    zIndex: 10 - ad,
                  }}
                  onClick={() => handleCardClick(i, d, item)}
                  aria-hidden={!isCenter}
                >
                  <div className={`ix-card-media ${isPhoto ? 'is-photo' : ''}`}>
                    <span className="ix-halo" aria-hidden="true" />
                    <img
                      src={`/assets/ingredients/cutout/${item.id}.webp`}
                      alt={item.name}
                      loading={ad <= 1 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = `/assets/ingredients/${item.id}.webp`;
                      }}
                    />
                  </div>

                  <span className="ix-badge">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" />
                      <path d="M5 19 14 10" />
                    </svg>
                    {item.tradition || 'Botanical'}
                  </span>

                  <h3 className="ix-name">{item.name}</h3>
                  <p className="ix-latin">{item.latin}</p>
                  <p className="ix-desc">{item.desc}</p>

                  <button
                    className="ix-details"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIngredient(item);
                    }}
                  >
                    View Details
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </article>
              );
            })}
          </div>

          <button
            className="ix-arrow next"
            type="button"
            onClick={() => go(1)}
            aria-label="Next ingredient"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Footer Trust Bar & Directory Jump */}
        <div className="ix-foot">
          <ul className="ix-trust">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" />
                <path d="M5 19 14 10" />
              </svg>
              <span>
                <b>100% Botanical Actives</b>Ethically wildcrafted &amp; farmed
              </span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>
                <b>Standardized Potency</b>Third-party HPLC tested
              </span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>
                <b>Complete Transparency</b>Full disclosure per product
              </span>
            </li>
          </ul>

          <a className="ix-explore" href="#directory" onClick={scrollToDirectory}>
            Explore Full Directory
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </div>

      {/* Ingredient Details Modal Dialog */}
      {selectedIngredient && (
        <div
          className="ix-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ing-title"
          onClick={() => setSelectedIngredient(null)}
        >
          <div
            className="ix-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ix-modal-close"
              type="button"
              onClick={() => setSelectedIngredient(null)}
              aria-label="Close dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="ix-modal-grid">
              <div className="ix-modal-media">
                <img
                  src={`/assets/ingredients/cutout/${selectedIngredient.id}.webp`}
                  alt={selectedIngredient.name}
                  onError={(e) => {
                    e.currentTarget.src = `/assets/ingredients/${selectedIngredient.id}.webp`;
                  }}
                />
              </div>

              <div className="ix-modal-body">
                <span className="ix-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" />
                    <path d="M5 19 14 10" />
                  </svg>
                  {selectedIngredient.tradition || 'Botanical System'}
                </span>

                <h2 id="modal-ing-title">{selectedIngredient.name}</h2>
                <p className="ix-latin">{selectedIngredient.latin}</p>
                <p className="ix-modal-desc">{selectedIngredient.desc}</p>

                <dl className="ix-modal-specs">
                  {selectedIngredient.part && (
                    <div>
                      <dt>Plant Part</dt>
                      <dd>{selectedIngredient.part}</dd>
                    </div>
                  )}
                  {selectedIngredient.compound && (
                    <div>
                      <dt>Key Phytochemical</dt>
                      <dd>{selectedIngredient.compound}</dd>
                    </div>
                  )}
                  {selectedIngredient.target && (
                    <div>
                      <dt>Targeted Benefit</dt>
                      <dd>{selectedIngredient.target}</dd>
                    </div>
                  )}
                  {selectedIngredient.dose && (
                    <div>
                      <dt>Dosage / Strength</dt>
                      <dd>{selectedIngredient.dose}</dd>
                    </div>
                  )}
                </dl>

                {selectedIngredient.products && selectedIngredient.products.length > 0 && (
                  <>
                    <h3 className="ix-modal-products-title">Found In Formulations</h3>
                    <div className="ix-modal-products">
                      {selectedIngredient.products.map((p) => (
                        <Link
                          key={p.id}
                          to={`/products/${p.id}`}
                          onClick={() => setSelectedIngredient(null)}
                        >
                          {p.label || p.short}
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
