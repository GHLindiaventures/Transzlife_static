import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Media, Slot, PRODUCTS, ProductImg, range, stop } from './ui.jsx';

export const NAV = [
  { label: 'Shop', mega: 'shop' },
  { label: 'All Collections', mega: 'all' },
  { label: 'About', to: '/about' },
  { label: 'Science', to: '/science' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
];

const Chevron = () => (
  <svg className="chev" width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1l3 3 3-3" /></svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8.5" cy="8.5" r="6.5" /><path d="M13.5 13.5L19 19" /></svg>
);

function ShopMega() {
  return (
    <div className="mega__inner mega__inner--shop">
      <a className="mega__card mega__card--all" href="#" onClick={stop}>
        <div className="mega__circle">
          <Media className="media--circle" />
          <span className="mega__circle-dot"><Slot className="slot--explore" /></span>
        </div>
        <p className="mega__caption">View All Products</p>
      </a>
      {PRODUCTS.slice(0, 5).map((name, i) => (
        <a className="mega__card" href="#" onClick={stop} key={name}>
          <Media className="media--mega media--product"><ProductImg n={i + 1} eager /></Media>
          <p className="mega__caption">{name}</p>
        </a>
      ))}
    </div>
  );
}

function AllMega() {
  return (
    <div className="mega__inner">
      {range(6).map((i) => (
        <a className="mega__card" href="#" onClick={stop} key={i}>
          <Media className="media--mega" />
          <Slot as="p" className="slot--caption" />
        </a>
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
    const onKey = (e) => { if (e.key === 'Escape') setOpenMega(null); };
    const onDoc = (e) => { if (!e.target.closest('.nav__item')) setOpenMega(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); };
  }, []);

  const onMegaClick = (e, key) => {
    e.preventDefault(); // placeholder link
    if (window.matchMedia('(hover:none)').matches) setOpenMega((cur) => (cur === key ? cur : key));
  };

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}`} id="header">
      <div className="header__inner">
        <div className="header__left">
          <button className="icon-btn header__burger" id="burger" aria-label="Menu" type="button" onClick={onBurger}>
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 1h20M0 7h20M0 13h20" /></svg>
          </button>
          <button className="icon-btn header__search-m" aria-label="Search" type="button"><SearchIcon /></button>
          <Link className="header__logo" to="/" aria-label="Logo"><Slot className="slot--logo" /></Link>
        </div>

        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {NAV.map((item) =>
              item.mega ? (
                <li className={`nav__item has-mega${openMega === item.mega ? ' is-open' : ''}`} key={item.label}>
                  <a className="nav__link" href="#" onClick={(e) => onMegaClick(e, item.mega)}>
                    <span className="nav__label">{item.label}</span><Chevron />
                  </a>
                  <div className="mega">
                    {item.mega === 'shop' ? <ShopMega /> : <AllMega />}
                  </div>
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
          <button className="icon-btn header__search" aria-label="Search" type="button"><SearchIcon /></button>
          <a className="icon-btn" href="#" onClick={stop} aria-label="Account">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="6" r="4" /><path d="M2 19c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
          </a>
          <a className="icon-btn" href="#" onClick={stop} aria-label="Cart">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h14l-1 13H4L3 6z" /><path d="M7 8V5a3 3 0 016 0v3" /></svg>
          </a>
        </div>
      </div>
    </header>
  );
}
