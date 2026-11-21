import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ProductImg } from './ui.jsx';
import { PRODUCTS, productUrl } from '../content/site.js';
import { NAV } from './Header.jsx';

export default function Drawer({ open, onClose }) {
  const [expanded, setExpanded] = useState({});
  const closeRef = useRef(null);
  const toggle = (label) => setExpanded((s) => ({ ...s, [label]: !s[label] }));

  // move focus into the menu when it opens, and back to the burger when it closes
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) document.getElementById('burger')?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <div className={`drawer-overlay${open ? ' is-open' : ''}`} id="drawerOverlay" onClick={onClose} />
      <aside
        className={`drawer${open ? ' is-open' : ''}`}
        id="drawer"
        aria-label="Menu"
        aria-hidden={!open}
        inert={open ? undefined : ''}
      >
        <div className="drawer__head">
          <button className="icon-btn" id="drawerClose" aria-label="Close menu" type="button" onClick={onClose} ref={closeRef}>
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" /></svg>
          </button>
        </div>
        <ul className="drawer__list">
          {NAV.map((item) => (
            <li key={item.label} className={expanded[item.label] ? 'is-open' : undefined}>
              {item.mega ? (
                <>
                  <button className="drawer__row" type="button" aria-expanded={!!expanded[item.label]} onClick={() => toggle(item.label)}>
                    <span className="nav__label">{item.label}</span>
                    <span className="drawer__pm" aria-hidden="true" />
                  </button>
                  <div className="drawer__sub drawer__shop">
                    {PRODUCTS.map((p) => (
                      <Link className="drawer__prod" to={productUrl(p.id)} onClick={onClose} key={p.id}>
                        <span className="drawer__prod-img"><ProductImg n={p.photo} alt="" /></span>
                        <span className="drawer__prod-name">{p.short}</span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <NavLink className="drawer__row" to={item.to} onClick={onClose}>
                  <span className="nav__label">{item.label}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
