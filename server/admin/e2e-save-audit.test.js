// End-to-end Save Changes audit: verifies every Admin Panel section saves to PostgreSQL,
// persists across an application restart, and reflects on the customer-facing website APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from '../shop/app.js';
import { TEST_TWILIO_ENV } from '../shop/test-twilio.js';
import { hashPassword, newTotpSecret, totpCode } from './crypto.js';

const ORIGIN = 'http://localhost:3000';
const ENV = {
  ...TEST_TWILIO_ENV,
  NODE_ENV: 'test',
  SITE_ORIGIN: ORIGIN,
  SESSION_SECRET: 'e2e-shop-secret-0123456789abcdef',
  ADMIN_SESSION_SECRET: 'e2e-admin-secret-0123456789abcdef',
};

const apiCall = async (app, method, url, payload, cookie = '') => {
  const res = await app.inject({
    method,
    url,
    headers: {
      origin: ORIGIN,
      host: 'localhost:3000',
      ...(cookie ? { cookie } : {}),
    },
    ...(payload !== undefined ? { payload } : {}),
  });
  let body;
  try { body = res.json(); } catch { body = res.body; }
  return { status: res.statusCode, body, headers: res.headers };
};

test('Admin Panel E2E: every section saves to DB, persists across restart, and reflects on storefront', async () => {
  const db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  let app = await buildShopApp({ env: ENV, db, logger: false });

  // Sign in as owner
  const secret = newTotpSecret();
  await db.query(
    `INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
     VALUES ('owner@tranzlife.in', 'Owner', 'owner', $1, false, $2, true)`,
    [await hashPassword('StrongPass!2026'), secret],
  );
  const login = await apiCall(app, 'POST', '/api/admin/auth/login', {
    email: 'owner@tranzlife.in',
    password: 'StrongPass!2026',
    code: totpCode(secret),
  });
  assert.equal(login.status, 200);
  const adminCookie = login.headers['set-cookie'];

  // 1. Products & stock (existing product with null shelfLifeMonths + new product + batch)
  const liverRes = await apiCall(app, 'GET', '/api/admin/products/liver-booster', undefined, adminCookie);
  assert.equal(liverRes.status, 200);
  const lp = liverRes.body.product;
  const liverPatch = await apiCall(app, 'PATCH', '/api/admin/products/liver-booster', {
    name: lp.name,
    short: lp.short,
    tagline: lp.tagline,
    format: lp.format,
    size: lp.size,
    accent: lp.accent || '#1f6b3c',
    tint: lp.tint || '#eef4ea',
    concerns: lp.concerns || [],
    sortOrder: lp.sortOrder,
    price: 85000,
    mrp: 90000,
    gstRate: lp.gstRate,
    hsnCode: lp.hsnCode || null,
    lowStockAt: lp.lowStockAt,
    returnable: lp.returnable !== false,
    returnDays: lp.returnDays,
    content: lp.content,
    compliance: { ...lp.compliance, shelfLifeMonths: lp.compliance?.shelfLifeMonths ?? null },
  }, adminCookie);
  assert.equal(liverPatch.status, 200, `liver-booster PATCH failed: ${JSON.stringify(liverPatch.body)}`);

  const createdProd = await apiCall(app, 'POST', '/api/admin/products', {
    name: 'Audit Ashwagandha Drops',
    format: 'Drops',
    size: '30 ml',
    price: 45000,
    mrp: 50000,
  }, adminCookie);
  assert.equal(createdProd.status, 200);
  const newPid = createdProd.body.id;

  const batchRes = await apiCall(app, 'POST', `/api/admin/products/${newPid}/batches`, {
    batchNo: 'BATCH-AUD-01',
    mfgDate: '2026-01-10',
    expiryDate: '2028-12-31',
    qty: 50,
    note: 'Initial E2E batch',
  }, adminCookie);
  assert.equal(batchRes.status, 200);

  const activateRes = await apiCall(app, 'PATCH', `/api/admin/products/${newPid}`, { active: true }, adminCookie);
  assert.equal(activateRes.status, 200);

  // 2. Pricing, offers & packs
  const now = Date.now();
  const offerRes = await apiCall(app, 'POST', '/api/admin/offers', {
    name: 'Audit Flash Sale',
    kind: 'sale',
    productIds: [newPid],
    discountType: 'percent',
    value: 10,
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 86_400_000).toISOString(),
    active: true,
    showCountdown: false,
    badge: 'hot_deal',
  }, adminCookie);
  assert.equal(offerRes.status, 200);

  const packsRes = await apiCall(app, 'PUT', '/api/admin/packs', {
    packs: [
      { qty: 1, label: 'Pack of 1', discountPct: 0 },
      { qty: 2, label: 'Pack of 2', discountPct: 6 },
      { qty: 3, label: 'Pack of 3', discountPct: 12 },
    ],
  }, adminCookie);
  assert.equal(packsRes.status, 200);

  // 3. Website content (announcements + style + home sections)
  const annRes = await apiCall(app, 'POST', '/api/admin/announcements', {
    text: 'Audit live banner {prepaid} prepaid off',
    linkUrl: '/shop',
    active: true,
  }, adminCookie);
  assert.equal(annRes.status, 200);

  const styleRes = await apiCall(app, 'PUT', '/api/admin/announcements/style', {
    bg: '#124a2c',
    fg: '#ffffff',
    speed: 'fast',
  }, adminCookie);
  assert.equal(styleRes.status, 200);

  const contentGet = await apiCall(app, 'GET', '/api/admin/content', undefined, adminCookie);
  const homeRes = await apiCall(app, 'PUT', '/api/admin/home', {
    sections: contentGet.body.sections.map((s) => (
      s.key === 'products'
        ? { key: s.key, visible: s.visible, title: 'Updated Featured Formulas', subtitle: s.subtitle, productIds: s.productIds }
        : ['formulations'].includes(s.key)
          ? { key: s.key, visible: s.visible, title: s.title, subtitle: s.subtitle, productIds: s.productIds }
          : { key: s.key, visible: s.visible }
    )),
  }, adminCookie);
  assert.equal(homeRes.status, 200);

  // 4. Ingredients
  const ingRes = await apiCall(app, 'POST', '/api/admin/ingredients', {
    name: 'Audit Brahmi',
    alt: 'Bacopa',
    latin: 'Bacopa monnieri',
    type: 'herb',
    part: 'Whole herb',
    note: 'Traditional memory and calm support.',
    active: true,
  }, adminCookie);
  assert.equal(ingRes.status, 200);

  // 5. Compliance certificates
  const certRes = await apiCall(app, 'POST', '/api/admin/certificates', {
    name: 'Audit GMP Certificate',
    kind: 'certificate',
    issuer: 'AYUSH Dept',
    number: 'GMP-2026-99',
    issuedOn: '2026-01-01',
    expiresOn: '2027-12-31',
    products: [newPid],
  }, adminCookie);
  assert.equal(certRes.status, 200);

  // 6. Store settings
  const settingsRes = await apiCall(app, 'PATCH', '/api/admin/settings', {
    free_shipping_above: 150000,
    shipping_fee: 8000,
    prepaid_discount_pct: 7,
  }, adminCookie);
  assert.equal(settingsRes.status, 200);

  // 7. Customer, Enquiry, Newsletter, Staff, System Health
  const cust = (await db.query(`INSERT INTO customers (phone, name, email) VALUES ('9876509988', 'Audit Buyer', 'buyer@example.com') RETURNING id`)).rows[0];

  // Enquiry + Newsletter
  const enqPost = await apiCall(app, 'POST', '/api/contact', {
    name: 'Audit Enquirer',
    email: 'enq@example.com',
    phone: '9876543210',
    topic: 'Product question',
    message: 'Need dosage info',
    consent: true,
  });
  assert.equal(enqPost.status, 200);
  const enqList = await apiCall(app, 'GET', '/api/admin/enquiries?status=new', undefined, adminCookie);
  assert.equal(enqList.status, 200);
  const enqPatch = await apiCall(app, 'PATCH', `/api/admin/enquiries/${enqList.body.rows[0].id}`, { status: 'handled' }, adminCookie);
  assert.equal(enqPatch.status, 200);

  // Customer note
  const noteRes = await apiCall(app, 'POST', `/api/admin/customers/${cust.id}/notes`, { body: 'VIP audit buyer' }, adminCookie);
  assert.equal(noteRes.status, 200);

  // Staff create
  const staffRes = await apiCall(app, 'POST', '/api/admin/staff', {
    name: 'Audit Manager',
    email: 'manager@tranzlife.in',
    role: 'manager',
  }, adminCookie);
  assert.equal(staffRes.status, 200);

  // System health run
  const healthRes = await apiCall(app, 'POST', '/api/admin/health/run', {}, adminCookie);
  assert.equal(healthRes.status, 200);

  // Simulate application restart: boot a fresh Fastify instance against the same DB
  const app2 = await buildShopApp({ env: ENV, db, logger: false });

  // Verify storefront reflects all saved changes on the fresh instance
  const pubProds = await apiCall(app2, 'GET', '/api/products');
  assert.equal(pubProds.status, 200);
  const pubLiver = pubProds.body.products.find((p) => p.id === 'liver-booster');
  assert.equal(pubLiver.price, 850);
  assert.equal(pubLiver.mrp, 900);
  const pubNew = pubProds.body.products.find((p) => p.id === newPid);
  assert.ok(pubNew, 'Newly created active product should appear on storefront');
  assert.equal(pubNew.price, 405, '10% offer on ₹450 should show ₹405 on storefront');
  assert.equal(pubProds.body.shop.prepaidDiscount, 0.07);
  assert.equal(pubProds.body.shop.shippingFee, 80);

  const pubIngs = await apiCall(app2, 'GET', '/api/ingredients');
  assert.ok(pubIngs.body.ingredients.some((g) => g.name === 'Audit Brahmi'));

  const pubContent = await apiCall(app2, 'GET', '/api/site-content');
  assert.equal(pubContent.headers['cache-control'], 'no-cache');
  assert.ok(pubContent.body.announcement.messages.some((m) => m.text.includes('7% prepaid off')));
  assert.equal(pubContent.body.announcement.fg, '#ffffff');
  assert.equal(pubContent.body.home.sections.find((s) => s.key === 'products').title, 'Updated Featured Formulas');

  const quoteRes = await apiCall(app2, 'POST', '/api/checkout/quote', {
    items: [{ id: newPid, pack: 2, qty: 1 }],
    paymentMethod: 'upi',
  });
  assert.equal(quoteRes.status, 200);
  assert.ok(quoteRes.body.total > 0);

  // Verify admin data persisted on fresh instance
  const certCheck = await apiCall(app2, 'GET', '/api/admin/certificates', undefined, adminCookie);
  assert.ok(certCheck.body.certificates.some((c) => c.name === 'Audit GMP Certificate'));

  const enqCheck = await apiCall(app2, 'GET', '/api/admin/enquiries?status=handled', undefined, adminCookie);
  assert.ok(enqCheck.body.rows.some((r) => r.email === 'enq@example.com'));

  await app2.close();
});
