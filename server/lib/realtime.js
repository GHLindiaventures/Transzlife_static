// Real-time event hub using Server-Sent Events (SSE) for Admin, Customer, and Public storefront sessions.
// Automatically handles heartbeats, client cleanup, and scoped event routing (no PII leaked to public/other customers).

function writeSseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

function sendFrame(res, id, event, data) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export function createRealtimeHub({ log } = {}) {
  let seq = 0;
  const adminClients = new Set();           // { res, staffId }
  const customerClients = new Map();        // customerId -> Set<{ res }>
  const publicClients = new Set();          // { res, trackIds: Set<string> }

  const ping = () => {
    for (const c of adminClients) {
      if (c.res.writableEnded || c.res.destroyed) adminClients.delete(c);
      else try { c.res.write(': ping\n\n'); } catch { adminClients.delete(c); }
    }
    for (const [cid, set] of customerClients) {
      for (const c of set) {
        if (c.res.writableEnded || c.res.destroyed) set.delete(c);
        else try { c.res.write(': ping\n\n'); } catch { set.delete(c); }
      }
      if (set.size === 0) customerClients.delete(cid);
    }
    for (const c of publicClients) {
      if (c.res.writableEnded || c.res.destroyed) publicClients.delete(c);
      else try { c.res.write(': ping\n\n'); } catch { publicClients.delete(c); }
    }
  };

  const heartbeat = setInterval(ping, 25_000);
  heartbeat.unref?.();

  /** Broadcasts a domain event to authorized subscribers only. */
  function publish(type, payload = {}) {
    const id = ++seq;
    const ts = Date.now();
    const full = { id, type, ts, ...payload };

    // 1. Admin / Staff receive all domain events
    for (const c of adminClients) {
      if (!sendFrame(c.res, id, type, full)) adminClients.delete(c);
    }

    // 2. Customer sessions receive global storefront events + their own customer/order/return events
    const isGlobal = type === 'site_content' || type === 'product' || type === 'inventory';
    const targetCustomer = payload.customerId ? String(payload.customerId) : null;
    if (isGlobal) {
      for (const [cid, set] of customerClients) {
        for (const c of set) {
          if (!sendFrame(c.res, id, type, full)) set.delete(c);
        }
        if (set.size === 0) customerClients.delete(cid);
      }
    } else if (targetCustomer && customerClients.has(targetCustomer)) {
      const set = customerClients.get(targetCustomer);
      for (const c of set) {
        if (!sendFrame(c.res, id, type, full)) set.delete(c);
      }
      if (set.size === 0) customerClients.delete(targetCustomer);
    }

    // 3. Public storefront receives site_content, catalog changes, and matching order tracking updates (no PII)
    if (type === 'site_content' || type === 'product' || type === 'inventory' || type === 'review') {
      const pubType = type === 'site_content' ? 'site_content' : 'catalog';
      for (const c of publicClients) {
        if (!sendFrame(c.res, id, pubType, { id, type: pubType, ts })) publicClients.delete(c);
      }
    } else if (type === 'order' && (payload.orderNumber || payload.trackingId)) {
      const pubData = {
        id,
        type: 'order',
        ts,
        orderNumber: payload.orderNumber || null,
        trackingId: payload.trackingId || null,
        status: payload.status || null,
      };
      for (const c of publicClients) {
        const match = (payload.orderNumber && c.trackIds.has(String(payload.orderNumber).toUpperCase()))
          || (payload.trackingId && c.trackIds.has(String(payload.trackingId).toUpperCase()));
        if (match && !sendFrame(c.res, id, 'order', pubData)) publicClients.delete(c);
      }
    }
  }

  function attachPublic(req, reply, trackIds = []) {
    reply.hijack();
    const res = reply.raw;
    writeSseHeaders(res);
    const client = {
      res,
      trackIds: new Set(trackIds.map((t) => String(t).trim().toUpperCase()).filter(Boolean)),
    };
    publicClients.add(client);
    sendFrame(res, ++seq, 'ready', { ok: true, scope: 'public' });
    req.raw.on('close', () => publicClients.delete(client));
  }

  function attachCustomer(req, reply) {
    if (!req.customer?.id) return reply.code(401).send({ error: 'Sign in required.' });
    reply.hijack();
    const res = reply.raw;
    writeSseHeaders(res);
    const cid = String(req.customer.id);
    if (!customerClients.has(cid)) customerClients.set(cid, new Set());
    const client = { res };
    customerClients.get(cid).add(client);
    sendFrame(res, ++seq, 'ready', { ok: true, scope: 'customer' });
    req.raw.on('close', () => {
      const set = customerClients.get(cid);
      if (set) {
        set.delete(client);
        if (set.size === 0) customerClients.delete(cid);
      }
    });
  }

  function attachAdmin(req, reply) {
    reply.hijack();
    const res = reply.raw;
    writeSseHeaders(res);
    const client = { res, staffId: req.staff?.id || null };
    adminClients.add(client);
    sendFrame(res, ++seq, 'ready', { ok: true, scope: 'admin' });
    req.raw.on('close', () => adminClients.delete(client));
  }

  function close() {
    clearInterval(heartbeat);
    for (const c of adminClients) try { c.res.end(); } catch { /* ignore */ }
    for (const set of customerClients.values()) for (const c of set) try { c.res.end(); } catch { /* ignore */ }
    for (const c of publicClients) try { c.res.end(); } catch { /* ignore */ }
    adminClients.clear();
    customerClients.clear();
    publicClients.clear();
    log?.info?.('[realtime] hub closed');
  }

  function stats() {
    let customers = 0;
    for (const set of customerClients.values()) customers += set.size;
    return { admin: adminClients.size, customer: customers, public: publicClients.size };
  }

  return { publish, attachPublic, attachCustomer, attachAdmin, close, stats };
}

export async function realtimeRoutes(app, { realtime }) {
  app.get('/api/events/public', async (req, reply) => {
    const raw = req.query?.track ? String(req.query.track).split(',') : [];
    realtime.attachPublic(req, reply, raw);
  });

  app.get('/api/events/customer', async (req, reply) => {
    realtime.attachCustomer(req, reply);
  });
}
