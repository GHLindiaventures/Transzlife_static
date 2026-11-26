// Orders: placing them (with stock reservation), confirming payment exactly once, and releasing
// stock held by payments that were never completed.
//
// Stock model:  available = on_hand - reserved
//   place order   -> reserved += units          (fails if not enough available)
//   paid / COD    -> on_hand -= units, reserved -= units   (stock_committed = true)
//   abandoned     -> reserved -= units           (after PAYMENT_WINDOW_MIN)
import { quote, ONLINE_METHODS, PricingError } from './pricing.js';
import { allocateFefo } from './batches.js';

export const PAYMENT_WINDOW_MIN = 30;

const addEvent = (t, orderId, from, to, actor, note = null, location = null, source = 'system') =>
  t.query('INSERT INTO order_events (order_id, from_status, to_status, actor, note, location, source) VALUES ($1,$2,$3,$4,$5,$6,$7)', [orderId, from, to, actor, note, location, source]);

async function orderUnits(t, orderId) {
  return (await t.query('SELECT product_id, SUM(pack * qty)::int AS units FROM order_items WHERE order_id = $1 GROUP BY product_id', [orderId])).rows;
}

async function commitStock(t, order, ref) {
  if (order.stock_committed) return;
  for (const { product_id, units } of await orderUnits(t, order.id)) {
    // if the reservation was already released (payment arrived after the window), only on_hand drops
    await t.query(
      `UPDATE inventory SET on_hand = on_hand - $2,
              reserved = CASE WHEN $3 THEN reserved - $2 ELSE reserved END WHERE product_id = $1`,
      [product_id, units, order.status === 'pending_payment']);
    await t.query(`INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,'sale',$3)`, [product_id, -units, ref]);
  }
  await allocateFefo(t, order.id);     // which batch each unit came from (soonest expiry first)
  await t.query('UPDATE orders SET stock_committed = true WHERE id = $1', [order.id]);
}

export function createOrders({ db, razorpay, log, notifier }) {
  /** Creates the order inside one transaction. Returns { order, created }. */
  async function place({ customer, items, paymentMethod, address, email, idempotencyKey }) {
    return db.tx(async (t) => {
      // same checkout submitted twice (double click, retry): return the first order
      if (idempotencyKey) {
        const existing = (await t.query('SELECT * FROM orders WHERE customer_id = $1 AND idempotency_key = $2', [customer.id, idempotencyKey])).rows[0];
        if (existing) return { order: existing, created: false };
      }
      const q = await quote(t.query, items, paymentMethod);
      if (q.outOfStock.length) throw new PricingError(`Sorry, not enough stock for: ${q.outOfStock.join(', ')}.`, 'out_of_stock');

      // reserve stock; the WHERE makes it impossible to oversell even with simultaneous orders
      const need = new Map();
      for (const l of q.lines) need.set(l.id, (need.get(l.id) ?? 0) + l.units);
      for (const [productId, units] of need) {
        const r = await t.query('UPDATE inventory SET reserved = reserved + $2 WHERE product_id = $1 AND on_hand - reserved >= $2', [productId, units]);
        if (!(r.affectedRows ?? r.rowCount)) throw new PricingError('Sorry, an item just went out of stock. Please review your order.', 'out_of_stock');
      }

      const online = ONLINE_METHODS.includes(paymentMethod);
      const status = online ? 'pending_payment' : 'confirmed';
      const n = (await t.query(`SELECT nextval('order_number_seq') AS n`)).rows[0].n;
      const orderNumber = `TZL-${String(n).padStart(6, '0')}`;
      const trackingId = `TRK-${orderNumber}`;
      const edd = !online ? new Date(Date.now() + 5 * 86400e3).toISOString() : null;
      const order = (await t.query(
        `INSERT INTO orders (order_number, tracking_id, customer_id, idempotency_key, email, phone, ship_address,
           subtotal, discount, shipping, tax, total, payment_method, status, payment_status, estimated_delivery_at, original_edd_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING *`,
        [orderNumber, trackingId, customer.id, idempotencyKey || null, email || null, address.phone, JSON.stringify(address),
          q.subtotal, q.discount, q.shipping, q.tax, q.total, paymentMethod, status, online ? 'pending' : 'cod_pending', edd])).rows[0];
      for (const l of q.lines) {
        await t.query(
          `INSERT INTO order_items (order_id, product_id, name, size, pack, qty, unit_price, unit_mrp, line_total, list_price, offer_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [order.id, l.id, l.name, l.size, l.pack, l.qty, l.unit, l.unitMrp, l.total, l.listUnit, l.offerId]);
      }
      // every rupee of discount, by source (offer / pack / prepaid), for the discount reports
      const saved = new Map();
      for (const l of q.lines) {
        if (l.offerSaving > 0) { const k = `offer:${l.offerId}`; saved.set(k, { kind: 'offer', ref: l.offerId, label: l.offerName, amount: (saved.get(k)?.amount || 0) + l.offerSaving }); }
        if (l.packSaving > 0) { const k = `pack:${l.pack}`; saved.set(k, { kind: 'pack', ref: String(l.pack), label: `Pack of ${l.pack}`, amount: (saved.get(k)?.amount || 0) + l.packSaving }); }
      }
      if (q.discount > 0) saved.set('prepaid', { kind: 'prepaid', ref: null, label: 'Prepaid discount', amount: q.discount });
      for (const d of saved.values()) {
        await t.query('INSERT INTO order_discounts (order_id, kind, ref_id, label, amount) VALUES ($1,$2,$3,$4,$5)', [order.id, d.kind, d.ref, d.label, d.amount]);
      }
      await addEvent(t, order.id, null, status, 'customer', online ? 'Order placed, awaiting payment' : 'Order placed (cash on delivery)', address.city || null, 'customer');
      if (!online) { await commitStock(t, { ...order, status: 'pending_payment' }, orderNumber); order.stock_committed = true; }
      return { order, created: true };
    });
  }

  /** Starts (or restarts) an online payment for a pending order. */
  async function startPayment(order, customer) {
    if (order.status !== 'pending_payment' || order.payment_status === 'paid') throw Object.assign(new Error('This order does not need payment.'), { status: 409 });
    const rp = await razorpay.createOrder({ amount: order.total, receipt: order.order_number, notes: { order_number: order.order_number } });
    await db.query(
      `INSERT INTO payments (order_id, provider, provider_order_id, amount, status) VALUES ($1,'razorpay',$2,$3,'created')`,
      [order.id, rp.id, order.total]);
    return {
      keyId: razorpay.keyId, orderId: rp.id, amount: rp.amount, currency: rp.currency,
      prefill: { name: customer.name || '', contact: `+91${customer.phone}`, email: customer.email || '' },
    };
  }

  /**
   * Marks a Razorpay payment as paid. Safe to call many times (browser callback + webhooks):
   * only the first call changes anything.
   */
  async function markPaid({ providerOrderId, providerPaymentId, method, raw, actor }) {
    let changed = false;
    const result = await db.tx(async (t) => {
      const pay = (await t.query('SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE', [providerOrderId])).rows[0];
      if (!pay) { log.warn(`[orders] payment for unknown Razorpay order ${providerOrderId}`); return null; }
      const order = (await t.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [pay.order_id])).rows[0];
      if (order.payment_status === 'paid') return order;
      await t.query(
        `UPDATE payments SET status = 'paid', provider_payment_id = COALESCE(provider_payment_id, $2), method = COALESCE($3, method),
                raw = COALESCE($4, raw), updated_at = now() WHERE id = $1`,
        [pay.id, providerPaymentId, method || null, raw ? JSON.stringify(raw) : null]);
      await commitStock(t, order, order.order_number);
      const late = order.status !== 'pending_payment';
      const edd = new Date(Date.now() + 5 * 86400e3).toISOString();
      const updated = (await t.query(
        `UPDATE orders SET payment_status = 'paid', status = 'confirmed',
                estimated_delivery_at = COALESCE(estimated_delivery_at, $2),
                original_edd_at = COALESCE(original_edd_at, $2),
                updated_at = now() WHERE id = $1 RETURNING *`, [order.id, edd])).rows[0];
      await addEvent(t, order.id, order.status, 'confirmed', actor,
        late ? `Payment received after the order had been ${order.status}; please check stock` : 'Payment received & order confirmed', null, actor === 'razorpay' ? 'system' : 'customer');
      changed = true;
      return updated;
    });
    if (changed) notifier?.notify(result.id, 'confirmed');
    return result;
  }

  async function markFailed({ providerOrderId, providerPaymentId, error, raw }) {
    await db.query(
      `UPDATE payments SET status = CASE WHEN status = 'paid' THEN status ELSE 'failed' END,
              provider_payment_id = COALESCE(provider_payment_id, $2), error = $3, raw = $4, updated_at = now()
        WHERE provider_order_id = $1`, [providerOrderId, providerPaymentId || null, error || null, raw ? JSON.stringify(raw) : null]);
  }

  /** Cancels unpaid online orders older than the payment window and frees their stock. */
  async function releaseExpired() {
    const stale = (await db.query(
      `SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < now() - make_interval(mins => $1)`, [PAYMENT_WINDOW_MIN])).rows;
    for (const { id } of stale) {
      await db.tx(async (t) => {
        const o = (await t.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (o.status !== 'pending_payment') return;
        for (const { product_id, units } of await orderUnits(t, id)) {
          await t.query('UPDATE inventory SET reserved = GREATEST(reserved - $2, 0) WHERE product_id = $1', [product_id, units]);
        }
        await t.query(`UPDATE orders SET status = 'cancelled', payment_status = 'expired', updated_at = now() WHERE id = $1`, [id]);
        await addEvent(t, id, 'pending_payment', 'cancelled', 'system', `Payment not completed within ${PAYMENT_WINDOW_MIN} minutes`);
      });
    }
    if (stale.length) log.info(`[orders] released ${stale.length} unpaid order(s)`);
  }

  // ---- reading -----------------------------------------------------------
  const PUBLIC = (o, items = [], events = []) => ({
    number: o.order_number,
    trackingId: o.tracking_id || `TRK-${o.order_number}`,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    email: o.email,
    phone: o.phone,
    courierName: o.courier_name || null,
    awbNumber: o.awb_number || null,
    trackingUrl: o.tracking_url || null,
    estimatedDeliveryAt: o.estimated_delivery_at || null,
    originalEddAt: o.original_edd_at || null,
    isDelayed: !!o.is_delayed,
    delayReason: o.delay_reason || null,
    deliveredAt: o.delivered_at || null,
    address: typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : o.ship_address,
    subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, tax: o.tax, total: o.total,
    items: items.map((i) => ({ id: i.product_id, name: i.name, size: i.size, pack: i.pack, qty: i.qty, unit: i.unit_price, total: i.line_total })),
    timeline: events.map((e) => ({ status: e.to_status, note: e.note, location: e.location || null, source: e.source || 'system', at: e.created_at })),
  });

  async function getForCustomer(customerId, number) {
    const o = (await db.query('SELECT * FROM orders WHERE order_number = $1 AND customer_id = $2', [number, customerId])).rows[0];
    if (!o) return null;
    const items = (await db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [o.id])).rows;
    const events = (await db.query('SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at, id', [o.id])).rows;
    return { row: o, public: PUBLIC(o, items, events) };
  }

  async function listForCustomer(customerId) {
    const orders = (await db.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId])).rows;
    if (!orders.length) return [];
    const items = (await db.query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orders.map((o) => o.id)])).rows;
    return orders.map((o) => PUBLIC(o, items.filter((i) => i.order_id === o.id)));
  }

  return { place, startPayment, markPaid, markFailed, releaseExpired, getForCustomer, listForCustomer, PUBLIC };
}
