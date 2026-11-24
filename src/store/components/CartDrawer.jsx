import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Minus, Plus, Trash2, Truck, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { PRODUCTS } from '../data/products';
import { useCatalog } from '../lib/catalog';
import { SITE } from '../data/site';
import { inr } from '../utils/format';

export function QtyStepper({ value, onChange, small }) {
  useCatalog();
  return (
    <div className={`qty ${small ? 'qty--sm' : ''}`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Increase quantity" disabled={value >= 10}><Plus size={14} /></button>
    </div>
  );
}

export function FreeShipBar({ toFree, subtotal }) {
  useCatalog();
  const pct = Math.min(100, (subtotal / SITE.freeShippingAbove) * 100);
  return (
    <div className="shipbar">
      <p><Truck size={16} /> {toFree > 0 ? <>Add <strong>{inr(toFree)}</strong> more for <strong>free shipping</strong></> : <>You have unlocked <strong>free shipping</strong></>}</p>
      <div className="shipbar__track"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function CartDrawer() {
  useCatalog();
  const { open, setOpen, detailed, subtotal, savings, count, setQty, remove, toFree, add, lines } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, setOpen]);

  const inCart = new Set(lines.map((l) => l.id));
  const suggestions = PRODUCTS.filter((p) => !inCart.has(p.id)).slice(0, 2);

  return (
    <div className={`cart ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="cart__scrim" onClick={() => setOpen(false)} />
      <aside className="cart__panel" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="cart__head">
          <h2>Your cart <span>({count})</span></h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart"><X size={22} /></button>
        </div>

        {count === 0 ? (
          <div className="cart__empty">
            <ShoppingBag size={40} strokeWidth={1.3} />
            <p>Your cart is empty.</p>
            <button className="btn" onClick={() => { setOpen(false); navigate('/shop'); }}>Explore products</button>
          </div>
        ) : (
          <>
            <FreeShipBar toFree={toFree} subtotal={subtotal} />
            <ul className="cart__lines">
              {detailed.map((l) => (
                <li key={l.key} className="cart__line">
                  <Link to={`/products/${l.id}`} onClick={() => setOpen(false)} className="cart__thumb" style={{ background: l.product.tint }}>
                    <img src={l.product.images[0]} alt="" />
                  </Link>
                  <div className="cart__info">
                    <Link to={`/products/${l.id}`} onClick={() => setOpen(false)} className="cart__name">{l.product.name}</Link>
                    <small>{l.product.size}{l.pack > 1 ? ` · Pack of ${l.pack}` : ''}</small>
                    <div className="cart__row">
                      <QtyStepper small value={l.qty} onChange={(q) => setQty(l.key, q)} />
                      <span className="cart__price">{inr(l.total)}{l.mrpTotal > l.total && <s>{inr(l.mrpTotal)}</s>}</span>
                    </div>
                  </div>
                  <button className="icon-btn cart__remove" onClick={() => remove(l.key)} aria-label={`Remove ${l.product.short}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>

            {suggestions.length > 0 && (
              <div className="cart__upsell">
                <p className="eyebrow">Pairs well with</p>
                {suggestions.map((p) => (
                  <div key={p.id} className="cart__up">
                    <img src={p.images[0]} alt="" style={{ background: p.tint }} />
                    <span><strong>{p.short}</strong><small>{inr(p.price)}</small></span>
                    <button className="btn btn--sm btn--ghost" onClick={() => add(p.id, 1, 1, { openDrawer: false })}>Add</button>
                  </div>
                ))}
              </div>
            )}

            <div className="cart__foot">
              {savings > 0 && <p className="cart__save">You save {inr(savings)} on this order</p>}
              <div className="cart__total"><span>Subtotal</span><strong>{inr(subtotal)}</strong></div>
              <small>Taxes included. Shipping calculated at checkout.</small>
              <button className="btn btn--block btn--lg" onClick={() => { setOpen(false); navigate('/checkout'); }}>Checkout securely</button>
              <button className="link-btn" onClick={() => { setOpen(false); navigate('/cart'); }}>View full cart</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
