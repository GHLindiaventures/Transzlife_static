// Order update messages to customers through Twilio (SMS or WhatsApp) and optional email (Resend).
//   ORDER_NOTIFICATIONS=off | sms | whatsapp   (default off)
//   SITE_URL=https://www.tranzlife.in          for the "track your order" link
//   RESEND_API_KEY / EMAIL_FROM                optional transactional email alerts
// Messages go out after the database change is saved, never block the request, and are logged in
// the notifications table (one per order + event, so nothing is sent twice).

const EVENTS = ['confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'cancelled'];
const rupees = (p) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export function createNotifier({ db, twilio, env, log }) {
  const channel = String(env.ORDER_NOTIFICATIONS || 'off').toLowerCase();
  const site = String(env.SITE_URL || '').replace(/\/$/, '');
  const ready = (channel === 'sms' && twilio?.smsReady) || (channel === 'whatsapp' && twilio?.whatsappReady);
  const emailReady = !!(env.RESEND_API_KEY && env.EMAIL_FROM);
  if (channel !== 'off' && !ready) log.warn?.(`[notify] ORDER_NOTIFICATIONS=${channel} but Twilio ${channel} is not configured; order messages are off`);

  function message(event, o, name, extra) {
    const first = (name || '').split(' ')[0];
    const trk = o.tracking_id || o.order_number;
    const track = site ? ` Track: ${site}/track/${trk}` : '';
    const edd = o.estimated_delivery_at ? ` Expected delivery: ${fmtDate(o.estimated_delivery_at)}.` : '';
    const courier = o.courier_name ? ` via ${o.courier_name}${o.awb_number ? ` (AWB ${o.awb_number})` : ''}` : '';
    switch (event) {
      case 'confirmed': return `TranzLife: Thank you${first ? ` ${first}` : ''}! Your order ${o.order_number} for ${rupees(o.total)} is confirmed${o.payment_method === 'cod' ? ' (cash on delivery)' : ''}.${edd}${track}`;
      case 'processing': return `TranzLife: Good news${first ? ` ${first}` : ''}! We are preparing & packing your order ${o.order_number}.${track}`;
      case 'packed': return `TranzLife: Your order ${o.order_number} is packed and ready for dispatch.${edd}${track}`;
      case 'shipped': return `TranzLife: Your order ${o.order_number} has shipped${courier}.${extra ? ` ${extra}` : ''}${edd}${track}`;
      case 'in_transit': return `TranzLife: Your order ${o.order_number} is in transit${courier}.${edd}${track}`;
      case 'out_for_delivery': return `TranzLife: Your order ${o.order_number} is out for delivery today!${o.payment_method === 'cod' && o.payment_status !== 'paid' ? ` Please keep ${rupees(o.total)} ready.` : ''}${track}`;
      case 'delivered': return `TranzLife: Your order ${o.order_number} has been delivered. Thank you for choosing TranzLife!`;
      case 'delayed': return `TranzLife: Update on order ${o.order_number} — delivery is slightly delayed${o.delay_reason ? ` (${o.delay_reason})` : ''}.${edd}${track}`;
      case 'cancelled': return `TranzLife: Your order ${o.order_number} has been cancelled.${o.payment_status === 'paid' || o.payment_status === 'refunded' ? ' Any amount paid will be refunded to your original payment method.' : ''} Questions? WhatsApp us on +91 91503 94443.`;
      default: return null;
    }
  }

  async function sendEmail(toEmail, subject, text) {
    if (!emailReady || !toEmail) return;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [toEmail], subject, text }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      log?.warn?.(`[notify] email failed: ${e.message}`);
    }
  }

  async function send(orderId, event, extra) {
    if ((!ready && !emailReady) || !EVENTS.includes(event)) return;
    const o = (await db.query(
      `SELECT o.id, o.order_number, o.tracking_id, o.total, o.payment_method, o.payment_status,
              o.phone, o.email, o.courier_name, o.awb_number, o.estimated_delivery_at, o.delay_reason, c.name
         FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, [orderId])).rows[0];
    if (!o) return;
    const body = message(event, o, o.name, extra);
    if (!body) return;

    if (emailReady && o.email) {
      await sendEmail(o.email, `TranzLife Order ${o.order_number} — ${event.replace(/_/g, ' ')}`, body);
    }

    if (!ready) return;
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
