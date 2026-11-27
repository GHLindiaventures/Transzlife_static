// Integration tests for Cashfree payments, Shiprocket outbound shipping, GST invoices, and SEO endpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { hashPassword, newTotpSecret, totpCode } from './crypto.js';

const ORIGIN = 'http://localhost:3000';
const ENV = {
  ...TEST_TWILIO_ENV,
  NODE_ENV: 'test',
  SITE_ORIGIN: ORIGIN,
  SITE_URL: ORIGIN,
  SESSION_SECRET: 'int-shop-secret-0123456789abcdef',
  ADMIN_SESSION_SECRET: 'int-admin-secret-0123456789abcdef',
  CASHFREE_APP_ID: 'cf_app_test',
  CASHFREE_SECRET_KEY: 'cf_secret_test_key',
  CASHFREE_WEBHOOK_SECRET: 'cf_webhook_secret',
  CASHFREE_ENV: 'sandbox',
  PAYMENT_PROVIDER: 'cashfree',
  SHIPROCKET_EMAIL: 'ship@tranzlife.in',
  SHIPROCKET_PASSWORD: 'ship-password',
};

test('Cashfree, Shiprocket outbound shipping, GST invoice, and SEO endpoints', async (t) => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u === 'https://sandbox.cashfree.com/pg/orders') {
      const body = JSON.parse(opts.body);
      return new Response(JSON.stringify({ order_id: body.order_id, cf_order_id: 9001, payment_session_id: 'session_cf_123' }));
    }
    if (u.includes('sandbox.cashfree.com/pg/orders/') && u.endsWith('/payments')) {
      return new Response(JSON.stringify([{ cf_payment_id: 'cf_pay_99', payment_status: 'SUCCESS', payment_group: 'upi' }]));
    }
    if (u.includes('sandbox.cashfree.com/pg/orders/') && u.endsWith('/refunds')) {
      return new Response(JSON.stringify({ cf_refund_id: 'cf_rfnd_1', refund_status: 'SUCCESS' }));
    }
    if (u === 'https://apiv2.shiprocket.in/v1/external/auth/login') {
      return new Response(JSON.stringify({ token: 'sr_tok_123' }));
    }
    if (u.startsWith('https://apiv2.shiprocket.in/v1/external/courier/serviceability')) {
      return new Response(JSON.stringify({
        data: {
          available_courier_companies: [
            { courier_company_id: 10, courier_name: 'Delhivery Air', rate: 62, estimated_delivery_days: 3, etd: '2026-12-01', cod: 1 },
          ],
        },
      }));
    }
    if (u === 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc') {
      return new Response(JSON.stringify({ order_id: 777, shipment_id: 888 }));
    }
    if (u === 'https://apiv2.shiprocket.in/v1/external/courier/assign/awb') {
      return new Response(JSON.stringify({
        response: { data: { awb_code: 'AWB-SR-1001', courier_name: 'Delhivery Air', estimated_delivery_date: '2026-12-01' } },
      }));
    }
    if (u.startsWith('https://apiv2.shiprocket.in/v1/external/orders/show/')) {
      return new Response(JSON.stringify({ data: { shipments: [{ id: 888 }] } }));
    }
    if (u === 'https://apiv2.shiprocket.in/v1/external/courier/generate/pickup') {
      return new Response(JSON.stringify({ pickup_status: 1 }));
    }
    if (u === 'https://apiv2.shiprocket.in/v1/external/courier/generate/label') {
      return new Response(JSON.stringify({ label_url: 'https://shiprocket.co/labels/888.pdf' }));
    }
    return realFetch(url, opts);
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  const app = await buildShopApp({ env: ENV, db, logger: false });
  t.after(() => app.close());

  // 1. SEO: robots.txt & sitemap.xml
  const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
  assert.equal(robots.statusCode, 200);
  assert.match(robots.body, /Sitemap: http:\/\/localhost:3000\/sitemap\.xml/);
  const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });
  assert.equal(sitemap.statusCode, 200);
  assert.match(sitemap.body, /\/products\/pulmoclear-gummies/);

  // 2. Shipping serviceability check
  const svc = await app.inject({ method: 'GET', url: '/api/shipping/serviceability?pin=600001' });
  assert.equal(svc.statusCode, 200);
  assert.equal(svc.json().serviceable, true);
  assert.equal(svc.json().estimatedDays, 3);

  // 3. Shop config exposes Cashfree
  const cfg = (await app.inject({ method: 'GET', url: '/api/shop/config' })).json();
  assert.equal(cfg.cashfree, true);
  assert.equal(cfg.onlineEnabled, true);

  // 4. Admin login
  const secret = newTotpSecret();
  await db.query(
    `INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
     VALUES ('owner@tranzlife.in', 'Owner', 'owner', $1, false, $2, true)`,
    [await hashPassword('StrongPass!2026'), secret],
  );
  const login = await app.inject({
    method: 'POST', url: '/api/admin/auth/login',
    headers: { origin: ORIGIN, host: 'localhost:3000' },
    payload: { email: 'owner@tranzlife.in', password: 'StrongPass!2026', code: totpCode(secret) },
  });
  const adminCookie = login.headers['set-cookie'];

  // 5. Seed customer + place Cashfree order via orders.place & startPayment
  const cust = (await db.query(`INSERT INTO customers (phone, name, email) VALUES ('9876543219', 'CF Buyer', 'cf@example.com') RETURNING id, phone, name, email`)).rows[0];
  const { order } = await app.shop.orders.place({
    customer: cust,
    items: [{ id: 'pulmoclear-gummies', pack: 1, qty: 1 }],
    paymentMethod: 'upi',
    address: { name: 'CF Buyer', phone: '9876543219', line1: '12 MG Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' },
    email: 'cf@example.com',
    idempotencyKey: 'cf-idem-key-0001',
  });
  const payInit = await app.shop.orders.startPayment(order, cust);
  assert.equal(payInit.provider, 'cashfree');
  assert.equal(payInit.paymentSessionId, 'session_cf_123');

  // 6. Cashfree webhook verification + idempotent markPaid
  const ts = String(Math.floor(Date.now() / 1000));
  const rawHook = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    event_time: '2026-11-27T10:00:00Z',
    data: { order: { order_id: payInit.orderId }, payment: { cf_payment_id: 'cf_pay_99', payment_status: 'SUCCESS', payment_group: 'upi' } },
  });
  const sig = createHmac('sha256', ENV.CASHFREE_WEBHOOK_SECRET).update(`${ts}${rawHook}`).digest('base64');
  const hookRes = await app.inject({
    method: 'POST', url: '/api/webhooks/cashfree', payload: rawHook,
    headers: { 'content-type': 'application/json', 'x-webhook-signature': sig, 'x-webhook-timestamp': ts },
  });
  assert.equal(hookRes.statusCode, 200);

  // 7. Admin checks available couriers, books Shiprocket shipment, prevents duplicate booking, schedules pickup, gets label & GST invoice
  const couriersRes = await app.inject({
    method: 'GET', url: `/api/admin/orders/${order.order_number}/couriers`,
    headers: { cookie: adminCookie },
  });
  assert.equal(couriersRes.statusCode, 200);
  assert.equal(couriersRes.json().couriers[0].name, 'Delhivery Air');

  const shipRes = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/ship`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: { provider: 'shiprocket', courierId: 10, courierName: 'Delhivery Air' },
  });
  assert.equal(shipRes.statusCode, 200);
  assert.equal(shipRes.json().awb, 'AWB-SR-1001');
  assert.equal(shipRes.json().courierName, 'Delhivery Air');
  assert.equal(shipRes.json().status, 'ready_for_pickup');

  // Duplicate shipment booking must be rejected (409)
  const dupShip = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/ship`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: { provider: 'shiprocket' },
  });
  assert.equal(dupShip.statusCode, 409);

  const pickupRes = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/pickup`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: {},
  });
  assert.equal(pickupRes.statusCode, 200);
  assert.equal(pickupRes.json().pickupStatus, 'scheduled');

  // 9-stage customer tracking check
  const trkRes = await app.inject({ method: 'GET', url: `/api/track/${order.order_number}` });
  assert.equal(trkRes.statusCode, 200);
  assert.equal(trkRes.json().tracking.stages.length, 9);
  assert.equal(trkRes.json().tracking.pickupStatus, 'scheduled');

  // Webhook exception: delivery_failed -> rto -> refund_initiated -> refunded
  const failHook = await app.inject({
    method: 'POST', url: '/api/webhooks/courier/shiprocket',
    payload: { awb: 'AWB-SR-1001', current_status: 'Delivery Failed', note: 'Customer unavailable' },
  });
  assert.equal(failHook.statusCode, 200);
  assert.equal(failHook.json().status, 'delivery_failed');

  const rtoRes = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/status`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: { status: 'rto', note: 'Returning to warehouse' },
  });
  assert.equal(rtoRes.statusCode, 200);

  const refInit = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/status`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: { status: 'refund_initiated', note: 'Initiated after RTO' },
  });
  assert.equal(refInit.statusCode, 200);

  const labelRes = await app.inject({
    method: 'GET', url: `/api/admin/orders/${order.order_number}/label`,
    headers: { cookie: adminCookie },
  });
  assert.equal(labelRes.statusCode, 200);
  assert.equal(labelRes.json().labelUrl, 'https://shiprocket.co/labels/888.pdf');

  const invRes = await app.inject({
    method: 'GET', url: `/api/admin/orders/${order.order_number}/invoice`,
    headers: { cookie: adminCookie },
  });
  assert.equal(invRes.statusCode, 200);
  assert.match(invRes.body, /Tax Invoice/);
  assert.match(invRes.body, /TZL\/\d{2}-\d{2}\/00001/);
  assert.match(invRes.body, /33AAMCT8943N1ZJ/);
  assert.match(invRes.body, /CGST Output/);
  assert.match(invRes.body, /SGST Output/);
  assert.match(invRes.body, /Amount Chargeable \(in words\)/);

  // Inter-state COD order gets next sequential invoice number and IGST
  const { order: interOrder } = await app.shop.orders.place({
    customer: cust,
    items: [{ id: 'pulmoclear-gummies', pack: 1, qty: 1 }],
    paymentMethod: 'cod',
    address: { name: 'Inter Buyer', phone: '9876543219', line1: '100 Brigade Road', city: 'Bengaluru', state: 'Karnataka', pin: '560001' },
    email: 'cf@example.com',
    idempotencyKey: 'cf-idem-key-0002',
  });
  assert.match(interOrder.invoice_number, /^TZL\/\d{2}-\d{2}\/00002$/);
  const interInv = await app.inject({
    method: 'GET', url: `/api/admin/orders/${interOrder.order_number}/invoice`,
    headers: { cookie: adminCookie },
  });
  assert.equal(interInv.statusCode, 200);
  assert.match(interInv.body, /IGST Output/);
  assert.doesNotMatch(interInv.body, /CGST Output/);

  // 8. Cashfree refund via Admin
  const rfRes = await app.inject({
    method: 'POST', url: `/api/admin/orders/${order.order_number}/refund`,
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: { reason: 'Customer requested cancellation' },
  });
  assert.equal(rfRes.statusCode, 200);
  assert.equal(rfRes.json().method, 'cashfree');

  // 9. Admin Settings: company_bank, payment_gateways, marketing_tags, social_links, notification_config
  const settingsPatch = await app.inject({
    method: 'PATCH', url: '/api/admin/settings',
    headers: { cookie: adminCookie, origin: ORIGIN, host: 'localhost:3000' },
    payload: {
      company_bank: {
        accountHolder: 'TranzLife Wellness Pvt Ltd',
        bankName: 'HDFC Bank',
        accountNumber: '50200012345678',
        branch: 'Chennai Main',
        ifsc: 'HDFC0000001',
      },
      payment_gateways: { razorpayEnabled: true, cashfreeEnabled: false, activeProvider: 'razorpay' },
      marketing_tags: {
        gtmId: 'GTM-TEST123',
        ga4Id: 'G-TEST123456',
        metaPixelId: '9876543210',
        gscVerification: 'gsc-token-1',
        metaDomainVerification: 'meta-token-1',
      },
      social_links: [
        { key: 'instagram', label: 'Instagram', url: 'https://instagram.com/tranzlife', enabled: true },
        { key: 'facebook', label: 'Facebook', url: 'https://facebook.com/tranzlife', enabled: false },
      ],
      notification_config: {
        channels: { email: true, sms: false, whatsapp: true },
        adminRecipients: { emails: ['ops@tranzlife.in'], phones: ['9150394443'] },
        adminEvents: { new_order: true, payment_failed: true },
        customerEvents: { confirmed: true, shipped: false },
        templates: { confirmed: 'Hi {customer_name}, order {order_number} confirmed!' },
      },
    },
  });
  assert.equal(settingsPatch.statusCode, 200);

  // Invoice includes bank details + Billed By staff name
  const invWithBank = await app.inject({
    method: 'GET', url: `/api/admin/orders/${order.order_number}/invoice`,
    headers: { cookie: adminCookie },
  });
  assert.equal(invWithBank.statusCode, 200);
  assert.match(invWithBank.body, /HDFC Bank/);
  assert.match(invWithBank.body, /HDFC0000001/);
  assert.match(invWithBank.body, /Billed By/);

  // Shop config reflects payment_gateways toggle
  const shopCfg = await app.inject({ method: 'GET', url: '/api/shop/config' });
  assert.equal(shopCfg.statusCode, 200);
  assert.equal(shopCfg.json().cashfree, false);
  assert.equal(shopCfg.json().activeProvider, 'razorpay');

  // Public site-content reflects marketing_tags & enabled social_links
  const siteContent = await app.inject({ method: 'GET', url: '/api/site-content' });
  assert.equal(siteContent.statusCode, 200);
  assert.equal(siteContent.json().marketing.ga4Id, 'G-TEST123456');
  assert.equal(siteContent.json().marketing.gtmId, 'GTM-TEST123');
  assert.equal(siteContent.json().socialLinks.length, 2);
  assert.equal(siteContent.json().socialLinks[0].label, 'Instagram');
});
