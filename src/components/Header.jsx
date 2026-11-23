import { useEffect, useState, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Media, Slot, ProductImg } from './ui.jsx';
import { PRODUCTS, productUrl } from '../content/site.js';
import { useCart } from '../store/context/CartContext';

export const SHOP_URL = '/shop';

export const NAV = [
  { label: 'Shop', mega: 'shop', to: SHOP_URL },
  { label: 'About', to: '/about' },
  { label: 'Science', to: '/science' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

const Chevron = () => (
  <svg className="chev" width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M1 1l3 3 3-3" /></svg>
);

function ShopMega({ onPick }) {
  return (
    <div className="mega__inner mega__inner--shop">
      <Link className="mega__card mega__card--all" to={SHOP_URL} onClick={onPick}>
        <div className="mega__circle">
          <Media className="media--circle" photo="explore-circle" />
          <span className="mega__circle-dot"><Slot className="slot--explore">Explore</Slot></span>
        </div>
        <p className="mega__caption">View All Products</p>
      </Link>
      {PRODUCTS.map((p) => (
        <Link className="mega__card" to={productUrl(p.id)} key={p.id} onClick={onPick}>
          <Media className="media--mega media--product"><ProductImg n={p.photo} alt="" /></Media>
          <p className="mega__caption">{p.short}<small className="mega__tag">{p.tag}</small></p>
        </Link>
      ))}
    </div>
  );
}

export default function Header({ onBurger }) {
  const [stuck, setStuck] = useState(false);
  const [openMega, setOpenMega] = useState(null); // tap-opened menu on touch screens
  const [hoverMega, setHoverMega] = useState(null); // hover-opened menu on desktop

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape / outside click close a tap-opened mega menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpenMega(null);
      setHoverMega(null);
      // also release keyboard focus from an open (focus-within) menu
      const active = document.activeElement;
      if (active && active.closest('.mega')) active.closest('.nav__item')?.querySelector('.nav__link')?.focus();
    };
    const onDoc = (e) => { 
      if (!e.target.closest('.nav__item')) {
        setOpenMega(null);
        setHoverMega(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); };
  }, []);

  // Close mega menu on navigation
  useEffect(() => {
    setHoverMega(null);
    setOpenMega(null);
  }, [window.location.pathname]);

  // touch screens: the first tap opens the menu, a second tap follows the link
  const onMegaClick = (e, key) => {
    if (window.matchMedia('(hover:none)').matches && openMega !== key) {
      e.preventDefault();
      setOpenMega(key);
    } else {
      setOpenMega(null);
    }
  };

  // Desktop hover handlers
  const hoverTimeoutRef = useRef(null);

  const onNavMouseEnter = (e, key) => {
    if (window.matchMedia('(hover:hover)').matches) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHoverMega(key);
    }
  };

  const onNavMouseLeave = (e) => {
    if (window.matchMedia('(hover:hover)').matches) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverMega(null);
      }, 150); // Small delay to allow smooth mouse movement
    }
  };

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}`} id="header">
      <div className="header__inner">
        <div className="header__left">
          <button className="icon-btn header__burger" id="burger" aria-label="Open menu" type="button" onClick={onBurger}>
            <svg className="burger__lines" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" /></svg>
            <img className="burger__logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" width="36" height="36" />
          </button>
          <Link className="header__logo" to="/" aria-label="TranzLife Biosciences, home">
            <img className="logo__img" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="TranzLife Biosciences, home" width="36" height="36" />
            {/* mobile wordmark: same as the footer logo (leaf over the "z") */}
            <span className="logo__text" aria-hidden="true">
              <span className="logo__word">Tran<span className="logo__z">z<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36C14 12 34 4 60 4 52 26 30 38 4 36z" /><path d="M4 36 38 16" /></svg></span>Life</span>
              <sup>®</sup>
            </span>
          </Link>
        </div>

        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {NAV.map((item) =>
              item.mega ? (
                <li 
                  className={`nav__item has-mega${openMega === item.mega || hoverMega === item.mega ? ' is-open' : ''}`} 
                  key={item.label}
                  onMouseEnter={(e) => onNavMouseEnter(e, item.mega)}
                  onMouseLeave={onNavMouseLeave}
                >
                  <Link className="nav__link" to={item.to} aria-haspopup="true" aria-expanded={openMega === item.mega || hoverMega === item.mega} onClick={(e) => onMegaClick(e, item.mega)}>
                    <span className="nav__label">{item.label}</span><Chevron />
                  </Link>
                  <div className="mega" onMouseEnter={(e) => { if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; } }} onMouseLeave={onNavMouseLeave}><ShopMega onPick={() => { setOpenMega(null); setHoverMega(null); document.activeElement?.blur(); }} /></div>
                </li>
              ) : (
                <li className="nav__item" key={item.label}>
                  <NavLink className="nav__link" to={item.to}>
                    <span className="nav__label">{item.label}</span>
                  </NavLink>
                </li>
              )
            )}
          </ul>
        </nav>

        <div className="header__right">
          <Link className="header__cta header__cta--icon" to={SHOP_URL} aria-label="Shop">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

/** Opens the store's cart drawer; shows the item count. */
function CartButton() {
  const { count, setOpen } = useCart();
  return (
    <button type="button" className="icon-btn header__cart" onClick={() => setOpen(true)} aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
      {count > 0 && <span className="header__cart-count">{count}</span>}
    </button>
  );
}
