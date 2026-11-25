// Live "people browsing right now" (server: server/shop/presence.js). A heartbeat every 30 s while
// the tab is visible; the reply carries the current counts, already filtered by the server (small
// numbers come back as null and are not shown). Nothing here is invented or rounded.
import { useEffect, useSyncExternalStore } from 'react';
import { enabled, visitorId } from './track';

const BEAT_MS = 30_000;
let state = { site: null, product: null };
const subs = new Set();
const set = (next) => { state = next; subs.forEach((fn) => fn()); };
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

let timer = null, started = false;

function send(url, body) {
  return fetch(url, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function beat() {
  if (document.visibilityState !== 'visible' || !enabled()) return;
  try {
    const r = await send('/api/presence', { v: visitorId(), path: location.pathname });
    if (r.ok) { const d = await r.json(); set({ site: d.site ?? null, product: d.product ?? null }); }
  } catch { /* offline: keep the last numbers */ }
}

/** Starts the heartbeat once per page load (called by the site layout). */
export function startPresence() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const loop = () => { clearTimeout(timer); timer = setTimeout(async () => { await beat(); loop(); }, BEAT_MS); };
  beat(); loop();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { beat(); loop(); }
    else { clearTimeout(timer); if (enabled()) send('/api/presence/leave', { v: visitorId() }).catch(() => {}); }
  });
  window.addEventListener('pagehide', () => { if (enabled()) send('/api/presence/leave', { v: visitorId() }).catch(() => {}); });
}

/** New page: report it at once so product counts are right. */
export const presencePage = () => { if (started) beat(); };

export function usePresence() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** For the product page: re-beat when the product changes. */
export function useProductViewers(productId) {
  useEffect(() => { if (productId) { set({ ...state, product: null }); presencePage(); } }, [productId]);
  return usePresence().product;
}
