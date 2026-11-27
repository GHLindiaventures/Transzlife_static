import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopApp } from '../shop/app.js';
import { createDb } from '../db/index.js';
import { hashPassword, newTotpSecret, totpCode } from './crypto.js';

async function setup() {
  const db = await createDb({}, { memory: true });
  const app = await buildShopApp({
    db,
    logger: false,
    env: {
      NODE_ENV: 'test',
      SITE_ORIGIN: 'http://localhost',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef',
      ADMIN_SESSION_SECRET: 'test-admin-secret-0123456789abcdef',
      COURIER_WEBHOOK_SECRET: 'test-courier-secret',
    },
  });

  // Create customer & COD order
  const cust = (await db.query(`INSERT INTO customers (phone, name) VALUES ('9876543210', 'Asha') RETURNING *`)).rows[0];
  const { order } = await app.shop.orders.place({
    customer: cust,
    items: [{ id: 'pulmoclear-gummies', pack: 1, qty: 1 }],
    paymentMethod: 'cod',
    address: { name: 'Asha', phone: '9876543210', line1: '12 Gandhi Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' },
  });

  // Create admin owner session
  const secret = newTotpSecret();
  await db.query(
    `INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
     VALUES ('owner@tranzlife.in', 'Owner', 'owner', $1, false, $2, true)`,
    [await hashPassword('StrongPass!2026'), secret],
  );
  const login = await app.inject({
    method: 'POST', url: '/api/admin/auth/login',
    headers: { origin: 'http://localhost' },
    payload: { email: 'owner@tranzlife.in', password: 'StrongPass!2026', code: totpCode(secret) },
  });
  return { app, db, order, cookie: login.headers['set-cookie'] };
}

test('order delivery tracking: 8-stage journey, public masked tracking, courier webhook, and delayed filter', async () => {
  const { app, order, cookie } = await setup();
  try {
    assert.ok(order.tracking_id.startsWith('TRK-TZL-'));
    assert.ok(order.estimated_delivery_at);

    // Move through processing -> packed -> shipped with courier & AWB
    for (const [status, extra] of [
      ['processing', { note: 'Picking herbs' }],
      ['packed', { note: 'Box sealed' }],
      ['shipped', { courierName: 'Delhivery', awbNumber: 'DLV998877', location: 'Chennai Hub' }],
    ]) {
      const r = await app.inject({
        method: 'POST', url: `/api/admin/orders/${order.order_number}/status`,
        headers: { cookie, origin: 'http://localhost' },
        payload: { status, ...extra },
      });
      assert.equal(r.statusCode, 200);
    }

    // Courier webhook pushes in_transit scan
    const wh = await app.inject({
      method: 'POST', url: '/api/webhooks/courier/delhivery',
      headers: { 'x-courier-token': 'test-courier-secret' },
      payload: { awb: 'DLV998877', current_status: 'In Transit', location: 'Bengaluru Hub', note: 'Arrived at hub' },
    });
    assert.equal(wh.statusCode, 200);
    assert.equal(wh.json().status, 'in_transit');

    // Public tracking masks street address & phone
    const pub = await app.inject({ method: 'GET', url: `/api/track/${order.tracking_id}` });
    assert.equal(pub.statusCode, 200);
    const trk = pub.json().tracking;
    assert.equal(trk.status, 'in_transit');
    assert.equal(trk.courierName, 'Delhivery');
    assert.equal(trk.awbNumber, 'DLV998877');
    assert.equal(trk.stages.length, 9);
    assert.equal(trk.stages[6].key, 'in_transit');
    assert.equal(trk.stages[6].completed, true);
    assert.equal(trk.destination.line1, undefined);
    assert.equal(trk.destination.pin, '600***');

    // Mark delayed in admin & verify delayed filter returns the order
    const shipPatch = await app.inject({
      method: 'PATCH', url: `/api/admin/orders/${order.order_number}/shipment`,
      headers: { cookie, origin: 'http://localhost' },
      payload: { courierName: 'Delhivery', awbNumber: 'DLV998877', isDelayed: true, delayReason: 'Heavy rain' },
    });
    assert.equal(shipPatch.statusCode, 200);

    const delayedList = await app.inject({ method: 'GET', url: '/api/admin/orders?stage=delayed', headers: { cookie } });
    assert.equal(delayedList.statusCode, 200);
    assert.equal(delayedList.json().rows.length, 1);
    assert.equal(delayedList.json().rows[0].is_delayed, true);

    // Finish out_for_delivery -> delivered
    for (const status of ['out_for_delivery', 'delivered']) {
      const r = await app.inject({
        method: 'POST', url: `/api/admin/orders/${order.order_number}/status`,
        headers: { cookie, origin: 'http://localhost' },
        payload: { status },
      });
      assert.equal(r.statusCode, 200);
    }
    const pubDone = (await app.inject({ method: 'GET', url: `/api/track/${order.tracking_id}` })).json().tracking;
    assert.equal(pubDone.status, 'delivered');
    assert.equal(pubDone.stages[7].completed, true);
  } finally {
    await app.close();
  }
});
