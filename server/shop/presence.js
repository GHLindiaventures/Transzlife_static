// Live "people browsing right now" counts. Held in this server's memory only: nothing is written
// to the database and an entry disappears 90 seconds after its last heartbeat.
//
//   POST /api/presence        { v?, path }  heartbeat every 30 s while a tab is visible
//   POST /api/presence/leave  { v? }        tab closed / hidden
//   GET  /api/admin/presence  (staff)       raw counts, pages and products being viewed
//
// One browser = one entry, however many tabs: the key is the analytics visitor id when the
// visitor accepted analytics, otherwise a one-way hash of network + browser with a salt that
// changes every day (never stored, can't be turned back into an IP address). Bots, staff browsers
// and checkout pages are left out. Numbers shown on the site are the real count; small numbers
// are not shown at all (SITE_MIN / PRODUCT_MIN), and nothing is ever rounded up or invented.
// NOTE: with more than one server instance this map would move to a shared store (e.g. Redis).
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isBot } from './track.js';

export const ACTIVE_MS = 90_000;
export const SITE_MIN = 3;          // "N people are browsing" only from 3 people
export const PRODUCT_MIN = 2;       // "N others are viewing this" only from 2 other people

export function createPresence({ now = () => Date.now() } = {}) {
  const live = new Map();           // key -> { at, path, product }
  let salt = randomBytes(16).toString('hex'), saltDay = new Date().toDateString();

  function keyOf({ v, ip, ua }) {
    if (v) return `v:${v}`;
    const today = new Date().toDateString();
    if (today !== saltDay) { salt = randomBytes(16).toString('hex'); saltDay = today; }
    return `h:${createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0, 20)}`;
  }
  function sweep() {
    const cutoff = now() - ACTIVE_MS;
    for (const [k, e] of live) if (e.at < cutoff) live.delete(k);
  }
  function beat(who, path) {
    const clean = String(path || '/').split('?')[0].slice(0, 200);
    const product = clean.match(/^\/products\/([a-z0-9-]{1,80})\/?$/)?.[1] || null;
    const key = keyOf(who);
    live.set(key, { at: now(), path: clean, product });
    sweep();
    return { key, product };
  }
  function leave(who) { live.delete(keyOf(who)); }
  function counts(key, product) {
    sweep();
    const site = live.size;
    let others = 0;
    if (product) for (const [k, e] of live) if (k !== key && e.product === product) others++;
    return { site, others };
  }
  function snapshot() {
    sweep();
    const pages = new Map(), products = new Map();
    for (const e of live.values()) {
      pages.set(e.path, (pages.get(e.path) || 0) + 1);
      if (e.product) products.set(e.product, (products.get(e.product) || 0) + 1);
    }
    const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ key: k, n }));
    return { total: live.size, pages: top(pages), products: top(products) };
  }
  return { beat, leave, counts, snapshot, _live: live };
}

export default async function presenceRoutes(app, { presence }) {
  const body = z.object({ v: z.string().uuid().optional(), path: z.string().max(300).optional() });
  const quiet = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };
  const who = (req, b) => ({ v: b.v, ip: req.ip, ua: String(req.headers['user-agent'] || '') });

  app.post('/api/presence', quiet, async (req, reply) => {
    if (isBot(String(req.headers['user-agent'] || ''))) return reply.code(204).send();
    const b = body.safeParse(req.body ?? {});
    if (!b.success) return reply.code(400).send({ error: 'Invalid request.' });
    const { key, product } = presence.beat(who(req, b.data), b.data.path);
    const { site, others } = presence.counts(key, product);
    return { site: site >= SITE_MIN ? site : null, product: others >= PRODUCT_MIN ? others : null };
  });

  app.post('/api/presence/leave', quiet, async (req, reply) => {
    const b = body.safeParse(req.body ?? {});
    if (b.success) presence.leave(who(req, b.data));
    return reply.code(204).send();
  });
}
