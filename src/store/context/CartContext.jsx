import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { getProduct, PACKS } from '../data/products';
import { SITE } from '../data/site';
import { useCatalog } from '../lib/catalog';

const CartContext = createContext(null);
const KEY = 'tranzlife.cart.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // keep every line: products added in the dashboard arrive with the live catalogue a moment later
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.id === 'string') : [];
  } catch {
    return [];
  }
}

export const packPrice = (product, packQty) => {
  const pack = PACKS.find((p) => p.qty === packQty) || PACKS[0];
  return Math.round(product.price * pack.qty * (1 - pack.off));
};
export const packMrp = (product, packQty) => product.mrp * packQty;

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  const add = useCallback((id, qty = 1, pack = 1, { openDrawer = true } = {}) => {
    setLines((prev) => {
      const key = `${id}:${pack}`;
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(l.qty + qty, 10) } : l));
      return [...prev, { key, id, pack, qty }];
    });
    const p = getProduct(id);
    setToast(`${p?.short} added to your cart`);
    if (openDrawer) setOpen(true);
  }, []);

  const setQty = useCallback((key, qty) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, 10) } : l))));
  }, []);

  const remove = useCallback((key) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const catalog = useCatalog();
  const totals = useMemo(() => {
    const detailed = lines.filter((l) => getProduct(l.id)).map((l) => {
      const product = getProduct(l.id);
      const unit = packPrice(product, l.pack);
      const unitMrp = packMrp(product, l.pack);
      return { ...l, product, unit, unitMrp, total: unit * l.qty, mrpTotal: unitMrp * l.qty };
    });
    const subtotal = detailed.reduce((s, l) => s + l.total, 0);
    const mrpTotal = detailed.reduce((s, l) => s + l.mrpTotal, 0);
    const count = detailed.reduce((s, l) => s + l.qty, 0);
    const shipping = subtotal === 0 || subtotal >= SITE.freeShippingAbove ? 0 : SITE.shippingFee;
    return { detailed, subtotal, mrpTotal, savings: mrpTotal - subtotal, count, shipping, toFree: Math.max(0, SITE.freeShippingAbove - subtotal) };
  }, [lines, catalog]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const value = { lines, add, setQty, remove, clear, open, setOpen, toast, ...totals };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
