// Works out the visitor's real IP address once per request, before anything else sees it.
//
// Behind a proxy (Render), the address on the socket is the proxy's, and the visitor's address is
// in the X-Forwarded-For header. A visitor can put anything they like in that header, though: the
// proxy only appends to it. So the only entries we can believe are the ones our own proxies added,
// counted from the right. Trusting the whole header (the old `trustProxy: true`) let anyone send
// "X-Forwarded-For: 1.2.3.4" with a new made-up address each time and skip every per-IP rate limit.
//
// Settings (environment):
//   TRUST_PROXY_HOPS   how many proxies we run behind (default 1: Render). 0 = none, use the socket.
//                      With Cloudflare in front of Render it would be 2.
//   CLIENT_IP_HEADER   optional: a header the edge proxy sets and overwrites itself, e.g.
//                      cf-connecting-ip (only when every request really comes through Cloudflare).
//
// The result is stored on req.clientIp, and X-Forwarded-For is rewritten to just that address, so
// Fastify (trustProxy: 1) and the chat API both see the same, trustworthy value.

const clean = (ip) => String(ip || '').trim().replace(/^::ffff:(?=\d+\.)/, '');

export function createClientIp(env = process.env) {
  const n = Number.parseInt(env.TRUST_PROXY_HOPS ?? '1', 10);
  const hops = Number.isFinite(n) && n >= 0 ? n : 1;
  const header = String(env.CLIENT_IP_HEADER || '').trim().toLowerCase();

  function resolve(req) {
    const socketIp = clean(req.socket?.remoteAddress);
    if (header) {
      const v = clean(String(req.headers[header] || '').split(',')[0]);
      if (v) return v;
    }
    if (hops === 0) return socketIp;
    const list = String(req.headers['x-forwarded-for'] || '').split(',').map(clean).filter(Boolean);
    if (!list.length) return socketIp;
    // the entry added by the outermost of our proxies; if the list is shorter, every entry came from a proxy
    return list[Math.max(0, list.length - hops)];
  }

  return function apply(req) {
    const ip = resolve(req) || 'unknown';
    req.clientIp = ip;
    req.headers['x-forwarded-for'] = ip;
    return ip;
  };
}

// A simple in-memory counter: at most `limit` hits per key in each `windowMs` window.
// Good enough for one server process (Render free plan runs one); a shared store would be needed
// for several instances.
export function createWindowLimiter({ limit, windowMs, maxKeys = 50_000 }) {
  const hits = new Map();            // key -> { count, resetAt }
  return function hit(key, now = Date.now()) {
    let e = hits.get(key);
    if (!e || e.resetAt <= now) {
      if (hits.size >= maxKeys) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= maxKeys) hits.clear();       // flood of unique keys: start over rather than grow without end
      e = { count: 0, resetAt: now + windowMs };
      hits.set(key, e);
    }
    e.count++;
    return { ok: e.count <= limit, retryAfter: Math.ceil((e.resetAt - now) / 1000) };
  };
}
