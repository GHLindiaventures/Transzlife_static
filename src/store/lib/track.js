// First-party analytics for the shop (server side: server/shop/track.js). No third-party scripts.
//
// Consent ('tl.consent' in this browser):
//   'all'        a random visitor id + visit id are kept, so we can count unique and returning
//                visitors and follow product → cart → checkout. Cart is mirrored for recovery.
//   'essential'  (or Global Privacy Control on) anonymous page views only, no ids, nothing else.
//   not chosen   events wait (up to the page closing) for the visitor's choice, then go out
//                with or without ids. If they leave without choosing, page views go out anonymously.
// Nothing is sent in local development (unless VITE_TRACK_DEV=1), on /admin, by automated
// browsers, or from a browser where a staff member has signed in to the dashboard.

const CONSENT = 'tl.consent';
const VID = 'tl.vid';
const VISIT = 'tl.visit';
const STAFF = 'tl.staff';
const VISIT_IDLE_MS = 30 * 60 * 1000;
const UTM = ['source', 'medium', 'campaign'];

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

export const enabled = () => typeof window !== 'undefined'
  && (!import.meta.env.DEV || import.meta.env.VITE_TRACK_DEV === '1')
  && !navigator.webdriver
  && ls.get(STAFF) !== '1'
  && !location.pathname.startsWith('/admin');

/** 'all' | 'essential' | null (not chosen yet). Global Privacy Control counts as 'essential'. */
export function getConsent() {
  const c = ls.get(CONSENT);
  if (c === 'all' || c === 'essential') return c;
  return navigator.globalPrivacyControl ? 'essential' : null;
}

const listeners = new Set();
export const onConsentChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Opens the privacy banner again (footer "Privacy choices"). */
export const openConsent = () => listeners.forEach((fn) => fn({ reopen: true }));

export function setConsent(value) {
  ls.set(CONSENT, value);
  if (value !== 'all') { ls.del(VID); ls.del(VISIT); }
  listeners.forEach((fn) => fn({ value }));
  flush();
}

/** Marks this browser as a staff browser (called by the admin dashboard): stops tracking here. */
export const markStaffBrowser = () => ls.set(STAFF, '1');

// ---- ids --------------------------------------------------------------------
let pendingCtx = null;          // where this visit came from; sent with the visit's first batch

function ids() {
  if (getConsent() !== 'all') return null;
  let v = ls.get(VID);
  if (!v) { v = uuid(); ls.set(VID, v); }
  let visit = null;
  try { visit = JSON.parse(ls.get(VISIT) || 'null'); } catch { visit = null; }
  const now = Date.now();
  if (!visit?.id || now - visit.last > VISIT_IDLE_MS) {
    visit = { id: uuid(), last: now };
    pendingCtx = visitContext();
  }
  visit.last = now;
  ls.set(VISIT, JSON.stringify(visit));
  return { v, s: visit.id };
}

function visitContext() {
  const q = new URLSearchParams(location.search);
  const utm = Object.fromEntries(UTM.map((k) => [k, q.get(`utm_${k}`)?.slice(0, 60)]).filter(([, x]) => x));
  return {
    landing: location.pathname.slice(0, 300),
    ref: document.referrer ? document.referrer.slice(0, 300) : undefined,
    share: q.get('ref') === 'share' || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
  };
}

/** The analytics visitor id, only when the visitor accepted analytics (used for votes and presence). */
export const visitorId = () => (getConsent() === 'all' ? ls.get(VID) || undefined : undefined);

/** For checkout: links the order to this visit (where the customer came from). */
export const trackIds = () => (enabled() ? ids() || undefined : undefined);

// ---- queue -------------------------------------------------------------------
let queue = [];
let timer = null;

export function track(name, { pid, ...props } = {}) {
  if (!enabled()) return;
  const consent = getConsent();
  if (consent === 'essential' && name !== 'page_view') return;
  queue.push({ id: uuid(), n: name, p: location.pathname.slice(0, 300), pid: pid || undefined, props: Object.keys(props).length ? props : undefined });
  if (queue.length > 60) queue = queue.slice(-60);
  schedule();
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 1500);
}

function flush({ leaving = false } = {}) {
  if (!queue.length || !enabled()) return;
  const consent = getConsent();
  if (consent === null && !leaving) return;              // wait for the visitor's choice
  let events = queue; queue = [];
  const id = consent === 'all' ? ids() : null;
  if (!id) events = events.filter((e) => e.n === 'page_view').map(({ id: eid, n, p }) => ({ id: eid, n, p }));
  if (!events.length) return;
  for (let i = 0; i < events.length; i += 40) {
    const body = { events: events.slice(i, i + 40) };
    if (id) { body.v = id.v; body.s = id.s; if (pendingCtx) body.ctx = pendingCtx; }
    send('/api/t', 'POST', body).then((ok) => { if (ok && id) pendingCtx = null; });
  }
}

function send(url, method, body) {
  try {
    return fetch(url, { method, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.ok).catch(() => false);
  } catch { return Promise.resolve(false); }
}

// ---- cart mirror -------------------------------------------------------------
let cartTimer = null;
let lastCart = null;
export function syncCart(lines) {
  if (!enabled() || getConsent() !== 'all') return;
  const items = lines.map(({ id, pack, qty }) => ({ id, pack, qty }));
  const key = JSON.stringify(items);
  if (key === lastCart) return;
  clearTimeout(cartTimer);
  cartTimer = setTimeout(() => {
    const id = ids();
    if (!id) return;
    lastCart = key;
    send('/api/t/cart', 'PUT', { v: id.v, items });
  }, 1200);
}

// ---- automatic events ----------------------------------------------------------
let installed = false;
/** Clicks on product links, brochures and WhatsApp; Tulsi chat opening; flush when leaving. */
export function installTracking() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch { return; }
    const prod = url.origin === location.origin && url.pathname.match(/^\/products\/([a-z0-9-]+)\/?$/)?.[1];
    if (prod && url.pathname !== location.pathname) {
      const list = a.closest('[data-track-list]')?.dataset.trackList || location.pathname;
      track('product_click', { pid: prod, list: list.slice(0, 60) });
    } else if (/\.pdf$/i.test(url.pathname)) {
      track('brochure_download', { file: url.pathname.split('/').pop().slice(0, 80) });
    } else if (/wa\.me|whatsapp\.com/i.test(url.host)) {
      track('whatsapp_click');
    }
  }, { capture: true });

  // the Tulsi chat widget marks the page with body.chat-open
  let chatOpen = document.body.classList.contains('chat-open');
  new MutationObserver(() => {
    const now = document.body.classList.contains('chat-open');
    if (now && !chatOpen) track('chat_open');
    chatOpen = now;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const leave = () => flush({ leaving: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
  window.addEventListener('pagehide', leave);
}

/** A share link that tells us the visit came from someone sharing (?ref=share). */
export function shareUrl(path = location.pathname) {
  const u = new URL(path, location.origin);
  u.searchParams.set('ref', 'share');
  return u.toString();
}
