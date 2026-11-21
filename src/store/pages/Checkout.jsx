import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2, Lock, ShieldCheck, Truck, CheckCircle2, ArrowLeft, Smartphone, CreditCard, Landmark, Banknote } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { QtyStepper, FreeShipBar } from '../components/CartDrawer';
import { Breadcrumbs, useTitle } from '../components/Common';
import { SITE } from '../data/site';
import { inr } from '../utils/format';

const ORDERS_KEY = 'tranzlife.orders.v1';

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

const PAY = [
  ['upi', 'UPI', 'GPay, PhonePe, Paytm & more', Smartphone, true],
  ['card', 'Credit / Debit card', 'Visa, Mastercard, RuPay', CreditCard, true],
  ['netbanking', 'Net banking', 'All major Indian banks', Landmark, true],
  ['cod', 'Cash on delivery', 'Pay when it arrives', Banknote, false],
];

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other'];

export function Checkout() {
  useTitle('Checkout');
  const cart = useCart();
  const { detailed, count, subtotal, shipping, clear } = cart;
  const navigate = useNavigate();
  const [pay, setPay] = useState('upi');
  const [busy, setBusy] = useState(false);

  if (!count) {
    return (
      <section className="container empty-page">
        <h1>Nothing to check out yet</h1>
        <Link to="/shop" className="btn btn--lg">Shop products</Link>
      </section>
    );
  }

  const prepaid = PAY.find((p) => p[0] === pay)[4];
  const discount = prepaid ? Math.round(subtotal * SITE.prepaidDiscount) : 0;
  const total = subtotal - discount + shipping;

  const onSubmit = (e) => {
    e.preventDefault();
    setBusy(true);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const order = {
      id: 'TL' + Date.now().toString().slice(-8),
      date: new Date().toISOString(),
      customer: { name: form.name, phone: form.phone, email: form.email },
      address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, pin: form.pin },
      items: detailed.map((l) => ({ id: l.id, name: l.product.name, pack: l.pack, qty: l.qty, total: l.total })),
      subtotal, discount, shipping, total, payment: pay,
    };
    // Front-end demo: orders are kept in this browser only. Connect a payment
    // gateway (Razorpay / Cashfree) and an order API before going live.
    try {
      const prev = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...prev].slice(0, 20)));
    } catch { /* storage unavailable */ }
    setTimeout(() => {
      clear();
      navigate(`/order/${order.id}`, { state: order });
    }, 700);
  };

  return (
    <section className="container checkout">
      <Link to="/cart" className="link-arrow"><ArrowLeft size={16} /> Back to cart</Link>
      <h1>Secure checkout</h1>
      <form className="checkout__grid" onSubmit={onSubmit}>
        <div className="checkout__main">
          <fieldset className="form">
            <legend><span className="step-n">1</span> Contact</legend>
            <div className="form__row">
              <label>Full name<input name="name" required autoComplete="name" /></label>
              <label>Mobile number<input name="phone" type="tel" required pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel-national" placeholder="10-digit mobile" /></label>
            </div>
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          </fieldset>

          <fieldset className="form">
            <legend><span className="step-n">2</span> Delivery address</legend>
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
          </fieldset>

          <fieldset className="form">
            <legend><span className="step-n">3</span> Payment</legend>
            <div className="paygrid">
              {PAY.map(([id, label, sub, I, pre]) => (
                <label key={id} className={`payopt ${pay === id ? 'is-active' : ''}`}>
                  <input type="radio" name="pay" value={id} checked={pay === id} onChange={() => setPay(id)} />
                  <I size={22} strokeWidth={1.6} />
                  <span><strong>{label}</strong><small>{sub}</small></span>
                  {pre && <em>5% off</em>}
                </label>
              ))}
            </div>
            <p className="note"><Lock size={14} /> Payments will be processed securely by our payment partner. You will be redirected to complete payment.</p>
          </fieldset>
        </div>

        <aside className="checkout__side">
          <Summary
            compact
            extra={<>
              {discount > 0 && <div className="summary__save"><dt>Prepaid discount (5%)</dt><dd>−{inr(discount)}</dd></div>}
              <div className="summary__total"><dt>Total to pay</dt><dd>{inr(total)}</dd></div>
            </>}
          />
          <button className="btn btn--lg btn--block" disabled={busy}>{busy ? 'Placing order…' : `Place order · ${inr(total)}`}</button>
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

export function OrderSuccess() {
  const { id } = useParams();
  useTitle('Order confirmed');
  let order = null;
  try { order = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]').find((o) => o.id === id); } catch { /* ignore */ }
  return (
    <section className="container success-page">
      <CheckCircle2 size={56} strokeWidth={1.4} />
      <h1>Thank you{order ? `, ${order.customer.name.split(' ')[0]}` : ''}!</h1>
      <p className="lead">Your order <strong>#{id}</strong> has been placed.</p>
      {order && (
        <div className="success-card">
          <ul>
            {order.items.map((it) => <li key={it.id + it.pack}><span>{it.qty} × {it.name}{it.pack > 1 ? ` (pack of ${it.pack})` : ''}</span><span>{inr(it.total)}</span></li>)}
          </ul>
          <p className="success-card__total"><span>Total</span><strong>{inr(order.total)}</strong></p>
          <p>Delivering to {order.address.line1}, {order.address.city} {order.address.pin}</p>
          <p>Payment: {order.payment === 'cod' ? 'Cash on delivery' : order.payment.toUpperCase()}</p>
        </div>
      )}
      <p>Our team will confirm your order and share tracking details shortly. Questions? Message us on <a href={SITE.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>.</p>
      <Link to="/shop" className="btn btn--lg">Continue shopping</Link>
    </section>
  );
}
