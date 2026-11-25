import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Package, ChevronRight, Trash2, Heart, Star, PenLine } from 'lucide-react';
import { useTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { statusLabel, rs } from './Checkout';
import { getProduct } from '../data/products';
import { mergeWishlist, toggleWishlist } from '../lib/wishlist';
import { myReviews } from '../data/reviewStore';
import '../styles/account.css';

const badgeClass = (s) => (s === 'pending_payment' ? 'is-warn' : ['cancelled', 'refunded', 'returned', 'rto'].includes(s) ? 'is-off' : '');
const date = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** My account: orders (newest first), saved addresses, sign out. Signed-in only (RequireAuth). */
export default function Account() {
  useTitle('My account');
  const { customer, logout, setCustomer } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders').then((r) => setOrders(r.orders)).catch((e) => { setError(e.message); setOrders([]); });
    api('/api/account/addresses').then((r) => setAddresses(r.addresses)).catch(() => setAddresses([]));
    mergeWishlist().then(setSaved);
    myReviews().then(setRv).catch(() => setRv({ toReview: [], mine: [] }));
  }, []);
  const [rv, setRv] = useState(null);
  const [saved, setSaved] = useState(null);
  const [prefBusy, setPrefBusy] = useState(false);

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

  const signOut = async () => { await logout(); navigate('/', { replace: true }); };

  return (
    <section className="container acct">
      <div className="acct__head">
        <div>
          <h1>Hello, {customer.name.split(' ')[0]}</h1>
          <p>+91 {customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}

      <h2>Your orders</h2>
      {orders === null ? <p className="acct-empty">Loading…</p> : orders.length === 0 ? (
        <p className="acct-empty">No orders yet. <Link to="/shop">Start shopping</Link></p>
      ) : (
        <ul className="acct-orders">
          {orders.map((o) => (
            <li key={o.number}>
              <Link className="acct-order" to={`/order/${o.number}`}>
                <span>
                  <strong><Package size={15} /> #{o.number}</strong>
                  <small>{date(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} item(s) · {rs(o.total)}</small>
                </span>
                <span><span className={`acct-badge ${badgeClass(o.status)}`}>{statusLabel(o.status)}</span> <ChevronRight size={16} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rv && (rv.toReview.length > 0 || rv.mine.length > 0) && (
        <>
          <h2 id="reviews">Your reviews</h2>
          {rv.toReview.length > 0 && (
            <div className="acct-saved">
              {rv.toReview.map((x) => {
                const prod = getProduct(x.id);
                return (
                  <div key={x.id}>
                    {prod?.images?.[0] && <img src={prod.images[0]} alt="" loading="lazy" />}
                    <span><Link to={`/products/${x.id}?review=1#reviews`}>{x.short || x.name}</Link><small>Delivered · how was it?</small></span>
                    <Link className="link-btn" to={`/products/${x.id}?review=1#reviews`}><PenLine size={15} /> Review</Link>
                  </div>
                );
              })}
            </div>
          )}
          {rv.mine.length > 0 && (
            <ul className="acct-orders">
              {rv.mine.map((r) => (
                <li key={r.id}>
                  <Link className="acct-order" to={`/products/${r.product_id}#reviews`}>
                    <span><strong><Star size={15} /> {r.product}</strong><small>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {date(r.created_at)}</small></span>
                    <span><span className={`acct-badge ${r.status === 'approved' ? '' : r.status === 'pending' ? 'is-warn' : 'is-off'}`}>{r.status === 'approved' ? 'Published' : r.status === 'pending' ? 'Being checked' : 'Not published'}</span> <ChevronRight size={16} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2>Saved products</h2>
      {saved === null ? <p className="acct-empty">Loading…</p> : saved.filter(getProduct).length === 0 ? (
        <p className="acct-empty">Tap the <Heart size={14} aria-label="heart" /> on a product to save it here.</p>
      ) : (
        <div className="acct-saved">
          {saved.map(getProduct).filter(Boolean).map((p) => (
            <div key={p.id}>
              <img src={p.images?.[0]} alt="" loading="lazy" />
              <span><Link to={`/products/${p.id}`}>{p.short || p.name}</Link><small>{p.format} · {p.size}</small></span>
              <button type="button" className="link-btn" onClick={() => unsave(p.id)} aria-label={`Remove ${p.name} from saved products`}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <h2>Reminders</h2>
      <div className="acct-prefs">
        <label className="check-opt">
          <input type="checkbox" checked={!!customer.marketingConsent} disabled={prefBusy} onChange={(e) => setReminders(e.target.checked)} />
          <span>Remind me on WhatsApp / SMS when it's time to restock, or if I leave items in my cart.<small>We send at most one message per order or cart. You can also reply STOP.</small></span>
        </label>
      </div>

      <h2>Saved addresses</h2>
      {addresses === null ? <p className="acct-empty">Loading…</p> : addresses.length === 0 ? (
        <p className="acct-empty">Addresses you use at checkout are saved here for next time.</p>
      ) : (
        <div className="acct-addr">
          {addresses.map((a) => (
            <div key={a.id}>
              <span><strong>{a.name}</strong><small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pin}</small><small>{a.phone}</small></span>
              <button type="button" className="link-btn" onClick={() => removeAddress(a.id)} aria-label={`Remove address for ${a.name}`}><Trash2 size={15} /> Remove</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
