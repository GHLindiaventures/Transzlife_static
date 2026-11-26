import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trash2, Lock, ShieldCheck, Truck, CheckCircle2, ArrowLeft, Smartphone, CreditCard, Landmark, Banknote, Clock, XCircle, MapPin, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { QtyStepper, FreeShipBar } from '../components/CartDrawer';
import { Breadcrumbs, useTitle } from '../components/Common';
import { SITE } from '../data/site';
import { inr } from '../utils/format';
import { getProduct } from '../data/products';
import ReturnSection from '../components/ReturnSection';
import { useAuth } from '../context/AuthContext';
import { api, newIdempotencyKey } from '../lib/api';
import { getBuyNow, clearBuyNow } from '../lib/checkoutIntent';
import { track, trackIds } from '../lib/track';
import '../styles/account.css';

function Summary({ compact, extra }) {
  const { detailed, subtotal, savings, shipping } = useCart();
  return (
    <div className="summary">
      <h2>Order summary</h2>
      {compact && (
        <ul className="summary__lines">
          {detailed.map((l) => (
            <li key={l.key}>
              <span className="summary__thumb" style={{ background: l.product.tint }}><img src={l.product.images[0]} alt="" /><b>{l.qty}</b></span>
              <span><strong>{l.product.short}</strong><small>{l.product.size}{l.pack > 1 ? ` · Pack of ${l.pack}` : ''}</small></span>
              <span>{inr(l.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl>
        <div><dt>Subtotal</dt><dd>{inr(subtotal)}</dd></div>
        {savings > 0 && <div className="summary__save"><dt>You save (vs MRP)</dt><dd>{inr(savings)}</dd></div>}
        <div><dt>Shipping</dt><dd>{shipping ? inr(shipping) : 'Free'}</dd></div>
        {extra}
      </dl>
    </div>
  );
}

export function Cart() {
  useTitle('Your cart');
  const { detailed, count, setQty, remove, subtotal, shipping, toFree } = useCart();
  const navigate = useNavigate();
  if (!count) {
    return (
      <section className="container empty-page">
        <h1>Your cart is empty</h1>
        <p>Find something that helps you feel a little better every day.</p>
        <Link to="/shop" className="btn btn--lg">Shop products</Link>
      </section>
    );
  }
  return (
    <section className="container cart-page">
      <Breadcrumbs items={[['Cart']]} />
      <h1>Your cart</h1>
      <div className="cart-page__grid">
        <div>
          <FreeShipBar toFree={toFree} subtotal={subtotal} />
          <ul className="cart-table">
            {detailed.map((l) => (
              <li key={l.key}>
                <Link to={`/products/${l.id}`} className="cart__thumb cart__thumb--lg" style={{ background: l.product.tint }}><img src={l.product.images[0]} alt="" /></Link>
                <div className="cart-table__info">
                  <Link to={`/products/${l.id}`}><strong>{l.product.name}</strong></Link>
                  <small>{l.product.size}{l.pack > 1 ? ` · Pack of ${l.pack}` : ''} · {inr(l.unit)} each</small>
                  <QtyStepper small value={l.qty} onChange={(q) => setQty(l.key, q)} />
                </div>
                <div className="cart-table__price">
                  <strong>{inr(l.total)}</strong>
                  {l.mrpTotal > l.total && <s>{inr(l.mrpTotal)}</s>}
                  <button className="link-btn" onClick={() => remove(l.key)}><Trash2 size={14} /> Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/shop" className="link-arrow"><ArrowLeft size={16} /> Continue shopping</Link>
        </div>
        <aside>
          <Summary extra={<div className="summary__total"><dt>Total</dt><dd>{inr(subtotal + shipping)}</dd></div>} />
          <button className="btn btn--lg btn--block" onClick={() => navigate('/checkout')}><Lock size={16} /> Proceed to checkout</button>
          <p className="summary__note">Pay prepaid and get an extra 5% off at checkout.</p>
        </aside>
      </div>
    </section>
  );
}


// [id, label, sub-label, icon, prepaid]
const PAY = [
  ['upi', 'UPI', 'GPay, PhonePe, Paytm & more', Smartphone, true],
  ['card', 'Credit / Debit card', 'Visa, Mastercard, RuPay', CreditCard, true],
  ['netbanking', 'Net banking', 'All major Indian banks', Landmark, true],
  ['cod', 'Cash on delivery', 'Pay when it arrives', Banknote, false],
];

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other'];

const rs = (paise) => inr(Math.round(paise / 100));

/** Loads Razorpay's checkout script once. */
let razorpayScript;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  razorpayScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { razorpayScript = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return razorpayScript;
}

/** Opens Razorpay; resolves with its success response, or null if the customer closed it. */
async function payWithRazorpay(payment, method, orderNumber) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: payment.keyId,
      order_id: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      name: SITE.name,
      description: `Order ${orderNumber}`,
      prefill: { ...payment.prefill, method },
      theme: { color: '#24502a' },
      handler: resolve,
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    rz.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed. Please try again.')));
    rz.open();
  });
}

function CheckoutSummary({ quote }) {
  if (!quote) return <div className="summary"><h2>Order summary</h2><p className="auth-sub">Calculating…</p></div>;
  return (
    <div className="summary">
      <h2>Order summary</h2>
      <ul className="summary__lines">
        {quote.lines.map((l) => {
          const p = getProduct(l.id);
          return (
            <li key={`${l.id}:${l.pack}`}>
              <span className="summary__thumb" style={{ background: p?.tint }}>{p && <img src={p.images[0]} alt="" />}<b>{l.qty}</b></span>
              <span><strong>{p?.short || l.name}</strong><small>{l.size}{l.pack > 1 ? ` · Pack of ${l.pack}` : ''}</small></span>
              <span>{rs(l.total)}</span>
            </li>
          );
        })}
      </ul>
      <dl>
        <div><dt>Subtotal</dt><dd>{rs(quote.subtotal)}</dd></div>
        {quote.savings > 0 && <div className="summary__save"><dt>You save (vs MRP)</dt><dd>{rs(quote.savings)}</dd></div>}
        <div><dt>Shipping</dt><dd>{quote.shipping ? rs(quote.shipping) : 'Free'}</dd></div>
        {quote.discount > 0 && <div className="summary__save"><dt>Prepaid discount ({quote.prepaidDiscountPct}%)</dt><dd>−{rs(quote.discount)}</dd></div>}
        <div className="summary__total"><dt>Total to pay</dt><dd>{rs(quote.total)}</dd></div>
      </dl>
    </div>
  );
}

/**
 * Secure checkout (signed-in customers only; see RequireAuth).
 *   /checkout          -> everything in the cart
 *   /checkout?buy=now  -> just the "Buy now" item (the cart is left as it is)
 * Totals shown here come from the server, and the server recalculates them when the order is placed.
 */
export function Checkout() {
  useTitle('Checkout');
  const cart = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const buyNowMode = new URLSearchParams(location.search).get('buy') === 'now';
  const buyNow = useMemo(() => (buyNowMode ? getBuyNow() : null), [buyNowMode]);

  const items = useMemo(
    () => (buyNow ? [buyNow] : cart.lines.map(({ id, pack, qty }) => ({ id, pack, qty }))),
    [buyNow, cart.lines]);
  const itemsKey = JSON.stringify(items);

  const [config, setConfig] = useState(null);
  const [pay, setPay] = useState(null);
  const [quote, setQuote] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [addrId, setAddrId] = useState('new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);     // { order, payment } when payment was interrupted
  const idemKey = useRef(newIdempotencyKey());

  // funnel: reached checkout (once per visit to this page)
  useEffect(() => { if (items.length) track('begin_checkout', { items: items.length, buyNow: !!buyNow }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // available payment methods + saved addresses
  useEffect(() => {
    api('/api/shop/config').then((c) => { setConfig(c); setPay((p) => p ?? (c.razorpay ? 'upi' : 'cod')); })
      .catch(() => { setConfig({ methods: ['cod'] }); setPay('cod'); });
    api('/api/account/addresses').then((r) => {
      setAddresses(r.addresses);
      if (r.addresses.length) setAddrId(r.addresses[0].id);
    }).catch(() => setAddresses([]));
  }, []);

  // server quote whenever the items or payment method change
  useEffect(() => {
    if (!items.length || !pay) return undefined;
    const ctl = new AbortController();
    api('/api/checkout/quote', { method: 'POST', body: { items, paymentMethod: pay }, signal: ctl.signal })
      .then((q) => { setQuote(q); setError(q.outOfStock.length ? `Sorry, not enough stock for: ${q.outOfStock.join(', ')}.` : ''); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, pay]);

  const finish = useCallback((order) => {
    if (buyNow) clearBuyNow(); else cart.clear();
    navigate(`/order/${order.number}`, { replace: true });
  }, [buyNow, cart, navigate]);

  const runPayment = useCallback(async (order, payment) => {
    try {
      const result = await payWithRazorpay(payment, order.paymentMethod, order.number);
      if (!result) { track('payment_failed', { method: order.paymentMethod, reason: 'closed' }); setPending({ order, payment }); setBusy(false); return; }
      const v = await api('/api/checkout/verify', { method: 'POST', body: { orderNumber: order.number, ...result } });
      finish(v.order);
    } catch (e) {
      track('payment_failed', { method: order.paymentMethod, reason: 'error' });
      setError(e.message);
      setPending({ order, payment });
      setBusy(false);
    }
  }, [finish]);

  if (!items.length) {
    return (
      <section className="container empty-page">
        <h1>Nothing to check out yet</h1>
        <Link to="/shop" className="btn btn--lg">Shop products</Link>
      </section>
    );
  }

  const methods = config?.methods || [];
  const savedAddr = addresses?.find((a) => a.id === addrId);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const address = savedAddr
      ? { name: savedAddr.name, phone: savedAddr.phone, line1: savedAddr.line1, line2: savedAddr.line2 || '', city: savedAddr.city, state: savedAddr.state, pin: savedAddr.pin }
      : { name: form.name, phone: form.phone, line1: form.line1, line2: form.line2 || '', city: form.city, state: form.state, pin: form.pin };
    setBusy(true);
    track('place_order_click', { method: pay });
    try {
      const r = await api('/api/checkout/place', {
        method: 'POST',
        body: {
          items, paymentMethod: pay, address, email: form.email || '', saveAddress: !savedAddr, idempotencyKey: idemKey.current,
          ...(customer.marketingConsent ? {} : { marketingConsent: form.reminders === 'on' }),
          track: trackIds(),
        },
      });
      if (!r.payment) { finish(r.order); return; }          // cash on delivery
      await runPayment(r.order, r.payment);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      if (err.code === 'out_of_stock') idemKey.current = newIdempotencyKey();
    }
  };

  const retryPayment = async () => {
    setError('');
    setBusy(true);
    try {
      const r = await api(`/api/orders/${pending.order.number}/pay`, { method: 'POST', body: {} });
      setPending(null);
      await runPayment(r.order, r.payment);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="container checkout">
      {buyNow
        ? <button type="button" className="link-arrow link-btn" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
        : <Link to="/cart" className="link-arrow"><ArrowLeft size={16} /> Back to cart</Link>}
      <h1>Secure checkout</h1>
      {buyNow && <p className="auth-sub">Buying just this item. Your cart stays as it is.</p>}

      {pending && (
        <div className="pay-pending" role="status">
          <Clock size={20} />
          <div>
            <strong>Payment not completed</strong>
            <p>Order {pending.order.number} is saved and your items are held for 30 minutes. Complete the payment to confirm it.</p>
          </div>
          <button type="button" className="btn" onClick={retryPayment} disabled={busy}>{busy ? 'Opening…' : `Pay ${rs(pending.order.total)}`}</button>
        </div>
      )}

      <form className="checkout__grid" onSubmit={onSubmit}>
        <div className="checkout__main">
          <fieldset className="form" disabled={!!pending}>
            <legend><span className="step-n">1</span> Contact</legend>
            <p className="auth-signed">Signed in as <strong>{customer.name}</strong> · +91 {customer.phone}</p>
            <label>Email for order updates{customer.email ? '' : ' (optional)'}<input name="email" type="email" autoComplete="email" defaultValue={customer.email || ''} /></label>
            {!customer.marketingConsent && (
              <label className="check-opt"><input type="checkbox" name="reminders" /> <span>Remind me on WhatsApp / SMS when it's time to restock, or if I leave items in my cart. <small>Optional. Stop any time.</small></span></label>
            )}
          </fieldset>

          <fieldset className="form" disabled={!!pending}>
            <legend><span className="step-n">2</span> Delivery address</legend>
            {addresses?.length > 0 && (
              <div className="addr-list">
                {addresses.map((a) => (
                  <label key={a.id} className={`addr-opt ${addrId === a.id ? 'is-active' : ''}`}>
                    <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                    <MapPin size={18} strokeWidth={1.6} />
                    <span><strong>{a.name}</strong><small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pin} · {a.phone}</small></span>
                  </label>
                ))}
                <label className={`addr-opt ${addrId === 'new' ? 'is-active' : ''}`}>
                  <input type="radio" name="addr" checked={addrId === 'new'} onChange={() => setAddrId('new')} />
                  <Plus size={18} strokeWidth={1.6} />
                  <span><strong>Deliver to a new address</strong></span>
                </label>
              </div>
            )}
            {addrId === 'new' && (
              <>
                <div className="form__row">
                  <label>Full name<input name="name" required autoComplete="name" defaultValue={customer.name || ''} /></label>
                  <label>Mobile number<input name="phone" type="tel" required pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel-national" placeholder="10-digit mobile" defaultValue={customer.phone || ''} /></label>
                </div>
                <label>House / flat, street<input name="line1" required autoComplete="address-line1" /></label>
                <label>Area, landmark (optional)<input name="line2" autoComplete="address-line2" /></label>
                <div className="form__row form__row--3">
                  <label>City<input name="city" required autoComplete="address-level2" /></label>
                  <label>State
                    <select name="state" required defaultValue="Tamil Nadu" autoComplete="address-level1">
                      {STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>PIN code<input name="pin" required pattern="[1-9][0-9]{5}" title="6-digit PIN code" inputMode="numeric" autoComplete="postal-code" /></label>
                </div>
              </>
            )}
          </fieldset>

          <fieldset className="form" disabled={!!pending}>
            <legend><span className="step-n">3</span> Payment</legend>
            <div className="paygrid">
              {PAY.map(([id, label, sub, I, pre]) => {
                const off = !!config && !methods.includes(id);
                return (
                  <label key={id} className={`payopt ${pay === id ? 'is-active' : ''} ${off ? 'is-off' : ''}`}>
                    <input type="radio" name="pay" value={id} checked={pay === id} disabled={off} onChange={() => { setPay(id); track('checkout_payment', { method: id }); }} />
                    <I size={22} strokeWidth={1.6} />
                    <span><strong>{label}</strong><small>{off ? 'Coming soon' : sub}</small></span>
                    {pre && !off && quote?.prepaidDiscountPct > 0 && <em>{quote.prepaidDiscountPct}% off</em>}
                  </label>
                );
              })}
            </div>
            <p className="note"><Lock size={14} /> {pay === 'cod' ? 'Pay in cash when your order arrives.' : "You'll pay securely in Razorpay's payment window. We never see or store your card or UPI details."}</p>
          </fieldset>
        </div>

        <aside className="checkout__side">
          <CheckoutSummary quote={quote} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {!pending && (
            <button className="btn btn--lg btn--block" disabled={busy || !quote || !pay || quote.outOfStock.length > 0}>
              {busy ? (pay === 'cod' ? 'Placing order…' : 'Opening payment…') : quote ? `${pay === 'cod' ? 'Place order' : 'Pay'} · ${rs(quote.total)}` : 'Place order'}
            </button>
          )}
          <div className="checkout__trust">
            <span><ShieldCheck size={16} /> 100% secure payments</span>
            <span><Truck size={16} /> Ships in 1 to 2 days</span>
          </div>
          <p className="summary__note">By placing this order you agree to our <Link to="/policies/terms">terms</Link> and <Link to="/policies/shipping">return policy</Link>.</p>
        </aside>
      </form>
    </section>
  );
}

const STATUS_LABEL = {
  pending_payment: 'Awaiting payment', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
  returned: 'Returned', rto: 'Returned to us',
};
export const statusLabel = (s) => STATUS_LABEL[s] || s;
export const PAY_LABEL = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', cod: 'Cash on delivery' };
export { rs };

/** Order confirmation / order details (loaded from the server; only the owner can see it). */
export function OrderSuccess() {
  const { id } = useParams();
  const { customer } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  useTitle(order?.status === 'confirmed' ? 'Order confirmed' : 'Your order');

  useEffect(() => {
    api(`/api/orders/${encodeURIComponent(id)}`).then((r) => setOrder(r.order)).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <section className="container empty-page">
        <h1>Order not found</h1>
        <p>{error}</p>
        <Link to="/account" className="btn btn--lg">My orders</Link>
      </section>
    );
  }
  if (!order) return <div className="page-loading" aria-busy="true" />;

  const ok = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status);
  const Icon = ok ? CheckCircle2 : order.status === 'cancelled' ? XCircle : Clock;
  return (
    <section className="container success-page">
      <Icon size={56} strokeWidth={1.4} />
      <h1>{ok ? `Thank you, ${(customer?.name || '').split(' ')[0]}!` : statusLabel(order.status)}</h1>
      <p className="lead">Order <strong>#{order.number}</strong> · {statusLabel(order.status)}</p>
      <div className="success-card">
        <ul>
          {order.items.map((it) => <li key={it.id + it.pack}><span>{it.qty} × {it.name}{it.pack > 1 ? ` (pack of ${it.pack})` : ''}</span><span>{rs(it.total)}</span></li>)}
        </ul>
        {order.discount > 0 && <p className="success-card__total"><span>Prepaid discount</span><span>−{rs(order.discount)}</span></p>}
        <p className="success-card__total"><span>Shipping</span><span>{order.shipping ? rs(order.shipping) : 'Free'}</span></p>
        <p className="success-card__total"><span>Total</span><strong>{rs(order.total)}</strong></p>
        <p>Delivering to {order.address.name}, {order.address.line1}, {order.address.city} {order.address.pin}</p>
        <p>Payment: {PAY_LABEL[order.paymentMethod] || order.paymentMethod}{order.paymentStatus === 'paid' ? ' (paid)' : ''}</p>
      </div>
      {ok && <p>We'll share tracking details as soon as it ships. Questions? Message us on <a href={SITE.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>.</p>}
      {order.status === 'pending_payment' && <p>We haven't received the payment yet. If money was deducted, the order will be confirmed automatically within a few minutes.</p>}
      <ReturnSection order={order} />
      <div className="success-actions">
        <Link to="/account" className="btn btn--lg btn--ghost">My orders</Link>
        <Link to="/shop" className="btn btn--lg">Continue shopping</Link>
      </div>
    </section>
  );
}
