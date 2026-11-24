// Shared pieces for the admin dashboard.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../store/lib/api';

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);
export const can = (staff, perm) => !!staff?.permissions?.includes(perm);

export const rs = (paise) => {
  const v = Number(paise || 0) / 100;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const d = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const STATUS = {
  pending_payment: ['Awaiting payment', 'warn'], confirmed: ['To pack', 'info'], packed: ['Packed', 'info'],
  shipped: ['Shipped', 'go'], out_for_delivery: ['Out for delivery', 'go'], delivered: ['Delivered', 'ok'],
  cancelled: ['Cancelled', 'off'], refunded: ['Refunded', 'off'], returned: ['Returned', 'off'], rto: ['Returned to us (RTO)', 'off'],
};
export const PAYSTATUS = {
  pending: ['Pending', 'warn'], paid: ['Paid', 'ok'], cod_pending: ['COD, not collected', 'info'], failed: ['Failed', 'bad'],
  expired: ['Expired', 'off'], refunded: ['Refunded', 'off'], partially_refunded: ['Part refunded', 'warn'],
  created: ['Started', 'warn'],
};
export const METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', cod: 'COD' };

export function Badge({ map = STATUS, value }) {
  const [label, tone] = map[value] || [value, 'off'];
  return <span className={`adm-badge is-${tone}`}>{label}</span>;
}

/** Fetches JSON from the admin API; `reload()` refetches. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const seq = useRef(0);
  const reload = useCallback(() => {
    if (!path) return;
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    api(path).then((data) => n === seq.current && setState({ data, error: '', loading: false }))
      .catch((e) => n === seq.current && setState({ data: null, error: e.message, loading: false }));
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export function Pager({ page, pages, total, onPage }) {
  if (pages <= 1) return <p className="adm-muted adm-pager">{total} total</p>;
  return (
    <div className="adm-pager">
      <span className="adm-muted">{total} total · page {page} of {pages}</span>
      <button className="adm-btn is-ghost is-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <button className="adm-btn is-ghost is-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export const Loading = () => <p className="adm-muted">Loading…</p>;
export const ErrorBox = ({ children }) => (children ? <p className="adm-error" role="alert">{children}</p> : null);
export const Notice = ({ children }) => (children ? <p className="adm-notice" role="status">{children}</p> : null);

export function PageHead({ title, sub, children }) {
  return (
    <div className="adm-head">
      <div><h1>{title}</h1>{sub && <p className="adm-muted">{sub}</p>}</div>
      {children && <div className="adm-head__actions">{children}</div>}
    </div>
  );
}

/** Runs an async action with busy/error/notice state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const run = useCallback(async (fn, okMessage) => {
    setBusy(true); setError(''); setNotice('');
    try { const r = await fn(); if (okMessage) setNotice(typeof okMessage === 'function' ? okMessage(r) : okMessage); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }, []);
  return { busy, error, notice, run, setError, setNotice };
}
