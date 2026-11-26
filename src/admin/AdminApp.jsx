// TranzLife admin dashboard (/admin). Staff only: separate sign-in with two-step verification.
// Lazy-loaded, so shoppers never download it. The server checks every permission again.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Package, Boxes, Users, CreditCard, UserCog, History, Settings, LogOut, Menu, X, ShieldCheck,
  Search, Bell, Moon, Sun, MoreHorizontal, Activity as ActivityIcon, ArrowRight, User, CheckCircle2, Undo2, BarChart3, Sprout, Star, BadgePercent, Megaphone, TicketPercent, ShieldCheck as Shield,
} from 'lucide-react';
import { api } from '../store/lib/api';
import { markStaffBrowser } from '../store/lib/track';
import { AdminContext, can, ErrorBox, initials, rs, useAdmin, useTheme, STATUS } from './ui';
import Dashboard from './pages/Dashboard';
import { OrderList, OrderDetail, PrintSlips } from './pages/Orders';
import Products from './pages/Products';
import ProductEditor from './pages/ProductEditor';
import { CustomerList, CustomerDetail } from './pages/Customers';
import Payments from './pages/Payments';
import Returns from './pages/Returns';
import Analytics from './pages/Analytics';
import Visitors from './pages/Visitors';
import ReviewsAdmin from './pages/ReviewsAdmin';
import PricingOffers from './pages/PricingOffers';
import WebsiteContent from './pages/WebsiteContent';
import Discounts from './pages/Discounts';
import Ingredients from './pages/Ingredients';
import Compliance from './pages/Compliance';
import Staff from './pages/Staff';
import { Activity, SettingsPage } from './pages/System';
import SystemHealth from './pages/SystemHealth';
import './admin.css';

export default function AdminApp() {
  const [staff, setStaff] = useState(undefined);       // undefined = checking, null = signed out
  const [theme, toggleTheme] = useTheme();
  const refresh = useCallback(async () => {
    try { const r = await api('/api/admin/auth/me'); setStaff(r.staff); if (r.staff) markStaffBrowser(); return r.staff; }
    catch { setStaff(null); return null; }
  }, []);
  const logout = useCallback(async () => {
    try { await api('/api/admin/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
    setStaff(null);
  }, []);

  useEffect(() => {
    refresh();
    document.title = 'TranzLife Admin';
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    document.body.classList.add('adm-body');
    return () => { m.remove(); document.body.classList.remove('adm-body', 'adm-dark'); };
  }, [refresh]);

  const ready = staff && !staff.mustChangePassword && staff.totpEnabled;

  return (
    <AdminContext.Provider value={{ staff, setStaff, refresh, logout, theme, toggleTheme }}>
      <div className="adm" data-theme={theme}>
        {staff === undefined ? <div className="adm-center"><p className="adm-muted">Loading…</p></div>
          : !staff ? <Login /> : !ready ? <Setup /> : (
            <Routes>
              <Route path="orders/print" element={<PrintSlips />} />
              <Route path="*" element={
                <Shell>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="orders" element={<OrderList />} />
                    <Route path="orders/:number" element={<OrderDetail />} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/:id" element={<ProductEditor />} />
                    <Route path="customers" element={<CustomerList />} />
                    <Route path="customers/:id" element={<CustomerDetail />} />
                    <Route path="payments" element={<Payments />} />
                    <Route path="returns" element={<Returns />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="visitors" element={<Visitors />} />
                    <Route path="reviews" element={<ReviewsAdmin />} />
                    <Route path="pricing" element={<PricingOffers />} />
                    <Route path="content" element={<WebsiteContent />} />
                    <Route path="discounts" element={<Discounts />} />
                    <Route path="ingredients" element={<Ingredients />} />
                    <Route path="compliance" element={<Compliance />} />
                    {can(staff, 'staff') && <Route path="staff" element={<Staff />} />}
                    <Route path="activity" element={<Activity />} />
                    <Route path="health" element={<SystemHealth />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </Shell>
              } />
            </Routes>
          )}
      </div>
    </AdminContext.Provider>
  );
}

/** Live counts for the sidebar badges and the bell (refreshed every minute and on page change). */
function useLive() {
  const [live, setLive] = useState({ counts: {}, alerts: [], returns: 0, reviews: 0 });
  const location = useLocation();
  const load = useCallback(() => {
    Promise.all([api('/api/admin/orders/counts'), api('/api/admin/alerts'), api('/api/admin/returns/counts'), api('/api/admin/reviews/counts')])
      .then(([c, a, r, v]) => setLive({ counts: c.counts, alerts: a.items, returns: r.counts.open, reviews: v.pending })).catch(() => {});
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { load(); }, [location.pathname, load]);
  return live;
}

function Shell({ children }) {
  const { staff, logout, theme, toggleTheme } = useAdmin();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);
  const live = useLive();
  const navigate = useNavigate();
  const location = useLocation();
  const toPack = live.counts.to_pack || 0;
  const alertCount = live.alerts.reduce((n, a) => n + (a.tone === 'muted' ? 0 : 1), 0);

  useEffect(() => { setOpen(false); setBell(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = [
    [null, [['/admin', 'Home', Home, { end: true }]]],
    ['Sell', [['/admin/orders', 'Orders', Package, { count: toPack, title: `${toPack} to pack` }], ['/admin/returns', 'Returns', Undo2, { count: live.returns, title: `${live.returns} open returns` }], ['/admin/payments', 'Payments', CreditCard]]],
    ['Catalog', [['/admin/products', 'Products & stock', Boxes], ['/admin/pricing', 'Pricing & offers', BadgePercent], ['/admin/reviews', 'Reviews', Star, { count: live.reviews, title: `${live.reviews} waiting for a check` }], ['/admin/ingredients', 'Ingredients', Sprout], ['/admin/compliance', 'Licences & certificates', Shield]]],
    ['Marketing', [['/admin/content', 'Website content', Megaphone]]],
    ['Insights', [['/admin/analytics', 'Sales analytics', BarChart3], ['/admin/visitors', 'Visitors & carts', ActivityIcon], ['/admin/discounts', 'Discounts & campaigns', TicketPercent]]],
    ['People', [['/admin/customers', 'Customers', Users], can(staff, 'staff') && ['/admin/staff', 'Staff', UserCog]]],
    ['Settings', [['/admin/settings', 'Store settings', Settings], ['/admin/health', 'System health', ShieldCheck], ['/admin/activity', 'Activity log', History]]],
  ];

  return (
    <div className={`adm-shell ${open ? 'is-open' : ''}`}>
      <aside className="adm-side" aria-label="Main navigation">
        <Link to="/admin" className="adm-brand">
          <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" width="32" height="32" />
          <span>TranzLife <small>Seller</small></span>
        </Link>
        {groups.map(([label, links]) => (
          <nav className="adm-navgroup" key={label || 'home'} aria-label={label || 'Home'}>
            {label && <span>{label}</span>}
            {links.filter(Boolean).map(([to, text, I, opt = {}]) => (
              <NavLink key={to} to={to} end={opt.end} className={({ isActive }) => `adm-nav ${isActive ? 'is-active' : ''}`} title={text}>
                <I size={18} /> <span className="adm-nav__label">{text}</span>
                {opt.count > 0 && <b className="adm-nav__count" title={opt.title}>{opt.count}</b>}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="adm-me">
          <span className="adm-avatar" aria-hidden="true">{initials(staff.name)}</span>
          <span><strong>{staff.name}</strong><small>{staff.role}</small></span>
          <button className="adm-icon" title="Sign out" aria-label="Sign out" onClick={async () => { await logout(); navigate('/admin'); }}><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-icon adm-top__menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <button className="adm-search-btn" onClick={() => setPalette(true)} aria-label="Search orders, customers and products">
            <Search size={16} /> <span>Search orders, customers, products…</span> <kbd>Ctrl K</kbd>
          </button>
          <div className="adm-top__right">
            <button className="adm-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="adm-icon" onClick={() => setBell((b) => !b)} aria-label={`Alerts${alertCount ? `, ${alertCount}` : ''}`} aria-expanded={bell}>
                <Bell size={19} />{alertCount > 0 && <span className="adm-dot">{alertCount}</span>}
              </button>
              {bell && <AlertsPopover items={live.alerts} onClose={() => setBell(false)} />}
            </div>
          </div>
        </header>
        <main className="adm-content" id="main">{children}</main>
      </div>

      <nav className="adm-tabbar" aria-label="Quick navigation">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'is-active' : '')}><Home size={20} />Home</NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? 'is-active' : '')}><Package size={20} />Orders{toPack > 0 && <span className="adm-dot">{toPack}</span>}</NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'is-active' : '')}><Boxes size={20} />Products</NavLink>
        <button onClick={() => setBell(true)}><Bell size={20} />Alerts{alertCount > 0 && <span className="adm-dot">{alertCount}</span>}</button>
        <button onClick={() => setOpen(true)}><MoreHorizontal size={20} />More</button>
      </nav>
      {open && <button className="adm-overlay" aria-label="Close menu" onClick={() => setOpen(false)} style={{ border: 0 }} />}
      {open && <button className="adm-icon" onClick={() => setOpen(false)} aria-label="Close menu" style={{ position: 'fixed', top: 12, left: 'min(290px, calc(100vw - 46px))', zIndex: 61, color: '#fff' }}><X size={22} /></button>}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

function AlertsPopover({ items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('click', away), 0);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div className="adm-pop" ref={ref} role="dialog" aria-label="Alerts">
      <p className="adm-eyebrow adm-pop__title">Needs your attention</p>
      {items.length === 0 ? <p className="adm-muted adm-pad" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={18} className="is-ok" /> All clear. Nothing waiting.</p> : (
        <div className="adm-list" style={{ gap: 2 }}>
          {items.map((a) => (
            <Link key={a.key} to={a.to} className="adm-result" onClick={onClose}>
              <strong style={{ fontFamily: 'var(--f-display)', fontSize: 20, minWidth: 28 }} className={`is-${a.tone}`}>{a.count}</strong>
              <span><strong>{a.label}</strong>{a.detail && <span className="adm-sub">{a.detail}</span>}</span>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ctrl+K: jump to any order, customer, product or page. */
function CommandPalette({ onClose }) {
  const { staff } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [active, setActive] = useState(0);
  const pages = [
    ['Home', '/admin', Home], ['Orders', '/admin/orders', Package], ['Orders to pack', '/admin/orders?stage=to_pack', Package],
    ['Products & stock', '/admin/products', Boxes], ['Customers', '/admin/customers', Users], ['Returns', '/admin/returns', Undo2], ['Analytics', '/admin/analytics', BarChart3], ['Ingredients', '/admin/ingredients', Sprout], ['Licences & certificates', '/admin/compliance', Shield], ['Payments', '/admin/payments', CreditCard],
    can(staff, 'staff') && ['Staff', '/admin/staff', UserCog], ['Activity log', '/admin/activity', History], ['Settings', '/admin/settings', Settings],
  ].filter(Boolean);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => api(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal }).then(setRes).catch(() => {}), 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const items = [
    ...(res?.orders || []).map((o) => ({ group: 'Orders', key: o.order_number, icon: Package, title: o.order_number, sub: o.name, meta: `${STATUS[o.status]?.[0] || o.status} · ${rs(o.total)}`, to: `/admin/orders/${o.order_number}` })),
    ...(res?.customers || []).map((c) => ({ group: 'Customers', key: c.id, icon: User, title: c.name || '(no name yet)', sub: `+91 ${c.phone}${c.email ? ` · ${c.email}` : ''}`, to: `/admin/customers/${c.id}` })),
    ...(res?.products || []).map((p) => ({ group: 'Products', key: p.id, icon: Boxes, title: p.name, sub: p.size, meta: `${p.available} available`, to: '/admin/products' })),
    ...pages.filter(([t]) => !q || t.toLowerCase().includes(q.toLowerCase())).map(([t, to, I]) => ({ group: 'Go to', key: to, icon: I, title: t, to })),
  ];
  const go = (it) => { onClose(); navigate(it.to); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && items[active]) go(items[active]);
  };
  let lastGroup = null;
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <div className="adm-palette" role="dialog" aria-label="Search">
        <div className="adm-palette__input">
          <Search size={18} />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
            placeholder="Order number, customer name or phone, product…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="adm-results" />
          <kbd className="adm-muted" style={{ fontSize: 11 }}>Esc</kbd>
        </div>
        <div className="adm-palette__list" id="adm-results" role="listbox">
          {q.trim().length >= 2 && res && !res.orders.length && !res.customers.length && !res.products.length && <p className="adm-muted adm-pad">No orders, customers or products match “{q}”.</p>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <p className="adm-eyebrow adm-palette__group" key={`g-${it.group}`}>{it.group}</p> : null;
            lastGroup = it.group;
            const I = it.icon;
            return [head, (
              <button key={`${it.group}-${it.key}`} className={`adm-result ${i === active ? 'is-on' : ''}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                <I size={17} /><span><strong>{it.title}</strong>{it.sub && <span className="adm-sub">{it.sub}</span>}</span>{it.meta && <em>{it.meta}</em>}
              </button>
            )];
          })}
        </div>
      </div>
    </>
  );
}

function Login() {
  const { setStaff } = useAdmin();
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api('/api/admin/auth/login', { method: 'POST', body: { email: form.email, password: form.password, ...(needsCode ? { code: form.code } : {}) } });
      if (r.needsCode) setNeedsCode(true); else setStaff(r.staff);
    } catch (err) {
      setError(err.message);
      if (needsCode) setForm((f) => ({ ...f, code: '' }));
    } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="adm-center">
      <form className="adm-card adm-auth" onSubmit={submit}>
        <div className="adm-brand"><img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" width="38" height="38" /><span>TranzLife <small>Seller</small></span></div>
        {!needsCode ? (
          <>
            <h1>Welcome back</h1>
            <p className="adm-muted">Sign in to manage orders, products and customers.</p>
            <label>Email<input type="email" autoComplete="username" value={form.email} onChange={set('email')} required autoFocus /></label>
            <label>Password<input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required /></label>
          </>
        ) : (
          <>
            <h1>Two-step verification</h1>
            <p className="adm-muted">Enter the 6-digit code from your authenticator app.</p>
            <label>Code<input className="adm-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} required autoFocus /></label>
          </>
        )}
        <ErrorBox>{error}</ErrorBox>
        <button className="adm-btn is-block" disabled={busy}>{busy ? 'Checking…' : needsCode ? 'Verify' : 'Continue'}</button>
        {needsCode && <button type="button" className="adm-link" onClick={() => { setNeedsCode(false); setError(''); }}>Use a different account</button>}
      </form>
    </div>
  );
}

/** First sign-in: replace the temporary password, then turn on two-step verification. */
function Setup() {
  const { staff, refresh, logout } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState('');

  const changePassword = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (f.next !== f.confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await api('/api/admin/auth/password', { method: 'POST', body: { current: f.current, next: f.next } }); await refresh(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (staff.mustChangePassword || staff.totpEnabled || qr) return;
    api('/api/admin/auth/2fa/setup', { method: 'POST', body: {} }).then(setQr).catch((e) => setError(e.message));
  }, [staff, qr]);
  const enable = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api('/api/admin/auth/2fa/enable', { method: 'POST', body: { code } }); await refresh(); }
    catch (err) { setError(err.message); setCode(''); } finally { setBusy(false); }
  };

  return (
    <div className="adm-center">
      <div className="adm-card adm-auth">
        <p className="adm-steps"><span className={staff.mustChangePassword ? 'is-on' : 'is-done'}>1. Password</span><span className={!staff.mustChangePassword ? 'is-on' : ''}>2. Two-step verification</span></p>
        {staff.mustChangePassword ? (
          <form onSubmit={changePassword} className="adm-form">
            <h1>Set your password</h1>
            <p className="adm-muted">Replace the temporary password you were given. Use at least 10 characters with letters and numbers.</p>
            <label>Temporary password<input name="current" type="password" autoComplete="current-password" required autoFocus /></label>
            <label>New password<input name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label>Repeat new password<input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
            <ErrorBox>{error}</ErrorBox>
            <button className="adm-btn is-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
          </form>
        ) : (
          <form onSubmit={enable} className="adm-form">
            <h1><ShieldCheck size={24} /> Turn on two-step verification</h1>
            <ol className="adm-muted adm-ol">
              <li>Install an authenticator app: Google Authenticator, Microsoft Authenticator or Authy.</li>
              <li>In the app, add an account and scan this QR code.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            {qr ? (
              <div className="adm-qr">
                <img src={qr.qr} alt="QR code for your authenticator app" width="200" height="200" />
                <details><summary>Can't scan? Enter this key instead</summary><code>{qr.secret.match(/.{1,4}/g).join(' ')}</code></details>
              </div>
            ) : <p className="adm-muted">Preparing…</p>}
            <label>6-digit code<input className="adm-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
            <ErrorBox>{error}</ErrorBox>
            <button className="adm-btn is-block" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Turn on and continue'}</button>
          </form>
        )}
        <button type="button" className="adm-link" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
