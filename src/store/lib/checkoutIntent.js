// "Buy now" (like Amazon): buy just this item, without touching the cart.
// The item is kept in sessionStorage so it survives the trip through sign-in and back.
const KEY = 'tranzlife.buyNow.v1';

export const BUY_NOW_URL = '/checkout?buy=now';

export function setBuyNow({ id, pack = 1, qty = 1 }) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ id, pack, qty, at: Date.now() })); } catch { /* storage blocked */ }
}

/** The saved buy-now item, or null (expires after 2 hours). */
export function getBuyNow() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!v || !v.id || Date.now() - v.at > 2 * 3600_000) return null;
    return { id: v.id, pack: Number(v.pack) || 1, qty: Number(v.qty) || 1 };
  } catch {
    return null;
  }
}

export function clearBuyNow() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
