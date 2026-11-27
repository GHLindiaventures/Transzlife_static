// Order update messages to customers through Twilio (SMS or WhatsApp) and optional email (Resend).
//   ORDER_NOTIFICATIONS=off | sms | whatsapp   (default off)
//   SITE_URL=https://www.tranzlife.in          for the "track your order" link
//   RESEND_API_KEY / EMAIL_FROM                optional transactional email alerts
// Messages go out after the database change is saved, never block the request, and are logged in
// the notifications table (one per order + event, so nothing is sent twice).

const EVENTS = [
  'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'in_transit',
  'out_for_delivery', 'delivered', 'delayed', 'delivery_failed', 'rto', 'shipment_failed',
  'refund_initiated', 'refunded', 'cancelled',
];
const ADMIN_EVENTS = [
  'new_order', 'payment_confirmed', 'payment_failed',
  'pending_confirmation', 'shipment_update', 'delivery_update',
];
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
      case 'packed': return `TranzLife: Your order ${o.order_number} is packed and sealed.${edd}${track}`;
      case 'ready_for_pickup': return `TranzLife: Your order ${o.order_number} is ready for courier pickup${courier}.${edd}${track}`;
      case 'shipped': return `TranzLife: Your order ${o.order_number} has shipped${courier}.${extra ? ` ${extra}` : ''}${edd}${track}`;
      case 'in_transit': return `TranzLife: Your order ${o.order_number} is in transit${courier}.${edd}${track}`;
      case 'out_for_delivery': return `TranzLife: Your order ${o.order_number} is out for delivery today!${o.payment_method === 'cod' && o.payment_status !== 'paid' ? ` Please keep ${rupees(o.total)} ready.` : ''}${track}`;
      case 'delivered': return `TranzLife: Your order ${o.order_number} has been delivered. Thank you for choosing TranzLife!`;
      case 'delayed': return `TranzLife: Update on order ${o.order_number} — delivery is slightly delayed${o.delay_reason ? ` (${o.delay_reason})` : ''}.${edd}${track}`;
      case 'delivery_failed': return `TranzLife: Delivery attempt failed for order ${o.order_number}. The courier will reattempt or contact you shortly.${track}`;
      case 'rto': return `TranzLife: Order ${o.order_number} is being returned to our warehouse (RTO). Our team will reach out to assist you.`;
      case 'refund_initiated': return `TranzLife: Refund has been initiated for order ${o.order_number}. It will reflect in 5-7 working days.`;
      case 'refunded': return `TranzLife: Refund for order ${o.order_number} has been completed.`;
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

  async function loadNotificationConfig() {
    try {
      const r = await db.query("SELECT value FROM settings WHERE key = 'notification_config'");
      return r.rows[0]?.value || {};
    } catch {
      return {};
    }
  }

  function applyTemplate(tpl, o, extra) {
    const trk = o.tracking_id || o.order_number;
    const track = site ? `${site}/track/${trk}` : '';
    const map = {
      order_number: o.order_number || '',
      tracking_id: trk || '',
      customer_name: o.name || '',
      total: rupees(o.total || 0),
      tracking_url: track,
      courier: o.courier_name || '',
      awb: o.awb_number || '',
      edd: fmtDate(o.estimated_delivery_at),
      extra: extra || '',
    };
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`)).trim();
  }

  async function send(orderId, event, extra) {
    if (!EVENTS.includes(event)) return;
    const cfg = await loadNotificationConfig();
    if (cfg.customerEvents?.[event] === false) return;

    const emailOn = emailReady && cfg.channels?.email !== false;
    const smsOn = Boolean(twilio?.smsReady && (cfg.channels?.sms ?? (channel === 'sms')));
    const waOn = Boolean(twilio?.whatsappReady && (cfg.channels?.whatsapp ?? (channel === 'whatsapp')));
    if (!emailOn && !smsOn && !waOn) return;

    const o = (await db.query(
      `SELECT o.id, o.order_number, o.tracking_id, o.total, o.payment_method, o.payment_status,
              o.phone, o.email, o.courier_name, o.awb_number, o.estimated_delivery_at, o.delay_reason, c.name
         FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, [orderId])).rows[0];
    if (!o) return;
    const customTpl = cfg.templates?.[event];
    const body = (typeof customTpl === 'string' && customTpl.trim())
      ? applyTemplate(customTpl, o, extra)
      : message(event, o, o.name, extra);
    if (!body) return;

    if (emailOn && o.email) {
      await sendEmail(o.email, `TranzLife Order ${o.order_number} — ${event.replace(/_/g, ' ')}`, body);
    }

    const activeChannels = [];
    if (smsOn) activeChannels.push('sms');
    if (waOn) activeChannels.push('whatsapp');
    for (const ch of activeChannels) {
      const claim = await db.query(
        `INSERT INTO notifications (order_id, event, channel, to_phone, body, status) VALUES ($1,$2,$3,$4,$5,'sending')
         ON CONFLICT (order_id, event, channel) DO NOTHING RETURNING id`, [o.id, event, ch, o.phone, body]);
      const id = claim.rows[0]?.id;
      if (!id) continue;                                 // already sent for this event & channel
      try {
        const r = ch === 'whatsapp' ? await twilio.sendWhatsApp(o.phone, body) : await twilio.sendSms(o.phone, body);
        await db.query(`UPDATE notifications SET status = 'sent', provider_id = $2, sent_at = now() WHERE id = $1`, [id, r.sid || null]);
      } catch (e) {
        await db.query(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, `${e.twilioCode ? `[${e.twilioCode}] ` : ''}${e.message}`.slice(0, 300)]);
        log.warn?.(`[notify] ${event} ${ch} for ${o.order_number} failed: ${e.message}`);
      }
    }
  }

  async function sendAdmin(event, data = {}) {
    if (!ADMIN_EVENTS.includes(event)) return;
    const cfg = await loadNotificationConfig();
    if (cfg.adminEvents?.[event] === false) return;
    const emails = Array.isArray(cfg.adminRecipients?.emails) ? cfg.adminRecipients.emails.filter(Boolean) : [];
    const phones = Array.isArray(cfg.adminRecipients?.phones) ? cfg.adminRecipients.phones.filter(Boolean) : [];
    if (!emails.length && !phones.length) return;

    const amt = data.total != null ? ` (${rupees(data.total)})` : '';
    const ref = data.orderNumber || data.providerOrderId || 'Order';
    const subjects = {
      new_order: `New Order ${ref}${amt}`,
      payment_confirmed: `Payment Confirmed: ${ref}${amt}`,
      payment_failed: `Payment Failed: ${ref}`,
      pending_confirmation: `Pending Payment / Confirmation: ${ref}${amt}`,
      shipment_update: `Shipment Update: ${ref} → ${data.status || ''}`,
      delivery_update: `Delivery Update: ${ref} → ${data.status || ''}`,
    };
    const subject = `[TranzLife Admin] ${subjects[event] || event}`;
    const details = [
      data.customerName ? `Customer: ${data.customerName}` : '',
      data.paymentMethod ? `Method: ${String(data.paymentMethod).toUpperCase()}` : '',
      data.status ? `Status: ${data.status}` : '',
      data.courier ? `Courier: ${data.courier}` : '',
      data.awb ? `AWB: ${data.awb}` : '',
      data.reason ? `Reason: ${data.reason}` : '',
    ].filter(Boolean).join(' · ');
    const text = `${subjects[event] || event}${details ? `\n${details}` : ''}`;

    if (emailReady && cfg.channels?.email !== false) {
      for (const to of emails) await sendEmail(to, subject, text);
    }
    const smsAdmin = Boolean(twilio?.smsReady && cfg.channels?.sms === true);
    const waAdmin = Boolean(twilio?.whatsappReady && cfg.channels?.whatsapp !== false);
    for (const phone of phones) {
      if (waAdmin) await twilio.sendWhatsApp(phone, text).catch((e) => log.warn?.(`[notifyAdmin] wa failed: ${e.message}`));
      else if (smsAdmin) await twilio.sendSms(phone, text).catch((e) => log.warn?.(`[notifyAdmin] sms failed: ${e.message}`));
    }
  }

  /** Fire and forget: never delays or fails the request that triggered it. */
  const notify = (orderId, event, extra) => { send(orderId, event, extra).catch((e) => log.error?.(`[notify] ${e.message}`)); };
  const notifyAdmin = (event, data) => { sendAdmin(event, data).catch((e) => log.error?.(`[notifyAdmin] ${e.message}`)); };

  return { notify, notifyAdmin, send, sendAdmin, channel: ready ? channel : 'off' };
}
