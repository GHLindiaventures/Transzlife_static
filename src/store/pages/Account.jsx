import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LogOut, Package, ChevronRight, Trash2, Heart, Star, PenLine, ShoppingBag, MapPin, Bell, Phone, Mail,
  RotateCcw, MessageCircle, HelpCircle, Plus, Check,
} from 'lucide-react';
import { useTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api';
import { statusLabel, rs } from './Checkout';
import { getProduct, onSale } from '../data/products';
import { SITE } from '../data/site';
import { inr } from '../utils/format';   // product prices are in rupees; order totals (rs) are in paise
import { mergeWishlist, toggleWishlist } from '../lib/wishlist';
import { myReviews } from '../data/reviewStore';
import '../styles/account.css';

const badgeClass = (s) => (s === 'pending_payment' ? 'is-warn' : ['cancelled', 'refunded', 'returned', 'rto'].includes(s) ? 'is-off' : '');
const date = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'T';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

// Delivery progress shown on each order (out for delivery counts as past "Shipped").
const STEPS = [['confirmed', 'Confirmed'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const STEP_OF = { confirmed: 0, packed: 1, shipped: 2, out_for_delivery: 2, delivered: 3 };

function OrderProgress({ status }) {
  const at = STEP_OF[status];
  if (at === undefined) return null;
  return (
    <ol className="acx-steps" aria-label={`Order status: ${statusLabel(status)}`}>
      {STEPS.map(([key, label], i) => (
        <li key={key} className={i <= at ? 'is-done' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="acx-steps__dot">{i <= at && <Check size={11} strokeWidth={3} />}</span>
          <span className="acx-steps__label">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="acx-empty">
      <span className="acx-empty__icon" aria-hidden="true"><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

function Card({ id, icon: Icon, title, count, action, children }) {
  return (
    <section className="acx-card" id={id} aria-labelledby={`${id}-title`}>
      <header className="acx-card__head">
        <h2 id={`${id}-title`}><span className="acx-card__icon" aria-hidden="true"><Icon size={18} /></span>{title}{count > 0 && <span className="acx-count">{count}</span>}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** My account: profile, orders, reviews, saved products, reminders and addresses. Signed-in only (RequireAuth). */
export default function Account() {
  useTitle('My account');
  const { customer, logout, setCustomer } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [rv, setRv] = useState(null);
  const [saved, setSaved] = useState(null);
  const [prefBusy, setPrefBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders').then((r) => setOrders(r.orders)).catch((e) => { setError(e.message); setOrders([]); });
    api('/api/account/addresses').then((r) => setAddresses(r.addresses)).catch(() => setAddresses([]));
    mergeWishlist().then(setSaved);
    myReviews().then(setRv).catch(() => setRv({ toReview: [], mine: [] }));
  }, []);

  const unsave = async (id) => { await toggleWishlist(id, true); setSaved((ids) => ids.filter((x) => x !== id)); };
  const setReminders = async (on) => {
    setPrefBusy(true);
    try { const r = await api('/api/account', { method: 'PATCH', body: { name: customer.name, marketingConsent: on } }); setCustomer(r.customer); }
    catch (e) { setError(e.message); }
    finally { setPrefBusy(false); }
  };
  const removeAddress = async (id) => {
    try {
      await api(`/api/account/addresses/${id}`, { method: 'DELETE', body: {} });
      setAddresses((list) => list.filter((a) => a.id !== id));
    } catch (e) { setError(e.message); }
  };
  // Buy again: put the order's items (still on sale) back in the cart
  const buyAgain = (o) => {
    const items = o.items.filter((it) => onSale(getProduct(it.id)));
    items.forEach((it, i) => add(it.id, it.qty, it.pack || 1, { openDrawer: i === items.length - 1 }));
  };
  const signOut = async () => { await logout(); navigate('/', { replace: true }); };

  const savedProducts = (saved || []).map(getProduct).filter(Boolean);
  const toReview = rv?.toReview || [];
  const mine = rv?.mine || [];
  const first = customer.name.split(' ')[0];

  const stats = [
    { href: '#orders', icon: Package, value: orders?.length, label: 'Orders' },
    { href: '#reviews', icon: Star, value: rv ? mine.length : undefined, label: 'Reviews' },
    { href: '#saved', icon: Heart, value: saved ? savedProducts.length : undefined, label: 'Saved' },
    { href: '#addresses', icon: MapPin, value: addresses?.length, label: 'Addresses' },
  ];
  const nav = [
    ['#orders', Package, 'Orders'],
    ['#reviews', Star, 'Reviews'],
    ['#saved', Heart, 'Saved products'],
    ['#reminders', Bell, 'Reminders'],
    ['#addresses', MapPin, 'Addresses'],
  ];

  return (
    <div className="acx">
      {/* ---------- profile header ---------- */}
      <header className="acx-hero">
        <div className="container acx-hero__inner">
          <span className="acx-avatar" aria-hidden="true">{initials(customer.name)}</span>
          <div className="acx-hero__text">
            <p className="acx-hero__eyebrow">{greeting()}</p>
            <h1>Hello, {first}</h1>
            <ul className="acx-hero__meta">
              <li><Phone size={14} aria-hidden="true" /> +91 {customer.phone}</li>
              {customer.email && <li><Mail size={14} aria-hidden="true" /> {customer.email}</li>}
            </ul>
          </div>
          <button type="button" className="acx-signout" onClick={signOut}><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <div className="container acx-body">
        {/* ---------- quick stats ---------- */}
        <ul className="acx-stats">
          {stats.map((s) => (
            <li key={s.label}>
              <a href={s.href} className="acx-stat">
                <span className="acx-stat__icon" aria-hidden="true"><s.icon size={18} /></span>
                <strong>{s.value ?? '–'}</strong>
                <small>{s.label}</small>
              </a>
            </li>
          ))}
        </ul>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <div className="acx-layout">
          {/* ---------- side menu ---------- */}
          <aside className="acx-side">
            <nav className="acx-nav" aria-label="Account sections">
              {nav.map(([href, Icon, label]) => (
                <a key={href} href={href}><Icon size={16} aria-hidden="true" /> {label}</a>
              ))}
            </nav>
            <div className="acx-help">
              <span className="acx-help__icon" aria-hidden="true"><HelpCircle size={20} /></span>
              <strong>Need help with an order?</strong>
              <p>Our wellness team is here Mon to Sat, 10 am to 6:30 pm.</p>
              <a className="acx-help__btn" href={SITE.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Chat on WhatsApp</a>
              <Link className="acx-help__link" to="/faq">Read the FAQs <ChevronRight size={14} /></Link>
            </div>
          </aside>

          <div className="acx-main">
            {/* ---------- orders ---------- */}
            <Card id="orders" icon={Package} title="Your orders" count={orders?.length} action={<Link className="acx-link" to="/shop">Shop again <ChevronRight size={14} /></Link>}>
              {orders === null ? <p className="acx-loading">Loading your orders…</p> : orders.length === 0 ? (
                <Empty icon={ShoppingBag} title="No orders yet" text="When you place an order, you can track it here." action={<Link className="acx-btn" to="/shop">Start shopping</Link>} />
              ) : (
                <ul className="acx-orders">
                  {orders.map((o) => {
                    const count = o.items.reduce((n, i) => n + i.qty, 0);
                    const thumbs = o.items.map((it) => getProduct(it.id)).filter(Boolean).slice(0, 3);
                    const canReorder = o.items.some((it) => onSale(getProduct(it.id)));
                    return (
                      <li key={o.number} className="acx-order">
                        <div className="acx-order__top">
                          <span className="acx-thumbs" aria-hidden="true">
                            {thumbs.length ? thumbs.map((p) => <img key={p.id} src={p.images?.[0]} alt="" loading="lazy" style={{ background: p.tint }} />) : <Package size={20} />}
                          </span>
                          <span className="acx-order__info">
                            <strong>Order #{o.number}</strong>
                            <small>{date(o.createdAt)} · {count} item{count === 1 ? '' : 's'} · {rs(o.total)}</small>
                            <small className="acx-order__names">{o.items.map((it) => it.name).join(', ')}</small>
                          </span>
                          <span className={`acx-badge ${badgeClass(o.status)}`}>{statusLabel(o.status)}</span>
                        </div>
                        <OrderProgress status={o.status} />
                        <div className="acx-order__actions">
                          <Link className="acx-btn acx-btn--ghost" to={`/order/${o.number}`}>View details <ChevronRight size={14} /></Link>
                          {canReorder && <button type="button" className="acx-btn" onClick={() => buyAgain(o)}><RotateCcw size={15} /> Buy again</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* ---------- reviews ---------- */}
            <Card id="reviews" icon={Star} title="Your reviews" count={mine.length}>
              {rv === null ? <p className="acx-loading">Loading…</p> : (toReview.length === 0 && mine.length === 0) ? (
                <Empty icon={Star} title="No reviews yet" text="After your order is delivered, you can tell others how it went." />
              ) : (
                <>
                  {toReview.length > 0 && (
                    <ul className="acx-review-asks">
                      {toReview.map((x) => {
                        const prod = getProduct(x.id);
                        return (
                          <li key={x.id}>
                            {prod?.images?.[0] && <img src={prod.images[0]} alt="" loading="lazy" style={{ background: prod.tint }} />}
                            <span><strong>{x.short || x.name}</strong><small>Delivered. How was it?</small></span>
                            <Link className="acx-btn" to={`/products/${x.id}?review=1#reviews`}><PenLine size={15} /> Write a review</Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {mine.length > 0 && (
                    <ul className="acx-reviews">
                      {mine.map((r) => {
                        const prod = getProduct(r.product_id);
                        return (
                          <li key={r.id}>
                            <Link to={`/products/${r.product_id}#reviews`} className="acx-review">
                              {prod?.images?.[0] && <img src={prod.images[0]} alt="" loading="lazy" style={{ background: prod.tint }} />}
                              <span className="acx-review__body">
                                <strong>{r.product}</strong>
                                <span className="acx-stars" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></span>
                                <small>{date(r.created_at)}</small>
                              </span>
                              <span className={`acx-badge ${r.status === 'approved' ? '' : r.status === 'pending' ? 'is-warn' : 'is-off'}`}>{r.status === 'approved' ? 'Published' : r.status === 'pending' ? 'Being checked' : 'Not published'}</span>
                              <ChevronRight size={16} className="acx-chev" aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </Card>

            {/* ---------- saved products ---------- */}
            <Card id="saved" icon={Heart} title="Saved products" count={savedProducts.length}>
              {saved === null ? <p className="acx-loading">Loading…</p> : savedProducts.length === 0 ? (
                <Empty icon={Heart} title="Nothing saved yet" text="Tap the heart on any product to keep it here for later." action={<Link className="acx-btn acx-btn--ghost" to="/shop">Browse products</Link>} />
              ) : (
                <ul className="acx-saved">
                  {savedProducts.map((p) => (
                    <li key={p.id} className="acx-prod" style={{ '--tint': p.tint }}>
                      <Link to={`/products/${p.id}`} className="acx-prod__img"><img src={p.images?.[0]} alt="" loading="lazy" /></Link>
                      <button type="button" className="acx-prod__remove" onClick={() => unsave(p.id)} aria-label={`Remove ${p.name} from saved products`}><Trash2 size={15} /></button>
                      <div className="acx-prod__body">
                        <Link to={`/products/${p.id}`} className="acx-prod__name">{p.short || p.name}</Link>
                        <small>{p.format} · {p.size}</small>
                        <div className="acx-prod__foot">
                          <strong>{onSale(p) ? inr(p.price) : 'Coming soon'}</strong>
                          {onSale(p)
                            ? <button type="button" className="acx-btn acx-btn--sm" onClick={() => add(p.id)}><ShoppingBag size={14} /> Add</button>
                            : <Link className="acx-btn acx-btn--sm acx-btn--ghost" to={`/products/${p.id}`}>View</Link>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ---------- reminders ---------- */}
            <Card id="reminders" icon={Bell} title="Reminders">
              <label className={`acx-switch ${prefBusy ? 'is-busy' : ''}`}>
                <span className="acx-switch__text">
                  <strong>Restock and cart reminders</strong>
                  <small>A WhatsApp or SMS when it’s time to restock, or if you leave items in your cart. At most one message per order or cart. Reply STOP anytime.</small>
                </span>
                <input type="checkbox" role="switch" checked={!!customer.marketingConsent} disabled={prefBusy} onChange={(e) => setReminders(e.target.checked)} />
                <span className="acx-switch__track" aria-hidden="true"><span /></span>
              </label>
            </Card>

            {/* ---------- addresses ---------- */}
            <Card id="addresses" icon={MapPin} title="Saved addresses" count={addresses?.length}>
              {addresses === null ? <p className="acx-loading">Loading…</p> : (
                <ul className="acx-addrs">
                  {addresses.map((a) => (
                    <li key={a.id} className="acx-addr">
                      <span className="acx-addr__icon" aria-hidden="true"><MapPin size={16} /></span>
                      <span className="acx-addr__body">
                        <strong>{a.name}</strong>
                        <small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</small>
                        <small>{a.city}, {a.state} {a.pin}</small>
                        <small className="acx-addr__phone"><Phone size={12} aria-hidden="true" /> {a.phone}</small>
                      </span>
                      <button type="button" className="acx-addr__remove" onClick={() => removeAddress(a.id)} aria-label={`Remove address for ${a.name}`}><Trash2 size={15} /> Remove</button>
                    </li>
                  ))}
                  <li className="acx-addr acx-addr--new">
                    <span className="acx-addr__icon" aria-hidden="true"><Plus size={16} /></span>
                    <span className="acx-addr__body">
                      <strong>Add a new address</strong>
                      <small>New addresses you use at checkout are saved here automatically.</small>
                    </span>
                  </li>
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
