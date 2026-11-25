// Live catalogue: loads the database version of the products once, and lets components re-render
// when it arrives. Falls back silently to the built-in list if the API is unreachable.
import { useSyncExternalStore } from 'react';
import { subscribeCatalog, catalogVersion, replaceCatalog, markCatalogSettled } from '../data/products';
import { replaceIngredients } from '../data/ingredients';

let loading = null;
export function loadCatalog() {
  const get = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // products and the ingredient library arrive together, then pages re-render once
  loading ??= Promise.all([get('/api/products'), get('/api/ingredients')]).then(([p, i]) => {
    if (i?.ingredients?.length) replaceIngredients(i.ingredients);
    if (p?.products?.length) replaceCatalog(p.products); else markCatalogSettled();
  });
  return loading;
}

/** Call in any component that shows products; returns a number that changes when the catalogue updates. */
export const useCatalog = () => useSyncExternalStore(subscribeCatalog, catalogVersion, catalogVersion);
