import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { useTitle } from '../components/Common';
import { useAuth, safeNext } from '../context/AuthContext';
import { getBuyNow } from '../lib/checkoutIntent';
import { getProduct } from '../data/products';
import { useCatalog } from '../lib/catalog';
import { api } from '../lib/api';
import '../styles/account.css';

/**
 * Sign in or create an account with a one-time code (like Amazon / Flipkart).
 *   1. mobile number  ->  2. 6-digit code  ->  3. name (new accounts only)  ->  back to `next`
 * `next` is where the customer was going (e.g. /checkout?buy=now), so checkout continues
 * exactly where it left off.
 */
export default function Login() {
  useCatalog();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'), '/account');
  const toCheckout = next.startsWith('/checkout');
  useTitle(toCheckout ? 'Sign in to check out' : 'Sign in');
  const { customer, ready, setCustomer } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('phone');      // phone | code | profile
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef(null);

  // countdown for "Resend code"
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // signed in but no name yet (came back mid-sign-up): ask for it
  useEffect(() => {
    if (ready && customer && !customer.name && step === 'phone') setStep('profile');
  }, [ready, customer, step]);

  // already signed in with a name: go straight on
  if (ready && customer?.name && step !== 'profile') return <Navigate to={next} replace />;

  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit mobile number.'); return; }
    setBusy(true);
    try {
      const r = await api('/api/auth/otp/request', { method: 'POST', body: { phone } });
      setResendIn(r.resendIn || 30);
      setCode('');
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setError('');
    if (!/^\d{6}$/.test(value)) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      const r = await api('/api/auth/otp/verify', { method: 'POST', body: { phone, code: value } });
      setCustomer(r.customer);
      if (!r.customer.name) setStep('profile');
      else navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const r = await api('/api/account', { method: 'PATCH', body: { name: form.name, email: form.email || '' } });
      setCustomer(r.customer);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const buyNow = toCheckout && next.includes('buy=now') ? getBuyNow() : null;
  const buyNowProduct = buyNow && getProduct(buyNow.id);

  return (
    <section className="container auth-page">
      <div className="auth-card">
        {toCheckout && (
          <p className="auth-step-hint"><Lock size={14} /> Sign in to continue to secure checkout</p>
        )}
        {buyNowProduct && (
          <div className="auth-item">
            <span className="auth-item__thumb" style={{ background: buyNowProduct.tint }}><img src={buyNowProduct.images[0]} alt="" /></span>
            <span><strong>{buyNowProduct.short}</strong><small>{buyNowProduct.size}{buyNow.pack > 1 ? ` · Pack of ${buyNow.pack}` : ''} · Qty {buyNow.qty}</small></span>
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={sendCode} className="form auth-form" noValidate>
            <h1>Sign in or create an account</h1>
            <p className="auth-sub">Enter your mobile number. We'll send a 6-digit code by SMS, no password needed.</p>
            <label>Mobile number
              <span className="auth-phone">
                <span className="auth-phone__cc">+91</span>
                <input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile"
                  maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} autoFocus required />
              </span>
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn btn--lg btn--block" disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</button>
            <p className="auth-fine">By continuing you agree to our <Link to="/policies/terms">terms</Link> and <Link to="/policies/privacy">privacy policy</Link>.</p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="form auth-form" noValidate>
            <button type="button" className="link-btn auth-back" onClick={() => { setStep('phone'); setError(''); }}><ArrowLeft size={14} /> Change number</button>
            <h1>Enter the code</h1>
            <p className="auth-sub"><Smartphone size={15} /> We sent an SMS to <strong>+91 {phone.slice(0, 5)} {phone.slice(5)}</strong>. It expires in 5 minutes.</p>
            <label>6-digit code
              <input ref={codeRef} className="auth-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} placeholder="••••••" required
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6 && !busy) verify(v);   // submit as soon as the code is complete
                }} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn btn--lg btn--block" disabled={busy}>{busy ? 'Checking…' : toCheckout ? 'Verify & continue to checkout' : 'Verify & sign in'}</button>
            <p className="auth-resend">
              {resendIn > 0
                ? <>Didn't get it? Resend in {resendIn}s</>
                : <button type="button" className="link-btn" onClick={sendCode} disabled={busy}>Resend code</button>}
            </p>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={saveProfile} className="form auth-form">
            <h1>Welcome to TranzLife</h1>
            <p className="auth-sub">Just your name and we're done.</p>
            <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" autoFocus defaultValue={customer?.name || ''} /></label>
            <label>Email (optional, for order updates)<input name="email" type="email" autoComplete="email" maxLength={120} defaultValue={customer?.email || ''} /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn btn--lg btn--block" disabled={busy}>{busy ? 'Saving…' : toCheckout ? 'Continue to checkout' : 'Create account'}</button>
          </form>
        )}

        <p className="auth-trust"><ShieldCheck size={15} /> Your details are encrypted and never shared.</p>
      </div>
    </section>
  );
}
