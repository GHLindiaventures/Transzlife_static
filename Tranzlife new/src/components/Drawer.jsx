import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Slot, stop } from './ui.jsx';
import { NAV_PRODUCTS } from '../content/site.js';
import { NAV } from './Header.jsx';

export default function Drawer({ open, onClose }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (label) => setExpanded((s) => ({ ...s, [label]: !s[label] }));

  return (
    <>
      <div className={`drawer-overlay${open ? ' is-open' : ''}`} id="drawerOverlay" onClick={onClose} />
      <aside className={`drawer${open ? ' is-open' : ''}`} id="drawer" aria-hidden={!open}>
        <div className="drawer__head">
          <button className="icon-btn" id="drawerClose" aria-label="Close" type="button" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1l8 8M9 1L1 9" /></svg>
          </button>
        </div>
        <ul className="drawer__list">
          {NAV.map((item) => (
            <li key={item.label} className={expanded[item.label] ? 'is-open' : undefined}>
              {item.mega ? (
                <>
                  <button className="drawer__row" type="button" onClick={() => toggle(item.label)}>
                    <span className="nav__label">{item.label}</span>
                    <svg width="10" height="6" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1l3 3 3-3" /></svg>
                  </button>
                  <div className="drawer__sub">
                    {NAV_PRODUCTS.map((p) => (
                      <Link to={`/product/${p.id}`} onClick={onClose} key={p.id}><Slot className="slot--drawer">{p.name}</Slot></Link>
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
