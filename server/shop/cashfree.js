// Cashfree PG API v3: create payment orders, verify payment status, verify webhooks, and issue refunds.
//   CASHFREE_APP_ID / CASHFREE_SECRET_KEY   from Cashfree Dashboard > Developers > API Keys
//   CASHFREE_WEBHOOK_SECRET                 optional (defaults to CASHFREE_SECRET_KEY)
//   CASHFREE_ENV                            'production' | 'sandbox' (defaults to sandbox unless production)
import { createHmac, timingSafeEqual } from 'node:crypto';

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export function createCashfree(env = process.env) {
  const appId = env.CASHFREE_APP_ID;
  const secretKey = env.CASHFREE_SECRET_KEY;
  const enabled = !!(appId && secretKey);
  const mode = env.CASHFREE_ENV === 'production' || (env.NODE_ENV === 'production' && env.CASHFREE_ENV !== 'sandbox')
    ? 'production'
    : 'sandbox';
  const baseUrl = mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  const headers = () => ({
    'Content-Type': 'application/json',
    'x-api-version': '2023-08-01',
    'x-client-id': appId,
    'x-client-secret': secretKey,
  });

  async function createOrder({ amount, orderNumber, customer, returnUrl }) {
    if (!enabled) throw Object.assign(new Error('Cashfree is not configured.'), { status: 400 });
    const orderId = `${orderNumber}-${Date.now().toString(36)}`;
    const r = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number((amount / 100).toFixed(2)),
        order_currency: 'INR',
        customer_details: {
          customer_id: String(customer?.id || orderNumber),
          customer_name: customer?.name || 'Customer',
          customer_phone: String(customer?.phone || '9999999999').replace(/\D/g, '').slice(-10),
          ...(customer?.email ? { customer_email: customer.email } : {}),
        },
        ...(returnUrl ? { order_meta: { return_url: returnUrl } } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Cashfree: ${body?.message || r.status}`), { status: 502 });
    return {
      orderId: body.order_id || orderId,
      cfOrderId: body.cf_order_id,
      paymentSessionId: body.payment_session_id,
      mode,
    };
  }

  /** Verifies a Cashfree order server-side by checking its payments list. */
  async function verifyPayment(orderId) {
    if (!enabled || !orderId) return { paid: false };
    const r = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'GET',
      headers: headers(),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { paid: false };
    const list = await r.json().catch(() => []);
    const paid = (Array.isArray(list) ? list : []).find((p) => p.payment_status === 'SUCCESS');
    if (!paid) return { paid: false };
    return {
      paid: true,
      paymentId: String(paid.cf_payment_id || ''),
      method: paid.payment_group || null,
      raw: paid,
    };
  }

  /** Verifies Cashfree webhook HMAC-SHA256 signature (`timestamp + rawBody`). */
  function verifyWebhook(rawBody, signature, timestamp) {
    const secret = env.CASHFREE_WEBHOOK_SECRET || secretKey;
    if (!secret || !signature || !timestamp) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
    return safeEqual(expected, signature);
  }

  /** Issues a full or partial refund for a Cashfree order (amount in paise). */
  async function refund(orderId, { amount, refundId, reason }) {
    if (!enabled) throw Object.assign(new Error('Cashfree is not configured.'), { status: 400 });
    const id = refundId || `rfnd_${Date.now().toString(36)}`;
    const r = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/refunds`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        refund_amount: Number((amount / 100).toFixed(2)),
        refund_id: id,
        refund_note: String(reason || 'Order refund').slice(0, 100),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Cashfree refund failed: ${body?.message || r.status}`), { status: 502 });
    return {
      id: body.cf_refund_id || id,
      status: body.refund_status === 'SUCCESS' ? 'processed' : 'pending',
      raw: body,
    };
  }

  return { enabled, mode, createOrder, verifyPayment, verifyWebhook, refund };
}
