// Day-to-day operations by SMS / WhatsApp (Twilio, same channel as order updates: ORDER_NOTIFICATIONS).
//
// Cash-on-delivery confirmation (Settings: cod_confirmation)
//   - after a COD order: "Reply YES to confirm or NO to cancel" (an order message, not marketing)
//   - POST /api/webhooks/twilio/sms (Twilio "A message comes in" webhook, signature checked):
//       YES -> confirmed; NO -> cancel_requested (staff cancel it: that releases stock and is audited)
//   - no reply within 24 h -> no_reply: shows in "Needs your attention" so staff can call
//   - staff can record a phone confirmation in the dashboard
// Daily summary (Settings: daily_summary { enabled, phones, hour }): yesterday's orders and revenue and
// today's to-dos, sent once a day at the chosen hour (India time) to the listed numbers.
// NOTE (India): business SMS needs DLT-registered templates; WhatsApp needs approved templates.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadSettings } from './pricing.js';

const rupees = (p) => '₹' + Math.round(p / 100).toLocaleString('en-IN');
const IST = `'Asia/Kolkata'`;
const YES = /^\s*(yes|y|ok|okay|confirm(ed)?|haan|ha|sari|aamaa?|1)\b/i;
const NO = /^\s*(no|n|cancel|nahi|venda|vendaam|2)\b/i;
const istHour = () => Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })) % 24;
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Twilio's request signature: base64(HMAC-SHA1(auth token, full URL + sorted key/value pairs)). */
export function twilioSignature(authToken, url, params) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}

export function createOps({ db, twilio, env, log }) {
  const channel = String(env.ORDER_NOTIFICATIONS || 'off').toLowerCase();
  const ready = (channel === 'sms' && twilio?.smsReady) || (channel === 'whatsapp' && twilio?.whatsappReady);
  const send = (to, body) => (channel === 'whatsapp' ? twilio.sendWhatsApp(to, body) : twilio.sendSms(to, body));

  async function logMessage(orderId, event, to, body, fn) {
    const claim = await db.query(`INSERT INTO notifications (order_id, event, channel, to_phone, body, status) VALUES ($1,$2,$3,$4,$5,'sending')
                                  ON CONFLICT (order_id, event, channel) DO NOTHING RETURNING id`, [orderId, event, channel, to, body]);
    const id = claim.rows[0]?.id;
    if (!id) return false;
    try {
      const r = await fn();
      await db.query(`UPDATE notifications SET status = 'sent', provider_id = $2, sent_at = now() WHERE id = $1`, [id, r?.sid || null]);
      return true;
    } catch (e) {
      await db.query(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, String(e.message).slice(0, 300)]);
      log?.warn?.(`[ops] ${event} for order ${orderId} failed: ${e.message}`);
      return false;
    }
  }

  /** After a cash-on-delivery order is placed (only when switched on in Settings). */
  async function requestCodConfirmation(orderId) {
    if (!ready) return false;
    const s = await loadSettings(db.query);
    if (!s.cod_confirmation) return false;
    const o = (await db.query(`SELECT id, order_number, total, phone, payment_method, status, cod_confirmation FROM orders WHERE id = $1`, [orderId])).rows[0];
    if (!o || o.payment_method !== 'cod' || o.status !== 'confirmed' || o.cod_confirmation) return false;
    const body = `TranzLife: Please confirm your cash-on-delivery order ${o.order_number} for ${rupees(o.total)}. Reply YES to confirm or NO to cancel.`;
    await db.query(`UPDATE orders SET cod_confirmation = 'pending', cod_requested_at = now() WHERE id = $1`, [o.id]);
    return logMessage(o.id, 'cod_confirm', o.phone, body, () => send(o.phone, body));
  }

  /** A text from a customer. Returns the reply to send back (or null). */
  async function handleReply(from, text) {
    const phone = String(from || '').replace(/^whatsapp:/, '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return null;
    const o = (await db.query(`
      SELECT o.id, o.order_number, o.status FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.cod_confirmation = 'pending' AND (o.phone = $1 OR c.phone = $1) AND o.created_at > now() - interval '3 days'
       ORDER BY o.created_at DESC LIMIT 1`, [phone])).rows[0];
    if (!o) return null;
    const addEvent = (note) => db.query(`INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$2,$3,'customer')`, [o.id, o.status, note]);
    if (YES.test(text)) {
      await db.query(`UPDATE orders SET cod_confirmation = 'confirmed', cod_confirmed_at = now(), cod_confirmed_by = 'customer' WHERE id = $1`, [o.id]);
      await addEvent('Customer confirmed the cash-on-delivery order by message');
      return `Thank you! Order ${o.order_number} is confirmed. We'll message you when it ships.`;
    }
    if (NO.test(text)) {
      await db.query(`UPDATE orders SET cod_confirmation = 'cancel_requested', cod_confirmed_at = now(), cod_confirmed_by = 'customer' WHERE id = $1`, [o.id]);
      await addEvent('Customer replied NO: asked to cancel the cash-on-delivery order');
      return `Okay, we've noted that you want to cancel order ${o.order_number}. Our team will cancel it shortly.`;
    }
    return 'Please reply YES to confirm your order or NO to cancel it.';
  }

  async function dailySummaryText() {
    const y = (await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0)::bigint AS revenue FROM orders
       WHERE status NOT IN ('pending_payment', 'cancelled')
         AND created_at >= (date_trunc('day', now() AT TIME ZONE ${IST}) - interval '1 day') AT TIME ZONE ${IST}
         AND created_at < date_trunc('day', now() AT TIME ZONE ${IST}) AT TIME ZONE ${IST}`)).rows[0];
    const w = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'confirmed') AS to_pack, COUNT(*) FILTER (WHERE status = 'packed') AS to_ship,
             COUNT(*) FILTER (WHERE cod_confirmation IN ('no_reply', 'cancel_requested') AND status = 'confirmed') AS cod_calls
        FROM orders`)).rows[0];
    const reviews = Number((await db.query(`SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'`)).rows[0].n);
    const runout = await stockRunout();
    const parts = [`TranzLife yesterday: ${Number(y.orders)} order${Number(y.orders) === 1 ? '' : 's'}, ${rupees(Number(y.revenue))}.`,
      `Today: ${Number(w.to_pack)} to pack, ${Number(w.to_ship)} to ship`];
    if (Number(w.cod_calls)) parts.push(`, ${w.cod_calls} COD to call`);
    if (reviews) parts.push(`, ${reviews} review${reviews === 1 ? '' : 's'} to check`);
    parts.push('.');
    if (runout.length) parts.push(` Stock: ${runout.slice(0, 2).map((r) => `${r.name.replace(/^TranzLife\s+/i, '')} ~${r.days}d`).join(', ')}.`);
    return parts.join('');
  }

  /** Products that will run out soon at the last 30 days' pace: [{ id, name, available, days }]. */
  async function stockRunout(limitDays) {
    const days = limitDays ?? Number((await loadSettings(db.query)).stock_alert_days || 14);
    const rows = (await db.query(`
      SELECT p.id, p.name, i.on_hand - i.reserved AS available,
             COALESCE((SELECT SUM(oi.pack * oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                        WHERE oi.product_id = p.id AND o.status NOT IN ('pending_payment', 'cancelled') AND o.created_at > now() - interval '30 days'), 0) AS sold30
        FROM products p JOIN inventory i ON i.product_id = p.id WHERE p.active`)).rows;
    return rows.map((r) => ({ id: r.id, name: r.name, available: Number(r.available), perDay: Number(r.sold30) / 30 }))
      .filter((r) => r.perDay > 0 && r.available > 0)
      .map((r) => ({ ...r, days: Math.floor(r.available / r.perDay) }))
      .filter((r) => r.days <= days)
      .sort((a, b) => a.days - b.days);
  }

  /** Every few minutes: COD orders with no reply for 24 h, and the daily summary at its hour. */
  async function sweep() {
    await db.query(`UPDATE orders SET cod_confirmation = 'no_reply' WHERE cod_confirmation = 'pending' AND cod_requested_at < now() - interval '24 hours'`);
    if (!ready) return;
    const s = await loadSettings(db.query);
    const ds = s.daily_summary || {};
    if (!ds.enabled || !ds.phones?.length || istHour() < Number(ds.hour ?? 9) || s.daily_summary_last?.date === istDate()) return;
    // claim today's slot first, so two servers (or a slow send) never send it twice
    const claim = await db.query(`INSERT INTO settings (key, value) VALUES ('daily_summary_last', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                                  WHERE settings.value IS DISTINCT FROM EXCLUDED.value RETURNING key`, [JSON.stringify({ date: istDate() })]);
    if (!claim.rows.length) return;
    const text = await dailySummaryText();
    for (const to of ds.phones) await send(to, text).catch((e) => log?.warn?.(`[ops] daily summary to ${to.slice(-4)} failed: ${e.message}`));
  }

  /** Checks Twilio's signature on an incoming webhook. */
  function verify(url, params, signature) {
    const token = env.TWILIO_AUTH_TOKEN;
    if (!token || !signature) return false;
    const a = Buffer.from(twilioSignature(token, url, params)), b = Buffer.from(String(signature));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  return { ready, channel: ready ? channel : 'off', requestCodConfirmation, handleReply, dailySummaryText, stockRunout, sweep, verify };
}

const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

/** Twilio "A message comes in" webhook (form-encoded). Set it in Twilio to SITE_URL + /api/webhooks/twilio/sms */
export default async function opsWebhooks(app, { ops, env, log }) {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => {
    try { done(null, Object.fromEntries(new URLSearchParams(body))); } catch (e) { e.statusCode = 400; done(e); }
  });
  app.post('/api/webhooks/twilio/sms', { config: { skipOriginCheck: true, rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const site = String(env.SITE_URL || '').replace(/\/$/, '');
    const url = `${site}/api/webhooks/twilio/sms`;
    const params = req.body && typeof req.body === 'object' ? req.body : {};
    if (!site || !ops.verify(url, params, req.headers['x-twilio-signature'])) {
      log?.warn?.('[ops] rejected a Twilio webhook with a bad or missing signature');
      return reply.code(403).send('Forbidden');
    }
    const answer = await ops.handleReply(params.From, String(params.Body || ''));
    reply.header('Content-Type', 'text/xml; charset=utf-8');
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${answer ? `<Message>${xml(answer)}</Message>` : ''}</Response>`;
  });
}
