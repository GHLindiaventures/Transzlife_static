// Order update messages to customers through Twilio (SMS or WhatsApp).
//   ORDER_NOTIFICATIONS=off | sms | whatsapp   (default off)
//   SITE_URL=https://www.tranzlife.in          for the "track your order" link
// Messages go out after the database change is saved, never block the request, and are logged in
// the notifications table (one per order + event, so nothing is sent twice).
// NOTE (India): business SMS to Indian numbers needs DLT-registered templates; WhatsApp needs
// approved templates for messages a customer did not start. See the setup notes in .env.example.

const EVENTS = ['confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const rupees = (p) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function createNotifier({ db, twilio, env, log }) {
  const channel = String(env.ORDER_NOTIFICATIONS || 'off').toLowerCase();
  const site = String(env.SITE_URL || '').replace(/\/$/, '');
  const ready = (channel === 'sms' && twilio?.smsReady) || (channel === 'whatsapp' && twilio?.whatsappReady);
  if (channel !== 'off' && !ready) log.warn?.(`[notify] ORDER_NOTIFICATIONS=${channel} but Twilio ${channel} is not configured; order messages are off`);

  function message(event, o, name, extra) {
    const first = (name || '').split(' ')[0];
    const track = site ? ` Track: ${site}/order/${o.order_number}` : '';
    switch (event) {
      case 'confirmed': return `TranzLife: Thank you${first ? ` ${first}` : ''}! Your order ${o.order_number} for ${rupees(o.total)} is confirmed${o.payment_method === 'cod' ? ' (cash on delivery)' : ''}. We'll message you when it ships.${track}`;
      case 'shipped': return `TranzLife: Your order ${o.order_number} has shipped.${extra ? ` ${extra}` : ''}${track}`;
      case 'out_for_delivery': return `TranzLife: Your order ${o.order_number} is out for delivery today.${o.payment_method === 'cod' && o.payment_status !== 'paid' ? ` Please keep ${rupees(o.total)} ready.` : ''}`;
      case 'delivered': return `TranzLife: Your order ${o.order_number} has been delivered. Thank you for choosing TranzLife!`;
      case 'cancelled': return `TranzLife: Your order ${o.order_number} has been cancelled.${o.payment_status === 'paid' || o.payment_status === 'refunded' ? ' Any amount paid will be refunded to your original payment method.' : ''} Questions? WhatsApp us on +91 91503 94443.`;
      default: return null;
    }
  }

  async function send(orderId, event, extra) {
    if (!ready || !EVENTS.includes(event)) return;
    const o = (await db.query(
      `SELECT o.id, o.order_number, o.total, o.payment_method, o.payment_status, o.phone, c.name
         FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, [orderId])).rows[0];
    if (!o) return;
    const body = message(event, o, o.name, extra);
    const claim = await db.query(
      `INSERT INTO notifications (order_id, event, channel, to_phone, body, status) VALUES ($1,$2,$3,$4,$5,'sending')
       ON CONFLICT (order_id, event, channel) DO NOTHING RETURNING id`, [o.id, event, channel, o.phone, body]);
    const id = claim.rows[0]?.id;
    if (!id) return;                                   // already sent for this event
    try {
      const r = channel === 'whatsapp' ? await twilio.sendWhatsApp(o.phone, body) : await twilio.sendSms(o.phone, body);
      await db.query(`UPDATE notifications SET status = 'sent', provider_id = $2, sent_at = now() WHERE id = $1`, [id, r.sid || null]);
    } catch (e) {
      await db.query(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, `${e.twilioCode ? `[${e.twilioCode}] ` : ''}${e.message}`.slice(0, 300)]);
      log.warn?.(`[notify] ${event} ${channel} for ${o.order_number} failed: ${e.message}`);
    }
  }

  /** Fire and forget: never delays or fails the request that triggered it. */
  const notify = (orderId, event, extra) => { send(orderId, event, extra).catch((e) => log.error?.(`[notify] ${e.message}`)); };

  return { notify, send, channel: ready ? channel : 'off' };
}
