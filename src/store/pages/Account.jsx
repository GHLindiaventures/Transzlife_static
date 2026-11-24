import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Package, ChevronRight, Trash2 } from 'lucide-react';
import { useTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { statusLabel, rs } from './Checkout';
import '../styles/account.css';

const badgeClass = (s) => (s === 'pending_payment' ? 'is-warn' : ['cancelled', 'refunded', 'returned', 'rto'].includes(s) ? 'is-off' : '');
const date = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** My account: orders (newest first), saved addresses, sign out. Signed-in only (RequireAuth). */
export default function Account() {
  useTitle('My account');
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders').then((r) => setOrders(r.orders)).catch((e) => { setError(e.message); setOrders([]); });
    api('/api/account/addresses').then((r) => setAddresses(r.addresses)).catch(() => setAddresses([]));
  }, []);

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
