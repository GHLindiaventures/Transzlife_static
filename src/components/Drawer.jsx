import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ProductImg } from './ui.jsx';
import { PRODUCTS, productUrl, ANNOUNCEMENTS, fillShopTokens } from '../content/site.js';
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
        <div className="drawer__trust">
          <div className="drawer__trust-title">Our Promise</div>
          <ul className="drawer__trust-list">
            {ANNOUNCEMENTS.map((item, idx) => (
              <li key={idx} className="drawer__trust-item">
                <span className="drawer__trust-icon" aria-hidden="true">
                  {idx === 0 ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" rx="1" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  ) : idx === 1 ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                    </svg>
                  )}
                </span>
                <span className="drawer__trust-text">{fillShopTokens(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
