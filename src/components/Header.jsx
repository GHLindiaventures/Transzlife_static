import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Media, Slot, ProductImg } from './ui.jsx';
import { PRODUCTS } from '../content/site.js';

export const SHOP_URL = '/#products';

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
        <Link className="mega__card" to={`/product/${p.id}`} key={p.id} onClick={onPick}>
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

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 200);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape / outside click close a tap-opened mega menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpenMega(null);
      // also release keyboard focus from an open (focus-within) menu
      const active = document.activeElement;
      if (active && active.closest('.mega')) active.closest('.nav__item')?.querySelector('.nav__link')?.focus();
    };
    const onDoc = (e) => { if (!e.target.closest('.nav__item')) setOpenMega(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); };
  }, []);

  // touch screens: the first tap opens the menu, a second tap follows the link
  const onMegaClick = (e, key) => {
    if (window.matchMedia('(hover:none)').matches && openMega !== key) {
      e.preventDefault();
      setOpenMega(key);
    } else {
      setOpenMega(null);
    }
  };

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}`} id="header">
      <div className="header__inner">
        <div className="header__left">
          <button className="icon-btn header__burger" id="burger" aria-label="Open menu" type="button" onClick={onBurger}>
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" /></svg>
          </button>
          <Link className="header__logo" to="/">
            <img className="logo__img" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="TranzLife Biosciences, home" width="56" height="56" />
          </Link>
        </div>

        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {NAV.map((item) =>
              item.mega ? (
                <li className={`nav__item has-mega${openMega === item.mega ? ' is-open' : ''}`} key={item.label}>
                  <Link className="nav__link" to={item.to} aria-haspopup="true" aria-expanded={openMega === item.mega} onClick={(e) => onMegaClick(e, item.mega)}>
                    <span className="nav__label">{item.label}</span><Chevron />
                  </Link>
                  <div className="mega"><ShopMega onPick={() => { setOpenMega(null); document.activeElement?.blur(); }} /></div>
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
          <Link className="header__cta" to={SHOP_URL}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h14l-1 13H4L3 6z" /><path d="M7 8V5a3 3 0 016 0v3" /></svg>
            <span>Shop</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
