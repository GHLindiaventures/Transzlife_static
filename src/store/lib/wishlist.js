// Wishlist ("favourites"): kept in this browser, and in the account once signed in, so it follows
// the customer across devices and shows up in the dashboard. Signing in merges the two.
import { api } from './api';
import { getFavourites, toggleFavourite } from '../data/reviewStore';
import { track } from './track';

const KEY = 'tranzlife.favourites.v1';
const write = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked */ } };

/** Toggle a product; returns true when it is now saved. */
export async function toggleWishlist(productId, signedIn) {
  const on = toggleFavourite(productId);
  track(on ? 'wishlist_add' : 'wishlist_remove', { pid: productId });
  if (signedIn) {
    try { write((await api('/api/wishlist', { method: 'POST', body: { productId, on } })).ids); } catch { /* kept locally */ }
  }
  return on;
}

/** After sign-in: send favourites saved on this browser, then use the account's list here. */
export async function mergeWishlist() {
  try { const r = await api('/api/wishlist/merge', { method: 'POST', body: { ids: getFavourites() } }); write(r.ids); return r.ids; }
  catch { return getFavourites(); }
}

export { getFavourites };
