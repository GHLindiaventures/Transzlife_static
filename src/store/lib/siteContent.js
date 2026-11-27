// Website content managed in the dashboard (GET /api/site-content): announcement bar and homepage
// sections. Pages render the built-in content first and switch to the managed version when it arrives;
// if the API can't be reached, the built-in content simply stays.
import { useSyncExternalStore } from 'react';
import { subscribePublicEvents } from './realtime';

let content = null;
let loading = null;
let subscribed = false;
const subs = new Set();

export function refreshSiteContent() {
  loading = fetch('/api/site-content', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { content = d; subs.forEach((fn) => fn()); } })
    .catch(() => {});
  return loading;
}

export function loadSiteContent() {
  if (!subscribed && typeof window !== 'undefined') {
    subscribed = true;
    subscribePublicEvents({
      onEvent: (ev) => {
        if (ev?.type === 'site_content' || ev?.type === 'settings') refreshSiteContent();
      },
    });
  }
  return loading ?? refreshSiteContent();
}

const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
/** null until the managed content has loaded. */
export const useSiteContent = () => useSyncExternalStore(subscribe, () => content, () => content);
