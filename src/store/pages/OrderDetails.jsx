import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  CheckCircle2, Clock, XCircle, Undo2, Truck, Package, PackageCheck, ClipboardCheck, Navigation, MapPin, Phone,
  CreditCard, Banknote, Smartphone, Landmark, MessageCircle, RotateCcw, ChevronRight, Copy, Check, ShoppingBag, Receipt,
} from 'lucide-react';
import { Breadcrumbs, useTitle } from '../components/Common';
import ReturnSection from '../components/ReturnSection';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api';
import { subscribeCustomerEvents } from '../lib/realtime';
import { loadOrderReturns } from '../data/returnStore';
import { getProduct, onSale } from '../data/products';
import { SITE } from '../data/site';
import { statusLabel, PAY_LABEL, rs } from './Checkout';
import '../styles/order.css';

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
const short = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

// The delivery journey. Statuses that mean the same step for the customer are folded together.
const STEPS = [
  { key: 'confirmed', label: 'Confirmed', Icon: ClipboardCheck, from: ['confirmed', 'processing'] },
  { key: 'packed', label: 'Packed', Icon: PackageCheck, from: ['packed'] },
  { key: 'ready_for_pickup', label: 'Ready for pickup', Icon: Package, from: ['ready_for_pickup'] },
  { key: 'shipped', label: 'Shipped', Icon: Truck, from: ['shipped', 'in_transit'] },
  { key: 'out_for_delivery', label: 'Out for delivery', Icon: Navigation, from: ['out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', Icon: CheckCircle2, from: ['delivered', 'returned'] },
];
const STEP_OF = Object.fromEntries(STEPS.flatMap((s, i) => s.from.map((k) => [k, i])));
const STOPPED = ['cancelled', 'shipment_failed', 'delivery_failed', 'refund_initiated', 'refunded', 'rto'];

/* Headline per status: tone, icon and a sentence the customer can act on. */
function headline(o, firstName) {
  switch (o.status) {
    case 'pending_payment': return { tone: 'amber', Icon: Clock, title: 'Waiting for payment', text: 'If money was deducted, the order is confirmed automatically within a few minutes.' };
    case 'confirmed':
    case 'processing': return { tone: 'green', Icon: CheckCircle2, title: firstName ? `Thank you, ${firstName}!` : 'Order confirmed', text: 'Your order is confirmed. We will message you when it ships.' };
    case 'packed': return { tone: 'amber', Icon: PackageCheck, title: 'Packed and sealed', text: 'Your parcel is packed and preparing for courier handover.' };
    case 'ready_for_pickup': return { tone: 'amber', Icon: Package, title: 'Ready for pickup', text: o.courierName ? `Awaiting pickup by ${o.courierName}.` : 'Your parcel is ready for courier pickup.' };
    case 'shipped':
    case 'in_transit': return { tone: 'blue', Icon: Truck, title: 'On the way', text: o.estimatedDeliveryAt ? `Expected by ${day(o.estimatedDeliveryAt)}.` : 'Your parcel is with the courier.' };
    case 'out_for_delivery': return { tone: 'blue', Icon: Navigation, title: 'Out for delivery', text: 'Arriving today. Please keep your phone handy.' };
    case 'delivered': return { tone: 'green', Icon: CheckCircle2, title: 'Delivered', text: o.deliveredAt ? `Delivered on ${day(o.deliveredAt)}.` : 'Your order has been delivered.' };
    case 'shipment_failed': return { tone: 'red', Icon: XCircle, title: 'Shipment issue', text: 'We ran into a courier booking issue and our team is resolving it.' };
    case 'delivery_failed': return { tone: 'red', Icon: Clock, title: 'Delivery attempt failed', text: 'The courier could not complete delivery and will reattempt shortly.' };
    case 'returned': return { tone: 'red', Icon: Undo2, title: 'Returned', text: 'This order was returned. Refund details are in the returns section below.' };
    case 'refund_initiated': return { tone: 'amber', Icon: RotateCcw, title: 'Refund initiated', text: 'Your refund has been initiated and will reach your account in 5 to 7 working days.' };
    case 'refunded': return { tone: 'red', Icon: Undo2, title: 'Refunded', text: 'The refund reaches your account in 5 to 7 working days.' };
    case 'rto': return { tone: 'red', Icon: Undo2, title: 'Returned to us', text: 'The courier could not deliver this order. Message us and we will sort it out.' };
    case 'cancelled': return { tone: 'red', Icon: XCircle, title: 'Cancelled', text: 'This order was cancelled.' };
    default: return { tone: 'amber', Icon: Clock, title: statusLabel(o.status), text: '' };
  }
}

function Journey({ o }) {
  if (o.status === 'pending_payment') return null;
  const at = STEP_OF[o.status];
  const stopped = STOPPED.includes(o.status);
  const when = (step) => [...(o.timeline || [])].reverse().find((e) => step.from.includes(e.status))?.at;
  return (
    <section className="ord-card ord-journey" aria-label="Delivery progress">
      <ol className={`ord-steps${stopped ? ' is-stopped' : ''}`}>
        {STEPS.map((s, i) => {
          const done = !stopped && at !== undefined && i <= at;
          const t = when(s);
          return (
            <li key={s.key} className={`${done ? 'is-done' : ''}${!stopped && i === at ? ' is-now' : ''}`} aria-current={!stopped && i === at ? 'step' : undefined}>
              <span className="ord-steps__dot" aria-hidden="true"><s.Icon size={16} strokeWidth={2.2} /></span>
              <strong>{s.label}</strong>
              <small>{done && t ? short(t) : ' '}</small>
            </li>
          );
        })}
      </ol>
      {stopped && <p className="ord-journey__stop"><XCircle size={16} /> {statusLabel(o.status)}: this order will not be delivered.</p>}
      {o.isDelayed && <p className="ord-journey__delay"><Clock size={16} /> Running late{o.delayReason ? `: ${o.delayReason}` : ''}. New date {day(o.estimatedDeliveryAt)}.</p>}
    </section>
  );
}

const PAY_ICON = { upi: Smartphone, card: CreditCard, netbanking: Landmark, cod: Banknote };

/** Order details (and the confirmation page right after checkout). Owner only (RequireAuth + server check). */
export default function OrderDetails() {
  const { id } = useParams();
  const { hash } = useLocation();
  const { customer } = useAuth();
  const { add } = useCart();
  const [order, setOrder] = useState(null);
  const [returnsData, setReturnsData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useTitle(order ? `Order #${order.number}` : 'Your order');

  // order + (for delivered orders) its returns load together, then the page shows in one go,
  // and refresh live when order or return events arrive over SSE.
  useEffect(() => {
    let live = true;
    const fetchOrder = (silent = false) => {
      if (!silent) { setOrder(null); setReturnsData(null); setError(''); }
      api(`/api/orders/${encodeURIComponent(id)}`)
        .then(async (r) => {
          const o = r.order;
          const rd = ['delivered', 'returned'].includes(o.status) ? await loadOrderReturns(o.number).catch(() => null) : null;
          if (live) { setReturnsData(rd); setOrder(o); setError(''); }
        })
        .catch((e) => { if (live && !silent) setError(e.message); });
    };
    fetchOrder(false);
    const stopSse = subscribeCustomerEvents({
      onEvent: (ev) => {
        if (!ev) return;
        if (ev.type === 'order' && (!ev.orderNumber || ev.orderNumber === id)) fetchOrder(true);
        if (ev.type === 'return' || ev.type === 'payment') fetchOrder(true);
      },
    });
    return () => { live = false; stopSse(); };
  }, [id]);

  // #returns (from My account): straight to the returns block
  useLayoutEffect(() => {
    if (order && hash === '#returns') document.getElementById('returns')?.scrollIntoView({ block: 'start' });
  }, [order, hash]);

  if (error) {
    return (
      <section className="container empty-page">
        <h1>Order not found</h1>
        <p>{error}</p>
        <Link to="/account?v=orders" className="btn btn--lg">My orders</Link>
      </section>
    );
  }
  if (!order) return <div className="page-loading" aria-busy="true" />;

  const o = order;
  const h = headline(o, (customer?.name || '').split(' ')[0]);
  const count = o.items.reduce((n, i) => n + i.qty, 0);
  const canReorder = o.items.some((it) => onSale(getProduct(it.id)));
  const tracked = !['pending_payment', 'cancelled'].includes(o.status);
  const PayIcon = PAY_ICON[o.paymentMethod] || CreditCard;
  const paid = o.paymentStatus === 'paid';
  const buyAgain = () => {
    const items = o.items.filter((it) => onSale(getProduct(it.id)));
    items.forEach((it, i) => add(it.id, it.qty, it.pack || 1, { openDrawer: i === items.length - 1 }));
  };
  const copy = () => navigator.clipboard?.writeText(o.number).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});

  return (
    <div className="ord">
      <div className="container">
        <Breadcrumbs items={[['My account', '/account'], ['Orders', '/account?v=orders'], [`#${o.number}`]]} />

        {/* ---------- status header ---------- */}
        <header className={`ord-hero ord-hero--${h.tone}`}>
          <span className="ord-hero__icon" aria-hidden="true"><h.Icon size={30} strokeWidth={1.8} /></span>
          <div className="ord-hero__text">
            <p className="ord-hero__eyebrow">
              Order #{o.number}
              <button type="button" className="ord-copy" onClick={copy} aria-label="Copy order number">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              <span className="ord-hero__date">Placed {day(o.createdAt)}</span>
            </p>
            <h1>{h.title}</h1>
            {h.text && <p className="ord-hero__lead">{h.text}</p>}
          </div>
          <div className="ord-hero__actions">
            {tracked && <Link className="ord-btn" to={`/track/${o.trackingId || o.number}`}><Truck size={16} /> Track order</Link>}
            {o.status !== 'pending_payment' && !(o.status === 'cancelled' && o.paymentStatus !== 'paid') && (
              <a className="ord-btn ord-btn--ghost" href={`/api/orders/${encodeURIComponent(o.number)}/invoice`} target="_blank" rel="noreferrer">
                <Receipt size={16} /> {o.invoiceNumber ? `Invoice (${o.invoiceNumber})` : 'GST Invoice'}
              </a>
            )}
            {canReorder && <button type="button" className="ord-btn ord-btn--ghost" onClick={buyAgain}><RotateCcw size={16} /> Buy again</button>}
          </div>
        </header>

        <Journey o={o} />

        <div className="ord-grid">
          {/* ---------- left: items + returns ---------- */}
          <div className="ord-main">
            <section className="ord-card" aria-labelledby="ord-items">
              <h2 id="ord-items" className="ord-h2"><Package size={18} /> Items <span className="ord-count">{count}</span></h2>
              <ul className="ord-items">
                {o.items.map((it) => {
                  const p = getProduct(it.id);
                  return (
                    <li key={`${it.id}-${it.pack}`} className="ord-item">
                      <Link to={p ? `/products/${p.id}` : '/shop'} className="ord-item__img" style={{ background: p?.tint }}>
                        {p?.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <Package size={22} />}
                      </Link>
                      <div className="ord-item__body">
                        <Link to={p ? `/products/${p.id}` : '/shop'} className="ord-item__name">{it.name}</Link>
                        <small>{[it.size, it.pack > 1 ? `Pack of ${it.pack}` : null].filter(Boolean).join(' · ')}</small>
                        <small>Qty {it.qty} × {rs(it.unit)}</small>
                        {o.status === 'delivered' && p && <Link className="ord-item__review" to={`/products/${p.id}?review=1#reviews`}>Rate this product <ChevronRight size={14} /></Link>}
                      </div>
                      <strong className="ord-item__total">{rs(it.total)}</strong>
                    </li>
                  );
                })}
              </ul>
            </section>

            <ReturnSection order={o} initial={returnsData} />
          </div>

          {/* ---------- right: summary, delivery, payment, help ---------- */}
          <aside className="ord-side">
            <section className="ord-card" aria-labelledby="ord-sum">
              <h2 id="ord-sum" className="ord-h2"><Receipt size={18} /> Price details</h2>
              <dl className="ord-sum">
                <div><dt>Items ({count})</dt><dd>{rs(o.subtotal)}</dd></div>
                {o.discount > 0 && <div className="is-save"><dt>Prepaid discount</dt><dd>−{rs(o.discount)}</dd></div>}
                <div><dt>Delivery</dt><dd>{o.shipping ? rs(o.shipping) : <span className="ord-free">Free</span>}</dd></div>
                <div className="ord-sum__total"><dt>Order total</dt><dd>{rs(o.total)}</dd></div>
              </dl>
            </section>

            <section className="ord-card" aria-labelledby="ord-ship">
              <h2 id="ord-ship" className="ord-h2"><MapPin size={18} /> Delivery address</h2>
              <address className="ord-addr">
                <strong>{o.address.name}</strong>
                <span>{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ''}</span>
                <span>{o.address.city}, {o.address.state} {o.address.pin}</span>
                {o.address.phone && <span className="ord-addr__phone"><Phone size={13} /> +91 {o.address.phone}</span>}
              </address>
              {o.courierName && <p className="ord-note"><Truck size={14} /> {o.courierName}{o.awbNumber ? ` · AWB ${o.awbNumber}` : ''}</p>}
            </section>

            <section className="ord-card" aria-labelledby="ord-pay">
              <h2 id="ord-pay" className="ord-h2"><PayIcon size={18} /> Payment</h2>
              <div className="ord-pay">
                <span>{PAY_LABEL[o.paymentMethod] || o.paymentMethod}</span>
                <span className={`ord-pill ${paid ? 'is-ok' : o.paymentMethod === 'cod' ? 'is-wait' : 'is-warn'}`}>
                  {paid ? 'Paid' : o.paymentMethod === 'cod' ? 'Pay on delivery' : 'Pending'}
                </span>
              </div>
            </section>

            <section className="ord-card ord-help">
              <strong>Need help with this order?</strong>
              <p>Our team is here {SITE.hours}.</p>
              <div className="ord-help__btns">
                <a className="ord-btn" href={SITE.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp us</a>
                <a className="ord-btn ord-btn--ghost" href={SITE.phoneHref}><Phone size={16} /> Call</a>
              </div>
            </section>
          </aside>
        </div>

        <div className="ord-foot">
          <Link to="/account?v=orders" className="ord-btn ord-btn--ghost"><Package size={16} /> All my orders</Link>
          <Link to="/shop" className="ord-btn"><ShoppingBag size={16} /> Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
