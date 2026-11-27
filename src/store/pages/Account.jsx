import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  LogOut, Package, ChevronRight, ChevronLeft, Trash2, Heart, Star, PenLine, ShoppingBag, MapPin, Bell, Phone, Mail,
  RotateCcw, MessageCircle, HelpCircle, Plus, Check, Headset, UserRound, Smartphone, ShieldCheck, FileText, Truck,
  Eye, Leaf, Gift, Monitor, LayoutGrid,
} from 'lucide-react';
import { useTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api';
import { subscribeCustomerEvents } from '../lib/realtime';
import { statusLabel, rs, STATES } from './Checkout';
import { loadMyReturns, returnTone } from '../data/returnStore';
import { getProduct, onSale } from '../data/products';
import { SITE } from '../data/site';
import { inr } from '../utils/format';   // product prices are in rupees; order totals (rs) are in paise
import { mergeWishlist, toggleWishlist } from '../lib/wishlist';
import { myReviews } from '../data/reviewStore';
import { recentlyViewed, clearViewed } from '../lib/recent';
import { resolveSocialLinks } from '../../components/Footer';
import { useSiteContent } from '../lib/siteContent';
import { packshot } from '../lib/packshot';
import '../styles/account.css';

const badgeClass = (s) => (s === 'pending_payment' ? 'is-warn' : ['cancelled', 'refunded', 'returned', 'rto'].includes(s) ? 'is-off' : '');
const date = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (iso) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 15 ? 'Active now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : date(iso);
};
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'T';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

// Delivery progress shown on each order.
const STEPS = [['confirmed', 'Confirmed'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const STEP_OF = { confirmed: 0, processing: 0, packed: 1, shipped: 2, in_transit: 2, out_for_delivery: 2, delivered: 3 };

// On phones the page opens as a menu (like shopping apps); each menu row opens one section as
// its own screen via ?v=..., so the phone's back button returns to the menu.
const VIEWS = {
  orders: 'My orders', returns: 'Returns & refunds', reviews: 'My reviews', saved: 'Saved products',
  recent: 'Recently viewed', profile: 'Edit profile', addresses: 'Saved addresses',
  reminders: 'Notification settings', devices: 'Manage devices',
};

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

function Card({ id, icon: Icon, title, count, action, view, children }) {
  // on a phone, while one section is open (?v=...), the other sections step aside
  const off = view && view !== id;
  return (
    <section className={`acx-card${off ? ' acx-card--off' : ''}`} id={id} aria-labelledby={`${id}-title`}>
      <header className="acx-card__head">
        <h2 id={`${id}-title`}><span className="acx-card__icon" aria-hidden="true"><Icon size={18} /></span>{title}{count > 0 && <span className="acx-count">{count}</span>}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/* one row of the phone menu: icon, label, optional pill, chevron */
function Row({ to, href, icon: Icon, label, pill, onClick }) {
  const inner = (
    <>
      <span className="acm-row__icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="acm-row__label">{label}</span>
      {pill != null && pill !== '' && <span className="acm-pill">{pill}</span>}
      <ChevronRight size={18} className="acm-row__chev" aria-hidden="true" />
    </>
  );
  if (to) return <li><Link className="acm-row" to={to}>{inner}</Link></li>;
  if (href) return <li><a className="acm-row" href={href} {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noreferrer' } : {})}>{inner}</a></li>;
  return <li><button type="button" className="acm-row" onClick={onClick}>{inner}</button></li>;
}

function Group({ id, title, children }) {
  return (
    <section className="acm-group" id={id} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

/** My account: profile, orders, returns, reviews, saved products, reminders, addresses and devices. Signed-in only (RequireAuth). */
export default function Account() {
  useTitle('My account');
  const siteContent = useSiteContent();
  const { customer, logout, setCustomer } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const view = VIEWS[params.get('v')] ? params.get('v') : null;
  const [orders, setOrders] = useState(null);
  const [returns, setReturns] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [rv, setRv] = useState(null);
  const [saved, setSaved] = useState(null);
  const [devices, setDevices] = useState(null);
  const [recent, setRecent] = useState(() => recentlyViewed());
  const [prefBusy, setPrefBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: customer.name || '', email: customer.email || '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrMsg, setAddrMsg] = useState('');

  useEffect(() => {
    const loadOrders = () => api('/api/orders').then((r) => setOrders(r.orders)).catch((e) => { setError(e.message); setOrders([]); });
    const loadAddresses = () => api('/api/account/addresses').then((r) => setAddresses(r.addresses)).catch(() => setAddresses([]));
    const loadReturns = () => loadMyReturns().then(setReturns);

    loadReturns();
    loadOrders();
    loadAddresses();
    api('/api/account/devices').then((r) => setDevices(r.devices)).catch(() => setDevices([]));
    mergeWishlist().then(setSaved);
    myReviews().then(setRv).catch(() => setRv({ toReview: [], mine: [] }));

    return subscribeCustomerEvents({
      onEvent: (ev) => {
        if (!ev) return;
        if (ev.type === 'order' || ev.type === 'payment') loadOrders();
        if (ev.type === 'return') { loadReturns(); loadOrders(); }
        if (ev.type === 'customer') {
          loadAddresses();
          api('/api/auth/me').then((r) => { if (r?.customer) setCustomer(r.customer); }).catch(() => {});
        }
      },
    });
  }, [setCustomer]);

  // Opening a section shows just that section (phones: as its own screen; wider screens: next to the
  // side menu). Phones start it at the top; wider screens only scroll if the section's top is hidden
  // under the header, so the page never jumps down to the footer.
  useEffect(() => {
    if (window.matchMedia('(max-width: 749px)').matches) { if (view) window.scrollTo(0, 0); return; }
    const layout = document.querySelector('.acx-layout');
    if (!layout || !params.has('v')) return;
    const header = (document.querySelector('.header')?.getBoundingClientRect().bottom || 80) + 16;
    const top = layout.getBoundingClientRect().top;
    if (top < header) window.scrollTo({ top: window.scrollY + top - header, behavior: 'smooth' });
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const unsave = async (id) => { await toggleWishlist(id, true); setSaved((ids) => ids.filter((x) => x !== id)); };
  const setReminders = async (on) => {
    setPrefBusy(true);
    try { const r = await api('/api/account', { method: 'PATCH', body: { name: customer.name, marketingConsent: on } }); setCustomer(r.customer); }
    catch (e) { setError(e.message); }
    finally { setPrefBusy(false); }
  };
  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile'); setProfileMsg(''); setError('');
    try {
      const r = await api('/api/account', { method: 'PATCH', body: { name: form.name, email: form.email } });
      setCustomer(r.customer);
      setProfileMsg('Saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };
  const removeAddress = async (id) => {
    try {
      await api(`/api/account/addresses/${id}`, { method: 'DELETE', body: {} });
      setAddresses((list) => list.filter((a) => a.id !== id));
    } catch (e) { setError(e.message); }
  };
  const addAddress = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    body.makeDefault = body.makeDefault === 'on';
    setBusy('address'); setError(''); setAddrMsg('');
    try {
      const r = await api('/api/account/addresses', { method: 'POST', body });
      const a = r.address;
      setAddresses((list) => [a, ...(list || []).filter((x) => x.id !== a.id).map((x) => (a.isDefault ? { ...x, isDefault: false } : x))]
        .sort((x, y) => Number(y.isDefault) - Number(x.isDefault)));
      form.reset();
      setAddrOpen(false);
      setAddrMsg('Address saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };
  const makeDefault = async (id) => {
    setBusy(id);
    try {
      await api(`/api/account/addresses/${id}/default`, { method: 'POST', body: {} });
      setAddresses((list) => list.map((a) => ({ ...a, isDefault: a.id === id })).sort((x, y) => Number(y.isDefault) - Number(x.isDefault)));
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };
  const signOutDevice = async (id) => {
    setBusy(id);
    try { await api(`/api/account/devices/${id}`, { method: 'DELETE', body: {} }); setDevices((l) => l.filter((d) => d.id !== id)); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };
  const signOutOthers = async () => {
    setBusy('others');
    try { await api('/api/account/devices/sign-out-others', { method: 'POST', body: {} }); setDevices((l) => l.filter((d) => d.current)); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };
  // Buy again: put the order's items (still on sale) back in the cart
  const buyAgain = (o) => {
    const items = o.items.filter((it) => onSale(getProduct(it.id)));
    items.forEach((it, i) => add(it.id, it.qty, it.pack || 1, { openDrawer: i === items.length - 1 }));
  };
  const signOut = async () => { await logout(); navigate('/', { replace: true }); };

  const savedProducts = (saved || []).map(getProduct).filter(Boolean);
  const recentProducts = recent.map(getProduct).filter(Boolean);
  const toReview = rv?.toReview || [];
  const mine = rv?.mine || [];
  const first = customer.name.split(' ')[0];
  const socials = resolveSocialLinks(siteContent);
  // the latest order that is still on its way, shown at the top of the phone menu
  const live = (orders || []).find((o) => o.status === 'pending_payment' || (STEP_OF[o.status] !== undefined && o.status !== 'delivered'));
  const deleteHref = `mailto:${SITE.careEmail}?subject=${encodeURIComponent('Please delete my TranzLife account')}&body=${encodeURIComponent(`Please delete my account and personal data for the mobile number +91 ${customer.phone}.`)}`;

  const stats = [
    { v: 'orders', icon: Package, value: orders?.length, label: 'Orders' },
    { v: 'reviews', icon: Star, value: rv ? mine.length : undefined, label: 'Reviews' },
    { v: 'saved', icon: Heart, value: saved ? savedProducts.length : undefined, label: 'Saved' },
    { v: 'addresses', icon: MapPin, value: addresses?.length, label: 'Addresses' },
  ];
  const nav = [
    ['', LayoutGrid, 'Overview'],
    ['orders', Package, 'Orders'],
    ['returns', RotateCcw, 'Returns'],
    ['reviews', Star, 'Reviews'],
    ['saved', Heart, 'Saved products'],
    ['recent', Eye, 'Recently viewed'],
    ['profile', UserRound, 'Profile'],
    ['reminders', Bell, 'Reminders'],
    ['addresses', MapPin, 'Addresses'],
    ['devices', Smartphone, 'Devices & privacy'],
  ];
  const tiles = [
    ['orders', Package, 'Orders', orders?.length],
    ['saved', Heart, 'Saved', saved ? savedProducts.length : undefined],
    ['returns', RotateCcw, 'Returns', returns?.length],
    ['reviews', Star, 'Reviews', rv ? mine.length : undefined],
  ];

  return (
    <div className="acx" data-view={view || undefined}>
      {/* ================= phone: account menu ================= */}
      {!view && (
        <div className="acm">
          <div className="acm-top">
            <h1>Hey, {first}</h1>
            <a className="acm-help-btn" href="#acm-help"><Headset size={18} aria-hidden="true" /> Help</a>
          </div>

          <Link className="acm-profile" to="?v=profile">
            <span className="acm-profile__main">
              <span className="acx-avatar acm-avatar" aria-hidden="true">{initials(customer.name)}</span>
              <span className="acm-profile__text">
                <strong>{customer.name}</strong>
                <small>+91 {customer.phone}{customer.email ? ` · ${customer.email}` : ''}</small>
              </span>
              <span className="acm-profile__edit">Edit <ChevronRight size={16} aria-hidden="true" /></span>
            </span>
            <span className="acm-profile__perk"><Gift size={15} aria-hidden="true" /> Free shipping above ₹{SITE.freeShippingAbove} · extra {Math.round(SITE.prepaidDiscount * 100)}% off when you pay online</span>
          </Link>

          <ul className="acm-tiles">
            {tiles.map(([v, Icon, label, n]) => (
              <li key={v}>
                <Link className="acm-tile" to={`?v=${v}`}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                  {n > 0 && <small className="acm-tile__n">{n}</small>}
                </Link>
              </li>
            ))}
          </ul>

          {error && <p className="auth-error" role="alert">{error}</p>}

          {live && (
            <Link className="acm-live" to={`/order/${live.number}`}>
              <span className="acm-live__head">
                <Truck size={18} aria-hidden="true" />
                <strong>Order #{live.number}</strong>
                <span className={`acx-badge ${badgeClass(live.status)}`}>{statusLabel(live.status)}</span>
              </span>
              <small>{live.items.map((it) => it.name).join(', ')}</small>
              <OrderProgress status={live.status} />
            </Link>
          )}

          {recentProducts.length > 0 && (
            <section className="acm-shelf" aria-labelledby="acm-recent-t">
              <div className="acm-shelf__head">
                <h2 id="acm-recent-t">Recently viewed</h2>
                <Link to="?v=recent">View all</Link>
              </div>
              <ul className="acm-scroll">
                {recentProducts.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link to={`/products/${p.id}`} className="acm-mini">
                      <span className="acm-mini__img" style={{ background: '#fff' }}><img src={packshot(p)} alt="" loading="lazy" /></span>
                      <span className="acm-mini__name">{p.short || p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {toReview.length > 0 && (
            <section className="acm-shelf" aria-labelledby="acm-rate-t">
              <div className="acm-shelf__head">
                <h2 id="acm-rate-t">Rate your purchases</h2>
                <Link to="?v=reviews">View all</Link>
              </div>
              <ul className="acm-scroll acm-scroll--wide">
                {toReview.map((x) => {
                  const prod = getProduct(x.id);
                  return (
                    <li key={x.id} className="acm-rate">
                      <div className="acm-rate__top">
                        {prod?.images?.[0] && <span className="acm-rate__img" style={{ background: '#fff' }}><img src={packshot(prod)} alt="" loading="lazy" /></span>}
                        <span><strong>{x.short || x.name}</strong><small>Delivered. How was it?</small></span>
                      </div>
                      <div className="acm-rate__stars" role="group" aria-label={`Rate ${x.short || x.name}`}>
                        <span>Rate this product</span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Link key={n} to={`/products/${x.id}?review=1&rating=${n}#reviews`} aria-label={`${n} star${n > 1 ? 's' : ''}`}><Star size={24} /></Link>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Group id="acm-settings" title="Account settings">
            <Row to="?v=profile" icon={UserRound} label="Edit profile" />
            <Row to="?v=addresses" icon={MapPin} label="Saved addresses" pill={addresses?.length ? `${addresses.length} saved` : ''} />
            <Row to="?v=reminders" icon={Bell} label="Notification settings" pill={customer.marketingConsent ? 'On' : 'Off'} />
            <Row to="?v=devices" icon={Smartphone} label="Manage devices" pill={devices?.length ? `${devices.length} active device${devices.length > 1 ? 's' : ''}` : ''} />
          </Group>

          <Group id="acm-activity" title="My activity">
            <Row to="?v=orders" icon={Package} label="My orders" />
            <Row to="?v=returns" icon={RotateCcw} label="Returns & refunds" />
            <Row to="?v=reviews" icon={Star} label="My reviews" pill={toReview.length ? `${toReview.length} to rate` : ''} />
            <Row to="?v=saved" icon={Heart} label="Saved products" />
            <Row to="?v=recent" icon={Eye} label="Recently viewed" />
          </Group>

          <Group id="acm-help" title="Help & support">
            <Row href={SITE.whatsapp} icon={MessageCircle} label="Chat with us on WhatsApp" pill="Fastest" />
            <Row href={SITE.phoneHref} icon={Phone} label={`Call ${SITE.phone}`} />
            <Row href={`mailto:${SITE.careEmail}`} icon={Mail} label="Email customer care" />
            <Row to="/faq" icon={HelpCircle} label="FAQs" />
          </Group>

          <Group id="acm-legal" title="Policies & privacy">
            <Row to="/policies/shipping" icon={Truck} label="Shipping & returns policy" />
            <Row to="/policies/privacy" icon={ShieldCheck} label="Privacy policy" />
            <Row to="/policies/terms" icon={FileText} label="Terms of use" />
            <Row href={deleteHref} icon={Trash2} label="Request account deletion" />
          </Group>

          {socials.length > 0 && (
            <section className="acm-group" aria-labelledby="acm-follow-t">
              <h2 id="acm-follow-t">Follow us on</h2>
              <ul className="acm-social">
                {socials.map((s) => (
                  <li key={s.key || s.label}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.svg}<span>{s.label}</span></a></li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" className="acm-logout" onClick={signOut}>Log out</button>
          <p className="acm-hours">Our team is here {SITE.hours}.</p>
          <p className="acm-sign" aria-hidden="true"><Leaf size={26} /> Plant-based wellness,<br />made in India</p>
        </div>
      )}

      {/* ================= phone: back bar for an open section ================= */}
      {view && (
        <div className="acm-back">
          <Link to="/account" aria-label="Back to my account"><ChevronLeft size={22} /></Link>
          <h1>{VIEWS[view]}</h1>
        </div>
      )}

      {/* ---------- profile header (tablet and desktop) ---------- */}
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
          <div className="acx-hero__actions">
            <Link className="acx-signout" to="?v=profile"><PenLine size={16} /> Edit profile</Link>
            <button type="button" className="acx-signout" onClick={signOut}><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>

      <div className="container acx-body">
        {/* ---------- quick stats ---------- */}
        <ul className="acx-stats">
          {stats.map((s) => (
            <li key={s.label}>
              <Link to={`?v=${s.v}`} className="acx-stat" aria-current={view === s.v ? 'page' : undefined}>
                <span className="acx-stat__icon" aria-hidden="true"><s.icon size={18} /></span>
                <strong>{s.value ?? '–'}</strong>
                <small>{s.label}</small>
              </Link>
            </li>
          ))}
        </ul>

        {error && <p className="auth-error acx-error" role="alert">{error}</p>}

        <div className="acx-layout">
          {/* ---------- side menu ---------- */}
          <aside className="acx-side">
            <nav className="acx-nav" aria-label="Account sections">
              {nav.map(([key, Icon, label]) => (
                <Link key={key || 'all'} to={key ? `?v=${key}` : '/account'} aria-current={(view || '') === key ? 'page' : undefined}><Icon size={16} aria-hidden="true" /> {label}</Link>
              ))}
            </nav>
            <div className="acx-help">
              <span className="acx-help__icon" aria-hidden="true"><HelpCircle size={20} /></span>
              <strong>Need help with an order?</strong>
              <p>Our wellness team is here {SITE.hours}.</p>
              <a className="acx-help__btn" href={SITE.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Chat on WhatsApp</a>
              <a className="acx-help__link" href={SITE.phoneHref}><Phone size={14} /> {SITE.phone}</a>
              <Link className="acx-help__link" to="/faq">Read the FAQs <ChevronRight size={14} /></Link>
            </div>
          </aside>

          <div className="acx-main">
            {/* ---------- orders ---------- */}
            <Card id="orders" view={view} icon={Package} title="Your orders" count={orders?.length} action={<Link className="acx-link" to="/shop">Shop again <ChevronRight size={14} /></Link>}>
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
                            {thumbs.length ? thumbs.map((p) => <img key={p.id} src={packshot(p)} alt="" loading="lazy" style={{ background: '#fff' }} />) : <Package size={20} />}
                          </span>
                          <span className="acx-order__info">
                            <strong>Order #{o.number}</strong>
                            <small>{date(o.createdAt)} · {count} item{count === 1 ? '' : 's'} · {rs(o.total)}</small>
                            <small className="acx-order__names">{o.items.map((it) => it.name).join(', ')}</small>
                          </span>
                          <span className={`acx-badge ${badgeClass(o.status)}`}>{statusLabel(o.status)}</span>
                        </div>
                        <OrderProgress status={o.status} />
                        {o.estimatedDeliveryAt && o.status !== 'delivered' && !['cancelled', 'returned', 'rto'].includes(o.status) && (
                          <p className="acx-muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                            {o.isDelayed ? 'Delayed · ' : ''}Expected delivery: <strong>{new Date(o.estimatedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
                          </p>
                        )}
                        {(returns || []).filter((r) => r.orderNumber === o.number).map((r) => (
                          <Link key={r.id} className="acx-return" to={`/order/${o.number}#returns`}>
                            <RotateCcw size={14} aria-hidden="true" /> Return {r.number}: <span className={`acx-badge ${returnTone(r)}`}>{r.label}</span>
                          </Link>
                        ))}
                        <div className="acx-order__actions">
                          <Link className="acx-btn acx-btn--ghost" to={`/track/${o.trackingId || o.number}`}>Track order <ChevronRight size={14} /></Link>
                          <Link className="acx-btn acx-btn--ghost" to={`/order/${o.number}`}>View details <ChevronRight size={14} /></Link>
                          {o.status !== 'pending_payment' && !(o.status === 'cancelled' && o.paymentStatus !== 'paid') && (
                            <a className="acx-btn acx-btn--ghost" href={`/api/orders/${encodeURIComponent(o.number)}/invoice`} target="_blank" rel="noreferrer">Invoice</a>
                          )}
                          {canReorder && <button type="button" className="acx-btn" onClick={() => buyAgain(o)}><RotateCcw size={15} /> Buy again</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* ---------- returns ---------- */}
            <Card id="returns" view={view} icon={RotateCcw} title="Returns & refunds" count={returns?.length}>
              {returns === null ? <p className="acx-loading">Loading…</p> : returns.length === 0 ? (
                <Empty icon={RotateCcw} title="No returns" text="To return something, open the order and choose Return items. Refunds reach you in 5 to 7 working days." action={<Link className="acx-btn acx-btn--ghost" to="/policies/shipping">Read the returns policy</Link>} />
              ) : (
                <ul className="acx-reviews">
                  {returns.map((r) => (
                    <li key={r.id}>
                      <Link to={`/order/${r.orderNumber}#returns`} className="acx-review">
                        <span className="acx-addr__icon" aria-hidden="true"><RotateCcw size={16} /></span>
                        <span className="acx-review__body">
                          <strong>Return {r.number}</strong>
                          <small>Order #{r.orderNumber} · {r.items.map((i) => i.name).join(', ')}</small>
                        </span>
                        <span className={`acx-badge ${returnTone(r)}`}>{r.label}</span>
                        <ChevronRight size={16} className="acx-chev" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ---------- reviews ---------- */}
            <Card id="reviews" view={view} icon={Star} title="Your reviews" count={mine.length}>
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
                            {prod?.images?.[0] && <img src={packshot(prod)} alt="" loading="lazy" style={{ background: '#fff' }} />}
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
                              {prod?.images?.[0] && <img src={packshot(prod)} alt="" loading="lazy" style={{ background: '#fff' }} />}
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
            <Card id="saved" view={view} icon={Heart} title="Saved products" count={savedProducts.length}>
              {saved === null ? <p className="acx-loading">Loading…</p> : savedProducts.length === 0 ? (
                <Empty icon={Heart} title="Nothing saved yet" text="Tap the heart on any product to keep it here for later." action={<Link className="acx-btn acx-btn--ghost" to="/shop">Browse products</Link>} />
              ) : (
                <ul className="acx-saved">
                  {savedProducts.map((p) => (
                    <li key={p.id} className="acx-prod" style={{ '--tint': p.tint }}>
                      <Link to={`/products/${p.id}`} className="acx-prod__img"><img src={packshot(p)} alt="" loading="lazy" /></Link>
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

            {/* ---------- recently viewed ---------- */}
            <Card id="recent" view={view} icon={Eye} title="Recently viewed" count={recentProducts.length}
              action={recentProducts.length > 0 && <button type="button" className="acx-link" onClick={() => { clearViewed(); setRecent([]); }}>Clear</button>}>
              {recentProducts.length === 0 ? (
                <Empty icon={Eye} title="Nothing here yet" text="Products you look at on this device show up here, so you can find them again." action={<Link className="acx-btn acx-btn--ghost" to="/shop">Browse products</Link>} />
              ) : (
                <ul className="acx-saved">
                  {recentProducts.map((p) => (
                    <li key={p.id} className="acx-prod" style={{ '--tint': p.tint }}>
                      <Link to={`/products/${p.id}`} className="acx-prod__img"><img src={packshot(p)} alt="" loading="lazy" /></Link>
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

            {/* ---------- profile ---------- */}
            <Card id="profile" view={view} icon={UserRound} title="Your profile">
              <form className="acx-form" onSubmit={saveProfile}>
                <label>
                  <span>Full name</span>
                  <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setProfileMsg(''); }} autoComplete="name" required minLength={2} maxLength={80} />
                </label>
                <label>
                  <span>Email <small>(for order updates and invoices)</small></span>
                  <input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setProfileMsg(''); }} autoComplete="email" maxLength={120} placeholder="you@example.com" />
                </label>
                <label>
                  <span>Mobile number <small>(used to sign in)</small></span>
                  <input value={`+91 ${customer.phone}`} readOnly disabled />
                </label>
                <div className="acx-form__foot">
                  <button type="submit" className="acx-btn" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save changes'}</button>
                  {profileMsg && <span className="acx-saved-msg" role="status"><Check size={15} /> {profileMsg}</span>}
                </div>
              </form>
            </Card>

            {/* ---------- reminders ---------- */}
            <Card id="reminders" view={view} icon={Bell} title="Reminders">
              <label className={`acx-switch ${prefBusy ? 'is-busy' : ''}`}>
                <span className="acx-switch__text">
                  <strong>Restock and cart reminders</strong>
                  <small>A WhatsApp or SMS when it’s time to restock, or if you leave items in your cart. At most one message per order or cart. Reply STOP anytime.</small>
                </span>
                <input type="checkbox" role="switch" checked={!!customer.marketingConsent} disabled={prefBusy} onChange={(e) => setReminders(e.target.checked)} />
                <span className="acx-switch__track" aria-hidden="true"><span /></span>
              </label>
              <p className="acx-note">Order updates (confirmation, shipping, delivery) are always sent, so you never miss a parcel.</p>
            </Card>

            {/* ---------- addresses ---------- */}
            <Card id="addresses" view={view} icon={MapPin} title="Saved addresses" count={addresses?.length}>
              {addresses === null ? <p className="acx-loading">Loading…</p> : (
                <ul className="acx-addrs">
                  {addresses.map((a) => (
                    <li key={a.id} className="acx-addr">
                      <span className="acx-addr__icon" aria-hidden="true"><MapPin size={16} /></span>
                      <span className="acx-addr__body">
                        <strong>{a.name}{a.isDefault && <span className="acx-badge">Default</span>}</strong>
                        <small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</small>
                        <small>{a.city}, {a.state} {a.pin}</small>
                        <small className="acx-addr__phone"><Phone size={12} aria-hidden="true" /> {a.phone}</small>
                      </span>
                      <span className="acx-addr__acts">
                        {!a.isDefault && <button type="button" className="acx-addr__default" disabled={busy === a.id} onClick={() => makeDefault(a.id)}><Check size={15} /> Make default</button>}
                        <button type="button" className="acx-addr__remove" onClick={() => removeAddress(a.id)} aria-label={`Remove address for ${a.name}`}><Trash2 size={15} /> Remove</button>
                      </span>
                    </li>
                  ))}
                  {!addrOpen && (
                    <li>
                      <button type="button" className="acx-addr acx-addr--new" onClick={() => { setAddrOpen(true); setAddrMsg(''); }}>
                        <span className="acx-addr__icon" aria-hidden="true"><Plus size={16} /></span>
                        <span className="acx-addr__body">
                          <strong>Add a new address</strong>
                          <small>Save a home, office or family address to pick it at checkout.</small>
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              )}
              {addrMsg && <p className="acx-saved-msg acx-addr-msg" role="status"><Check size={15} /> {addrMsg}</p>}
              {addrOpen && (
                <form className="acx-form acx-addr-form" onSubmit={addAddress}>
                  <h3>New address</h3>
                  <div className="acx-form__row">
                    <label><span>Full name</span><input name="name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={customer.name || ''} /></label>
                    <label><span>Mobile number</span><input name="phone" type="tel" required pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel-national" placeholder="10-digit mobile" defaultValue={customer.phone || ''} /></label>
                  </div>
                  <label><span>House / flat, street</span><input name="line1" required minLength={3} maxLength={160} autoComplete="address-line1" /></label>
                  <label><span>Area, landmark <small>(optional)</small></span><input name="line2" maxLength={160} autoComplete="address-line2" /></label>
                  <div className="acx-form__row acx-form__row--3">
                    <label><span>City</span><input name="city" required minLength={2} maxLength={60} autoComplete="address-level2" /></label>
                    <label><span>State</span><select name="state" required defaultValue="Tamil Nadu" autoComplete="address-level1">{STATES.map((x) => <option key={x}>{x}</option>)}</select></label>
                    <label><span>PIN code</span><input name="pin" required pattern="[1-9][0-9]{5}" title="6-digit PIN code" inputMode="numeric" autoComplete="postal-code" /></label>
                  </div>
                  <label className="acx-check"><input type="checkbox" name="makeDefault" defaultChecked={!addresses?.length} /> <span>Use as my default address</span></label>
                  <div className="acx-form__foot">
                    <button type="submit" className="acx-btn" disabled={busy === 'address'}>{busy === 'address' ? 'Saving…' : 'Save address'}</button>
                    <button type="button" className="acx-btn acx-btn--ghost" onClick={() => setAddrOpen(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </Card>

            {/* ---------- devices and privacy ---------- */}
            <Card id="devices" view={view} icon={Smartphone} title="Devices & privacy" count={devices?.length}>
              <p className="acx-note">You are signed in on these devices. If you see one you don’t recognise, sign it out.</p>
              {devices === null ? <p className="acx-loading">Loading…</p> : (
                <ul className="acx-addrs">
                  {devices.map((d) => (
                    <li key={d.id} className="acx-addr">
                      <span className="acx-addr__icon" aria-hidden="true">{/Windows|Mac|Linux/.test(d.device) ? <Monitor size={16} /> : <Smartphone size={16} />}</span>
                      <span className="acx-addr__body">
                        <strong>{d.device}{d.current && <span className="acx-badge">This device</span>}</strong>
                        <small>{d.current ? 'Active now' : `Last active: ${ago(d.lastSeen)}`} · signed in {date(d.signedInAt)}</small>
                      </span>
                      {!d.current && <button type="button" className="acx-addr__remove" disabled={busy === d.id} onClick={() => signOutDevice(d.id)}><LogOut size={15} /> Sign out</button>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="acx-form__foot">
                {devices?.some((d) => !d.current) && (
                  <button type="button" className="acx-btn acx-btn--ghost" disabled={busy === 'others'} onClick={signOutOthers}><LogOut size={15} /> Sign out of all other devices</button>
                )}
                <a className="acx-btn acx-btn--ghost" href={deleteHref}><Trash2 size={15} /> Request account deletion</a>
              </div>
              <p className="acx-note">Deletion requests are handled within 7 days. Invoices for past orders are kept as the law requires. <Link to="/policies/privacy">Privacy policy</Link></p>
            </Card>

            <button type="button" className="acx-logout-wide" onClick={signOut}><LogOut size={16} /> Log out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
