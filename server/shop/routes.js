// Shop API (Fastify plugin). Every input is validated with zod; money is in paise.
//
//   GET    /api/shop/config                 what the checkout can offer (Razorpay on/off)
//   POST   /api/auth/otp/request            { phone }                 -> code sent by SMS
//   POST   /api/auth/otp/verify             { phone, code }           -> signed in (cookie)
//   GET    /api/auth/me                     current customer or null
//   POST   /api/auth/logout
//   PATCH  /api/account                     { name, email }
//   GET    /api/account/addresses           saved addresses
//   DELETE /api/account/addresses/:id
//   POST   /api/checkout/quote              { items, paymentMethod }  -> server-calculated totals
//   POST   /api/checkout/place              place order (signed in)   -> order (+ Razorpay details)
//   POST   /api/checkout/verify             Razorpay success callback -> order confirmed
//   GET    /api/orders                      my orders
//   GET    /api/orders/:number              one of my orders
//   POST   /api/orders/:number/pay          retry payment for a pending order
//   POST   /api/webhooks/razorpay           Razorpay -> payment captured / failed
import { z } from 'zod';
import { PAYMENT_METHODS, quote, PricingError } from './pricing.js';
import { attributeOrder } from './track.js';

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number.');
const item = z.object({ id: z.string().min(1).max(80), pack: z.number().int().min(1).max(12), qty: z.number().int().min(1).max(10) });
const items = z.array(item).min(1).max(30);
const address = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(80),
  phone,
  line1: z.string().trim().min(3, 'Enter the house / street.').max(160),
  line2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().min(2, 'Enter the city.').max(60),
  state: z.string().trim().min(2).max(60),
  pin: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code.'),
});
const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(120);

/** Parses or replies 400 with the first readable message. */
function parse(schema, data, reply) {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  reply.code(400).send({ error: r.error.issues[0]?.message || 'Invalid request.', code: 'invalid' });
  return null;
}

const customerOut = (c) => c && { phone: c.phone, name: c.name, email: c.email, marketingConsent: !!c.marketing_consent };

export default async function shopRoutes(app, { db, auth, orders, razorpay, notifier, log }) {
  const signedIn = { preHandler: auth.requireCustomer };
  const tight = (max, minutes = 15) => ({ config: { rateLimit: { max, timeWindow: `${minutes} minutes` } } });

  app.get('/api/shop/config', async () => ({
    razorpay: razorpay.enabled, razorpayKeyId: razorpay.keyId, methods: razorpay.enabled ? PAYMENT_METHODS : ['cod'],
  }));

  // ---- sign in -----------------------------------------------------------
  app.post('/api/auth/otp/request', tight(10), async (req, reply) => {
    const body = parse(z.object({ phone }), req.body, reply); if (!body) return;
    const out = await auth.requestCode(body.phone, req.ip);
    return { ok: true, ...out };
  });

  app.post('/api/auth/otp/verify', tight(20), async (req, reply) => {
    const body = parse(z.object({ phone, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') }), req.body, reply); if (!body) return;
    const customer = await auth.verifyCode(body.phone, body.code);
    await auth.startSession(reply, customer.id, req);
    return { customer: customerOut(customer), isNew: customer.is_new || !customer.name };
  });

  app.get('/api/auth/me', async (req) => ({ customer: customerOut(req.customer) }));

  app.post('/api/auth/logout', async (req, reply) => { await auth.endSession(req, reply); return { ok: true }; });

  // ---- account -----------------------------------------------------------
  app.patch('/api/account', signedIn, async (req, reply) => {
    const body = parse(z.object({
      name: z.string().trim().min(2, 'Enter your full name.').max(80),
      email: z.union([email, z.literal('')]).optional(),
      marketingConsent: z.boolean().optional(),
    }), req.body, reply); if (!body) return;
    const c = (await db.query(
      `UPDATE customers SET name = $2, email = COALESCE(NULLIF($3, ''), email), updated_at = now(),
              marketing_consent = COALESCE($4, marketing_consent),
              marketing_consent_at = CASE WHEN $4 IS NULL THEN marketing_consent_at ELSE now() END
        WHERE id = $1 RETURNING phone, name, email, marketing_consent`,
      [req.customer.id, body.name, body.email ?? '', body.marketingConsent ?? null])).rows[0];
    return { customer: customerOut(c) };
  });

  app.get('/api/account/addresses', signedIn, async (req) => ({
    addresses: (await db.query(
      `SELECT id, name, phone, line1, line2, city, state, pin, is_default AS "isDefault" FROM addresses
        WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`, [req.customer.id])).rows,
  }));

  app.delete('/api/account/addresses/:id', signedIn, async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    await db.query('DELETE FROM addresses WHERE id = $1 AND customer_id = $2', [id, req.customer.id]);
    return { ok: true };
  });

  // ---- checkout ----------------------------------------------------------
  app.post('/api/checkout/quote', async (req, reply) => {
    const body = parse(z.object({ items, paymentMethod: z.enum(PAYMENT_METHODS).optional() }), req.body, reply); if (!body) return;
    return quote(db.query, body.items, body.paymentMethod);
  });

  app.post('/api/checkout/place', { ...signedIn, ...tight(20) }, async (req, reply) => {
    const body = parse(z.object({
      items, paymentMethod: z.enum(PAYMENT_METHODS), address,
      email: z.union([email, z.literal('')]).optional(),
      saveAddress: z.boolean().optional().default(true),
      idempotencyKey: z.string().min(8).max(64),
      marketingConsent: z.boolean().optional(),
      track: z.object({ v: z.string().uuid(), s: z.string().uuid().optional() }).optional(),
    }), req.body, reply); if (!body) return;
    if (body.paymentMethod !== 'cod' && !razorpay.enabled) {
      return reply.code(400).send({ error: 'Online payments are not available yet. Please choose Cash on delivery.', code: 'payments_off' });
    }
    const c = req.customer;
    const contactEmail = body.email || c.email || null;
    const { order, created } = await orders.place({ customer: c, items: body.items, paymentMethod: body.paymentMethod, address: body.address, email: contactEmail, idempotencyKey: body.idempotencyKey });

    if (created) {
      // remember the email and (first time, or new) address for next time
      if (contactEmail && !c.email) await db.query('UPDATE customers SET email = $2 WHERE id = $1 AND email IS NULL', [c.id, contactEmail]);
      if (body.saveAddress) await saveAddress(c.id, body.address);
      if (body.marketingConsent !== undefined) {
        await db.query('UPDATE customers SET marketing_consent = $2, marketing_consent_at = now() WHERE id = $1', [c.id, body.marketingConsent]);
      }
      await attributeOrder(db, order, c.id, body.track).catch((e) => log?.warn?.(`[track] attribution failed: ${e.message}`));
      if (order.status === 'confirmed') notifier?.notify(order.id, 'confirmed');    // cash on delivery
    }
    const payment = order.status === 'pending_payment' ? await orders.startPayment(order, c) : null;
    return { order: orders.PUBLIC(order), payment };
  });

  async function saveAddress(customerId, a) {
    const same = (await db.query(
      `SELECT id FROM addresses WHERE customer_id = $1 AND lower(line1) = lower($2) AND pin = $3 AND lower(name) = lower($4)`,
      [customerId, a.line1, a.pin, a.name])).rows[0];
    if (same) return;
    const first = !(await db.query('SELECT 1 FROM addresses WHERE customer_id = $1 LIMIT 1', [customerId])).rows.length;
    await db.query(
      `INSERT INTO addresses (customer_id, name, phone, line1, line2, city, state, pin, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [customerId, a.name, a.phone, a.line1, a.line2 || null, a.city, a.state, a.pin, first]);
  }

  app.post('/api/checkout/verify', signedIn, async (req, reply) => {
    const body = parse(z.object({
      orderNumber: z.string().max(20),
      razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(200),
    }), req.body, reply); if (!body) return;
    const mine = await orders.getForCustomer(req.customer.id, body.orderNumber);
    if (!mine) return reply.code(404).send({ error: 'Order not found.' });
    const owned = (await db.query('SELECT 1 FROM payments WHERE order_id = $1 AND provider_order_id = $2', [mine.row.id, body.razorpay_order_id])).rows.length;
    if (!owned || !razorpay.verifyPayment({ orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature })) {
      return reply.code(400).send({ error: 'We could not verify this payment. If money was deducted, it will be confirmed automatically or refunded.', code: 'bad_signature' });
    }
    await orders.markPaid({ providerOrderId: body.razorpay_order_id, providerPaymentId: body.razorpay_payment_id, actor: 'customer' });
    return { order: (await orders.getForCustomer(req.customer.id, body.orderNumber)).public };
  });

  // ---- my orders ---------------------------------------------------------
  app.get('/api/orders', signedIn, async (req) => ({ orders: await orders.listForCustomer(req.customer.id) }));

  app.get('/api/orders/:number', signedIn, async (req, reply) => {
    const o = await orders.getForCustomer(req.customer.id, String(req.params.number).slice(0, 20));
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    return { order: o.public };
  });

  app.post('/api/orders/:number/pay', { ...signedIn, ...tight(10) }, async (req, reply) => {
    const o = await orders.getForCustomer(req.customer.id, String(req.params.number).slice(0, 20));
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    return { order: o.public, payment: await orders.startPayment(o.row, req.customer) };
  });

  // ---- Razorpay webhook --------------------------------------------------
  // Source of truth for payments: confirms the order even if the customer closed the tab.
  app.post('/api/webhooks/razorpay', { config: { rawBody: true, skipOriginCheck: true } }, async (req, reply) => {
    const raw = req.rawBody;
    if (!razorpay.verifyWebhook(raw, req.headers['x-razorpay-signature'])) return reply.code(400).send({ error: 'bad signature' });
    const event = JSON.parse(raw);
    const eventId = String(req.headers['x-razorpay-event-id'] || `${event.event}:${event.created_at}:${event.payload?.payment?.entity?.id}`);
    const fresh = await db.query(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload) VALUES ('razorpay',$1,$2,$3) ON CONFLICT DO NOTHING`,
      [eventId, event.event, raw]);
    if (!(fresh.affectedRows ?? fresh.rowCount)) return { ok: true, duplicate: true };
    const p = event.payload?.payment?.entity;
    if (p?.order_id && (event.event === 'payment.captured' || event.event === 'order.paid')) {
      await orders.markPaid({ providerOrderId: p.order_id, providerPaymentId: p.id, method: p.method, raw: p, actor: 'razorpay' });
    } else if (p?.order_id && event.event === 'payment.failed') {
      await orders.markFailed({ providerOrderId: p.order_id, providerPaymentId: p.id, error: p.error_description, raw: p });
    }
    return { ok: true };
  });

  // readable errors for known cases; everything else is logged and hidden
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof PricingError || (err.status && err.status < 500)) {
      if (err.retryAfter) reply.header('Retry-After', err.retryAfter);
      return reply.code(err.status || 400).send({ error: err.message, code: err.code || 'error' });
    }
    if (err.status === 503) return reply.code(503).send({ error: err.message, code: 'unavailable' });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'Invalid request.', code: 'invalid' });
    log.error({ err, url: req.url }, '[shop] request failed');
    return reply.code(err.status === 503 ? 503 : 500).send({ error: 'Something went wrong on our side. Please try again.', code: 'server_error' });
  });
}
