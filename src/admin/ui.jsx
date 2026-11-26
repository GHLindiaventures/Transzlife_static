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
export const CODSTATUS = {
  pending: ['COD: waiting for reply', 'warn'], confirmed: ['COD confirmed', 'ok'],
  no_reply: ['COD: no reply, call', 'bad'], cancel_requested: ['Customer wants to cancel', 'bad'],
};

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

// ---- Botanical Ledger helpers -------------------------------------------------

/** ₹48.2k / ₹1.2L style for KPI tiles and chart axes (Indian lakh/crore). */
export const rsCompact = (paise) => {
  const v = Number(paise || 0) / 100;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
  return `₹${Math.round(v)}`;
};

/** Light / dark theme, remembered per browser; follows the system the first time. */
export function useTheme() {
  const read = () => {
    try { const t = localStorage.getItem('tl-admin-theme'); if (t === 'light' || t === 'dark') return t; } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    try { localStorage.setItem('tl-admin-theme', theme); } catch { /* ignore */ }
    document.body.classList.toggle('adm-dark', theme === 'dark');
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/** Chart colours come from the theme's CSS tokens (validated for colour-blind safety in both themes). */
export function useChartColors(theme) {
  const [c, setC] = useState({ c1: '#1f6b3c', c2: '#b8840f', prev: '#a39f93', grid: '#ebe5d7', muted: '#6b7568' });
  useEffect(() => {
    const el = document.querySelector('.adm');
    if (!el) return;
    const s = getComputedStyle(el), v = (n) => s.getPropertyValue(n).trim();
    setC({ c1: v('--c1'), c2: v('--c2'), prev: v('--c-prev'), grid: v('--grid'), muted: v('--muted') });
  }, [theme]);
  return c;
}

/** "▲ 12%" vs the previous period. `invert` for numbers where down is good. */
export function Delta({ now, before, invert = false, points = false }) {
  if (points) {                       // rates (0..1): show the change in percentage points
    const pts = Math.round((now - before) * 100);
    if (pts === 0) return <span className="adm-delta is-flat">± 0 pts</span>;
    const good = invert ? pts < 0 : pts > 0;
    return <span className={`adm-delta ${good ? 'is-up' : 'is-down'}`} title="Change in percentage points vs the previous period">{pts > 0 ? '▲' : '▼'} {Math.abs(pts)} pts</span>;
  }
  if (!before && !now) return <span className="adm-delta is-flat">no change</span>;
  if (!before) return <span className="adm-delta is-up">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="adm-delta is-flat">± 0%</span>;
  const good = invert ? pct < 0 : pct > 0;
  return <span className={`adm-delta ${good ? 'is-up' : 'is-down'}`} title="Compared with the previous period">{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

/** Tiny trend line for a KPI tile (decorative: the number beside it is the value). */
export function Sparkline({ values = [], color = 'var(--c1)' }) {
  if (values.length < 2) return <svg className="adm-spark" aria-hidden="true" />;
  const w = 120, h = 34, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 6)}`);
  return (
    <svg className="adm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} opacity=".1" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Empty({ icon: I, title, children }) {
  return <div className="adm-empty">{I && <I size={34} strokeWidth={1.4} />}<strong>{title}</strong>{children && <span>{children}</span>}</div>;
}

/** Initials for the avatar circle. */
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ---- Shared date range (every report page) -----------------------------------------------------
// One picker, remembered across pages and visits: Today / 7 / 30 / 90 days / This month / 12 months / Custom.
// Matches server/admin/range.js. Reports compare with the period of the same length just before.
export const RANGE_OPTIONS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['month', 'This month'], ['365d', '12 months'], ['custom', 'Custom']];
const RANGE_KEY = 'tl-admin-range-v2';
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export function useRange(fallback = '30d') {
  const read = () => {
    try { const v = JSON.parse(localStorage.getItem(RANGE_KEY)); if (v?.range) return v; } catch { /* ignore */ }
    return { range: fallback, from: todayIST(), to: todayIST() };
  };
  const [value, setValue] = useState(read);
  const set = useCallback((next) => {
    setValue((v) => {
      const merged = { ...v, ...next };
      try { localStorage.setItem(RANGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, []);
  const qs = value.range === 'custom' ? `range=custom&from=${value.from}&to=${value.to}` : `range=${value.range}`;
  return { ...value, qs, set };
}

export function RangePicker({ value }) {
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const label = RANGE_OPTIONS.find(([k]) => k === value.range)?.[1];
  return (
    <div className="adm-range">
      <select className="adm-range__select" value={value.range} onChange={(e) => value.set({ range: e.target.value })} aria-label="Date range">
        {RANGE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {value.range === 'custom' ? (
        <form className="adm-range__custom" onSubmit={(e) => { e.preventDefault(); value.set(draft); }}>
          <input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} aria-label="From" required />
          <span aria-hidden="true">–</span>
          <input type="date" value={draft.to} min={draft.from} max={todayIST()} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-label="To" required />
          <button className="adm-btn is-sm">Apply</button>
        </form>
      ) : <span className="adm-range__vs">vs previous {label === 'Today' ? 'day' : label === 'This month' ? 'month' : 'period'}</span>}
    </div>
  );
}
