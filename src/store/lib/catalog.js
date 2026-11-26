// Live catalogue: loads the database version of the products once, and lets components re-render
// when it arrives. Falls back silently to the built-in list if the API is unreachable.
import { useSyncExternalStore } from 'react';
import { subscribeCatalog, catalogVersion, replaceCatalog, markCatalogSettled, PACKS } from '../data/products';
import { SITE } from '../data/site';
import { replaceIngredients } from '../data/ingredients';

let loading = null;
export function loadCatalog() {
  const get = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // products and the ingredient library arrive together, then pages re-render once
  loading ??= Promise.all([get('/api/products'), get('/api/ingredients')]).then(([p, i]) => {
    if (i?.ingredients?.length) replaceIngredients(i.ingredients);
    // pack discounts and shipping / prepaid rules as set in the dashboard
    if (Array.isArray(p?.packs) && p.packs.length) PACKS.splice(0, PACKS.length, ...p.packs);
    if (p?.shop) Object.assign(SITE, p.shop);
    if (Array.isArray(p?.products)) replaceCatalog(p.products); else markCatalogSettled();
  });
  return loading;
}

/** Call in any component that shows products; returns a number that changes when the catalogue updates. */
export const useCatalog = () => useSyncExternalStore(subscribeCatalog, catalogVersion, catalogVersion);
