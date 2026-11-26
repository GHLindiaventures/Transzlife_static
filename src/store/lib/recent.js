// Recently viewed products, kept in this browser only (shown on the account page).
const KEY = 'tl_recent';
const MAX = 12;

export function recentlyViewed() {
  try { const ids = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(ids) ? ids : []; } catch { return []; }
}

export function rememberViewed(id) {
  if (!id) return;
  const ids = [id, ...recentlyViewed().filter((x) => x !== id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
}

export function clearViewed() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
