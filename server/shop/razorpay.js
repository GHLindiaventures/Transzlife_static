// Razorpay: create payment orders and verify signatures. Card/UPI details never reach our server;
// customers pay in Razorpay's own checkout window.
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET   from Dashboard > Account & Settings > API keys
//   RAZORPAY_WEBHOOK_SECRET                 set when adding the webhook (Dashboard > Webhooks)
import { createHmac, timingSafeEqual } from 'node:crypto';

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createRazorpay(env) {
  const keyId = env.RAZORPAY_KEY_ID, keySecret = env.RAZORPAY_KEY_SECRET;
  const enabled = !!(keyId && keySecret);

  async function createOrder({ amount, receipt, notes }) {
    if (!enabled) throw Object.assign(new Error('Online payments are not available yet. Please choose Cash on delivery.'), { status: 400 });
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') },
      body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Razorpay: ${body?.error?.description || r.status}`), { status: 502 });
    return body;   // { id: 'order_…', amount, currency, … }
  }

  /** Refunds (part of) a captured payment. amount in paise. */
  async function refund(paymentId, { amount, notes }) {
    if (!enabled) throw Object.assign(new Error('Razorpay is not configured.'), { status: 400 });
    const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') },
      body: JSON.stringify({ amount, notes, speed: 'normal' }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Razorpay refund failed: ${body?.error?.description || r.status}`), { status: 502 });
    return body;   // { id: 'rfnd_…', status: 'processed' | 'pending', amount, … }
  }

  /** Signature sent to the browser after a successful payment. */
  const verifyPayment = ({ orderId, paymentId, signature }) =>
    enabled && safeEqual(createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature);

  /** Signature on webhook calls (over the exact raw body). */
  const verifyWebhook = (rawBody, signature) =>
    !!env.RAZORPAY_WEBHOOK_SECRET && !!signature &&
    safeEqual(createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature);

  return { enabled, keyId: enabled ? keyId : null, createOrder, refund, verifyPayment, verifyWebhook };
}
