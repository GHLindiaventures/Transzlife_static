// Website content managed in the dashboard (GET /api/site-content): announcement bar and homepage
// sections. Pages render the built-in content first and switch to the managed version when it arrives;
// if the API can't be reached, the built-in content simply stays.
import { useSyncExternalStore } from 'react';

let content = null;
let loading = null;
const subs = new Set();

export function loadSiteContent() {
  loading ??= fetch('/api/site-content', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { content = d; subs.forEach((fn) => fn()); } })
    .catch(() => {});
  return loading;
}

const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
/** null until the managed content has loaded. */
export const useSiteContent = () => useSyncExternalStore(subscribe, () => content, () => content);
