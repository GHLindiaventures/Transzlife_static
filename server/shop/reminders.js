// Cart and refill reminders by SMS / WhatsApp (Twilio), only to customers who opted in
// (customers.marketing_consent). Uses the same channel as order updates (ORDER_NOTIFICATIONS).
//   - cart:    a signed-in customer left items in their cart (no order) for `cart_reminder_hours`
//   - reorder: `reorder_days` after their last order was placed (these products last about a month)
//   - review:  `review_request_days` (default 7) after an order was delivered, asking for a review of
//              the products in it they have not reviewed yet
// Staff can send one from the dashboard; automatic sending is off until turned on in Settings,
// and only goes out between 9 am and 9 pm India time. Each cart fill / last order gets one message
// at most (marketing_messages is unique per customer + kind + ref).
// NOTE (India): promotional SMS needs a DLT-registered template; WhatsApp needs an approved template.
import { loadSettings } from './pricing.js';

const COUNTED = `status NOT IN ('pending_payment', 'cancelled')`;
const first = (name) => (name || '').split(' ')[0];
const shortName = (n) => String(n || '').replace(/^TranzLife\s+/i, '');

export function createReminders({ db, twilio, env, log }) {
  const channel = String(env.ORDER_NOTIFICATIONS || 'off').toLowerCase();
  const ready = (channel === 'sms' && twilio?.smsReady) || (channel === 'whatsapp' && twilio?.whatsappReady);
  const site = String(env.SITE_URL || '').replace(/\/$/, '');

  const cartText = (c, names) => `TranzLife: Hi${first(c.name) ? ` ${first(c.name)}` : ''}, you left ${names.join(', ')} in your cart. `
    + `Your items are waiting${site ? `: ${site}/cart` : ''}. Reply STOP to stop these messages.`;
  const reorderText = (c, product, days) => `TranzLife: Hi${first(c.name) ? ` ${first(c.name)}` : ''}, it's been about ${days} days since your order of ${shortName(product.name)}. `
    + `Running low? Reorder in a tap${site ? `: ${site}/products/${product.id}` : ''}. Reply STOP to stop these messages.`;

  /** Claims the (customer, kind, ref) slot, sends, records the result. Returns { sent, error }. */
  async function deliver(customer, kind, ref, body, staffEmail) {
    if (!ready) return { sent: false, error: 'Customer messages are not set up (Settings → Connected services).' };
    if (!customer.marketing_consent) return { sent: false, error: 'This customer has not agreed to reminders.' };
    const claim = await db.query(
      `INSERT INTO marketing_messages (customer_id, kind, ref, channel, body, status, staff_email) VALUES ($1,$2,$3,$4,$5,'sending',$6)
       ON CONFLICT (customer_id, kind, ref) DO NOTHING RETURNING id`, [customer.id, kind, ref, channel, body, staffEmail ?? null]);
    const id = claim.rows[0]?.id;
    if (!id) return { sent: false, error: 'A reminder was already sent for this.' };
    try {
      const r = channel === 'whatsapp' ? await twilio.sendWhatsApp(customer.phone, body) : await twilio.sendSms(customer.phone, body);
      await db.query(`UPDATE marketing_messages SET status = 'sent', provider_id = $2, sent_at = now() WHERE id = $1`, [id, r?.sid || null]);
      return { sent: true };
    } catch (e) {
      await db.query(`UPDATE marketing_messages SET status = 'failed', error = $2 WHERE id = $1`, [id, String(e.message).slice(0, 300)]);
      log?.warn?.(`[reminders] ${kind} for ${customer.id} failed: ${e.message}`);
      return { sent: false, error: e.message };
    }
  }

  async function sendCart(cartId, staffEmail) {
    const c = (await db.query(`
      SELECT k.id AS cart_id, k.items, k.started_at, k.order_id, k.item_count, cu.id, cu.name, cu.phone, cu.marketing_consent, cu.deleted_at
        FROM carts k JOIN customers cu ON cu.id = k.customer_id WHERE k.id = $1`, [cartId])).rows[0];
    if (!c) return { sent: false, error: 'This cart belongs to a visitor who has not signed in, so we cannot message them.' };
    if (c.deleted_at) return { sent: false, error: 'This customer was deleted.' };
    if (c.order_id || !c.item_count) return { sent: false, error: 'This cart was already bought or emptied.' };
    const items = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
    const names = (await db.query('SELECT name FROM products WHERE id = ANY($1)', [items.map((i) => i.id)])).rows.map((r) => shortName(r.name));
    const res = await deliver(c, 'cart', `${c.cart_id}:${new Date(c.started_at || 0).getTime()}`, cartText(c, names.length ? names : ['a few items']), staffEmail);
    if (res.sent) await db.query('UPDATE carts SET reminded_at = now() WHERE id = $1', [c.cart_id]);
    return res;
  }

  async function sendReorder(customerId, staffEmail, days) {
    const c = (await db.query('SELECT id, name, phone, marketing_consent, deleted_at FROM customers WHERE id = $1', [customerId])).rows[0];
    if (!c || c.deleted_at) return { sent: false, error: 'Customer not found.' };
    const last = (await db.query(`
      SELECT o.order_number, o.created_at, (SELECT i.product_id FROM order_items i WHERE i.order_id = o.id ORDER BY i.line_total DESC LIMIT 1) AS product_id
        FROM orders o WHERE o.customer_id = $1 AND o.${COUNTED} ORDER BY o.created_at DESC LIMIT 1`, [customerId])).rows[0];
    if (!last) return { sent: false, error: 'This customer has not ordered yet.' };
    const product = (await db.query('SELECT id, name FROM products WHERE id = $1', [last.product_id])).rows[0];
    if (!product) return { sent: false, error: 'The product they bought is no longer listed.' };
    const since = days ?? Math.max(1, Math.round((Date.now() - new Date(last.created_at).getTime()) / 86400000));
    return deliver(c, 'reorder', last.order_number, reorderText(c, product, since), staffEmail);
  }

  const reviewText = (c, product, more) => `TranzLife: Hi${first(c.name) ? ` ${first(c.name)}` : ''}, how are you finding your ${shortName(product.name)}? `
    + `Your review helps others choose${site ? `: ${site}/products/${product.id}?review=1#reviews` : ''}${more ? ' (you can review your other items there too)' : ''}. Reply STOP to stop these messages.`;

  /** Asks for a review of a delivered order (one message per order). */
  async function sendReviewRequest(orderId, staffEmail) {
    const o = (await db.query(`SELECT o.id, o.order_number, cu.id AS customer_id, cu.name, cu.phone, cu.marketing_consent, cu.deleted_at
                                 FROM orders o JOIN customers cu ON cu.id = o.customer_id WHERE o.id = $1`, [orderId])).rows[0];
    if (!o || o.deleted_at) return { sent: false, error: 'Order not found.' };
    const left = (await db.query(`SELECT DISTINCT p.id, p.name, MAX(i.line_total) OVER (PARTITION BY p.id) AS v FROM order_items i JOIN products p ON p.id = i.product_id AND p.active
                                   WHERE i.order_id = $1 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.customer_id = $2 AND r.product_id = p.id)
                                   ORDER BY v DESC`, [orderId, o.customer_id])).rows;
    if (!left.length) return { sent: false, error: 'Everything in this order has been reviewed already.' };
    const c = { id: o.customer_id, name: o.name, phone: o.phone, marketing_consent: o.marketing_consent };
    return deliver(c, 'review', o.order_number, reviewText(c, left[0], left.length > 1), staffEmail);
  }

  /** Automatic reminders (each kind only when switched on in Settings). */
  async function sweep() {
    if (!ready) return;
    const hour = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
    if (hour < 9 || hour >= 21) return;
    const s = await loadSettings(db.query);
    if (s.reminders_cart) {
      const carts = (await db.query(`
        SELECT k.id FROM carts k JOIN customers cu ON cu.id = k.customer_id
         WHERE k.item_count > 0 AND k.order_id IS NULL AND k.reminded_at IS NULL AND cu.marketing_consent AND cu.deleted_at IS NULL
           AND k.updated_at < now() - make_interval(hours => $1) AND k.updated_at > now() - interval '3 days'
           AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = cu.id AND o.created_at > k.started_at)
         ORDER BY k.updated_at LIMIT 20`, [Number(s.cart_reminder_hours) || 4])).rows;
      for (const k of carts) await sendCart(k.id, null);
    }
    if (s.reminders_reorder) {
      const days = Number(s.reorder_days) || 30;
      const due = (await db.query(`
        SELECT cu.id FROM customers cu
          JOIN LATERAL (SELECT order_number, created_at FROM orders o WHERE o.customer_id = cu.id AND o.${COUNTED} ORDER BY created_at DESC LIMIT 1) l ON true
         WHERE cu.marketing_consent AND cu.deleted_at IS NULL
           AND l.created_at < now() - make_interval(days => $1) AND l.created_at > now() - make_interval(days => $1 + 5)
           AND NOT EXISTS (SELECT 1 FROM marketing_messages m WHERE m.customer_id = cu.id AND m.kind = 'reorder' AND m.ref = l.order_number)
         LIMIT 20`, [days])).rows;
      for (const c of due) await sendReorder(c.id, null, days);
    }
    if (s.review_requests) {
      const days = Number(s.review_request_days) || 7;
      const due = (await db.query(`
        SELECT o.id FROM orders o JOIN customers cu ON cu.id = o.customer_id
          JOIN LATERAL (SELECT MAX(created_at) AS at FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'delivered') d ON d.at IS NOT NULL
         WHERE o.status = 'delivered' AND cu.marketing_consent AND cu.deleted_at IS NULL
           AND d.at < now() - make_interval(days => $1) AND d.at > now() - make_interval(days => $1 + 5)
           AND NOT EXISTS (SELECT 1 FROM marketing_messages m WHERE m.customer_id = cu.id AND m.kind = 'review' AND m.ref = o.order_number)
         LIMIT 20`, [days])).rows;
      for (const o of due) await sendReviewRequest(o.id, null);
    }
  }

  /** Raw analytics older than 13 months are deleted (privacy policy); run about once an hour. */
  let lastPrune = 0;
  async function prune() {
    if (Date.now() - lastPrune < 3600_000) return;
    lastPrune = Date.now();
    await db.query(`DELETE FROM events WHERE created_at < now() - interval '13 months'`);
    await db.query(`DELETE FROM visits WHERE started_at < now() - interval '13 months'`);
    await db.query(`DELETE FROM visitors v WHERE last_seen < now() - interval '13 months' AND NOT EXISTS (SELECT 1 FROM visits x WHERE x.visitor_id = v.id)`);
  }

  return { ready, channel: ready ? channel : 'off', sendCart, sendReorder, sendReviewRequest, sweep, prune };
}
