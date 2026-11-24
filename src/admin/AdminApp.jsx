// TranzLife admin dashboard (/admin). Staff only: separate sign-in with two-step verification.
// Lazy-loaded, so shoppers never download it. The server checks every permission again.
import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, Users, CreditCard, UserCog, History, Settings, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { api } from '../store/lib/api';
import { AdminContext, can, ErrorBox, useAdmin } from './ui';
import Dashboard from './pages/Dashboard';
import { OrderList, OrderDetail } from './pages/Orders';
import Products from './pages/Products';
import { CustomerList, CustomerDetail } from './pages/Customers';
import Payments from './pages/Payments';
import Staff from './pages/Staff';
import { Activity, SettingsPage } from './pages/System';
import './admin.css';

export default function AdminApp() {
  const [staff, setStaff] = useState(undefined);       // undefined = checking, null = signed out
  const refresh = useCallback(async () => {
    try { const r = await api('/api/admin/auth/me'); setStaff(r.staff); return r.staff; }
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
    return () => { m.remove(); document.body.classList.remove('adm-body'); };
  }, [refresh]);

  if (staff === undefined) return <div className="adm adm-center"><p className="adm-muted">Loading…</p></div>;
  const ready = staff && !staff.mustChangePassword && staff.totpEnabled;

  return (
    <AdminContext.Provider value={{ staff, setStaff, refresh, logout }}>
      <div className="adm">
        {!staff ? <Login /> : !ready ? <Setup /> : (
          <Shell>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<OrderList />} />
              <Route path="orders/:number" element={<OrderDetail />} />
              <Route path="products" element={<Products />} />
              <Route path="customers" element={<CustomerList />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="payments" element={<Payments />} />
              {can(staff, 'staff') && <Route path="staff" element={<Staff />} />}
              <Route path="activity" element={<Activity />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Shell>
        )}
      </div>
    </AdminContext.Provider>
  );
}

function Shell({ children }) {
  const { staff, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const links = [
    ['/admin', 'Dashboard', LayoutDashboard, true],
    ['/admin/orders', 'Orders', Package],
    ['/admin/products', 'Products & stock', Boxes],
    ['/admin/customers', 'Customers', Users],
    ['/admin/payments', 'Payments', CreditCard],
    can(staff, 'staff') && ['/admin/staff', 'Staff', UserCog],
    ['/admin/activity', 'Activity log', History],
    ['/admin/settings', 'Settings', Settings],
  ].filter(Boolean);
  return (
    <div className={`adm-shell ${open ? 'is-open' : ''}`}>
      <aside className="adm-side">
        <div className="adm-brand">
          <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" width="30" height="30" />
          <span>TranzLife <small>Admin</small></span>
          <button className="adm-icon adm-side__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav onClick={() => setOpen(false)}>
          {links.map(([to, label, I, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `adm-nav ${isActive ? 'is-active' : ''}`}><I size={17} /> {label}</NavLink>
          ))}
        </nav>
        <div className="adm-me">
          <span><strong>{staff.name}</strong><small>{staff.role}</small></span>
          <button className="adm-icon" title="Sign out" aria-label="Sign out" onClick={async () => { await logout(); navigate('/admin'); }}><LogOut size={17} /></button>
        </div>
      </aside>
      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span>TranzLife Admin</span>
        </header>
        <main className="adm-content">{children}</main>
      </div>
    </div>
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
        <div className="adm-brand is-lg"><img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" width="36" height="36" /><span>TranzLife <small>Admin</small></span></div>
        {!needsCode ? (
          <>
            <h1>Staff sign in</h1>
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
            <h1><ShieldCheck size={22} /> Turn on two-step verification</h1>
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
