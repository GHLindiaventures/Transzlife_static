import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';

function openSse(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers, agent: false }, (res) => {
      const events = [];
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        const frames = buf.split('\n\n');
        buf = frames.pop() || '';
        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(':')) continue;
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          events.push({ event, data: data ? JSON.parse(data) : null });
        }
      });
      resolve({ res, events, close: () => { res.destroy(); req.destroy(); } });
    });
    req.on('error', reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('SSE real-time hub: auth guards, scoped delivery, and no PII leakage', async (t) => {
  // in memory, like the other tests: never the developer's local database (data/pglite), which `npm run dev` holds
  const db = await createDb({ DATABASE_URL: '' }, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  const app = await buildShopApp({
    db,
    logger: false,
    env: {
      SESSION_SECRET: 'test-secret-012345678901234567890123456789',
      ADMIN_SESSION_SECRET: 'admin-secret-01234567890123456789012345',
    },
  });
  t.after(() => app.close());

  // 1. Auth guards on private SSE endpoints
  const unauthCust = await app.inject({ method: 'GET', url: '/api/events/customer' });
  assert.equal(unauthCust.statusCode, 401);

  const unauthAdmin = await app.inject({ method: 'GET', url: '/api/admin/events' });
  assert.equal(unauthAdmin.statusCode, 401);

  // 2. Listen on ephemeral port to test real SSE streaming
  const addr = await app.listen({ port: 0, host: '127.0.0.1' });
  const pubStream = await openSse(`${addr}/api/events/public?track=TZL-1001`);
  try {
    await wait(80);
    assert.equal(pubStream.events[0]?.event, 'ready');

    // Broadcast site_content -> public receives it
    app.shop.realtime.publish('site_content', {});
    await wait(80);
    assert.ok(pubStream.events.some((e) => e.event === 'site_content'));

    // Broadcast order for TZL-1001 -> public receives it without customerId/PII
    app.shop.realtime.publish('order', {
      orderNumber: 'TZL-1001',
      trackingId: 'TRK-1001',
      customerId: 'cust-secret-uuid',
      status: 'shipped',
    });
    // Broadcast order for another order TZL-9999 -> public must NOT receive it
    app.shop.realtime.publish('order', {
      orderNumber: 'TZL-9999',
      trackingId: 'TRK-9999',
      customerId: 'cust-other-uuid',
      status: 'delivered',
    });
    await wait(80);

    const orderEvents = pubStream.events.filter((e) => e.event === 'order');
    assert.equal(orderEvents.length, 1);
    assert.equal(orderEvents[0].data.orderNumber, 'TZL-1001');
    assert.equal(orderEvents[0].data.status, 'shipped');
    assert.equal('customerId' in orderEvents[0].data, false);
  } finally {
    pubStream.close();
  }
});
