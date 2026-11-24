// Live catalogue: loads the database version of the products once, and lets components re-render
// when it arrives. Falls back silently to the built-in list if the API is unreachable.
import { useSyncExternalStore } from 'react';
import { subscribeCatalog, catalogVersion, replaceCatalog, markCatalogSettled } from '../data/products';

let loading = null;
export function loadCatalog() {
  loading ??= fetch('/api/products', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d?.products?.length) replaceCatalog(d.products); else markCatalogSettled(); })
    .catch(() => markCatalogSettled());
  return loading;
}

/** Call in any component that shows products; returns a number that changes when the catalogue updates. */
export const useCatalog = () => useSyncExternalStore(subscribeCatalog, catalogVersion, catalogVersion);
