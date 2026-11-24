import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, Pager, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

const ACTIONS = {
  'staff.login': 'Signed in', 'staff.password_change': 'Changed own password', 'staff.2fa_enabled': 'Turned on 2FA',
  'staff.create': 'Added staff member', 'staff.update': 'Changed staff member', 'staff.reset_password': 'Reset staff password', 'staff.reset_2fa': 'Reset staff 2FA',
  'order.status': 'Changed order status', 'order.refund': 'Refunded order', 'order.note': 'Edited order note', 'orders.export': 'Exported orders (CSV)',
  'product.update': 'Changed product', 'stock.adjust': 'Adjusted stock', 'customer.delete': 'Deleted customer data', 'settings.update': 'Changed shop settings',
};
const link = (r) => r.entity === 'order' && r.entity_id ? <Link to={`/admin/orders/${r.entity_id}`}>{r.entity_id}</Link>
  : r.entity === 'customer' && r.entity_id ? <Link to={`/admin/customers/${r.entity_id}`}>customer</Link> : (r.entity_id || '');
const show = (v) => (v == null ? '' : Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join(', '));

/** Who changed what, and when. Nothing here can be edited or deleted from the dashboard. */
export function Activity() {
  const [params, setParams] = useSearchParams();
  const entity = params.get('entity') || '', page = params.get('page') || '1';
  const { data, error } = useApi(`/api/admin/audit?${new URLSearchParams({ ...(entity ? { entity } : {}), page })}`);
  return (
    <>
      <PageHead title="Activity log" sub="Every change made in the dashboard, with who made it." />
      <div className="adm-filters">
        <select value={entity} onChange={(e) => setParams(e.target.value ? { entity: e.target.value } : {})} aria-label="Filter">
          <option value="">Everything</option><option value="order">Orders</option><option value="product">Products & stock</option>
          <option value="customer">Customers</option><option value="staff">Staff</option><option value="settings">Settings</option>
        </select>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className="adm-card is-flush">
          {data.rows.length === 0 ? <p className="adm-muted adm-pad">Nothing yet.</p> : (
            <table className="adm-table is-compact">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Item</th><th>Change</th></tr></thead>
              <tbody>{data.rows.map((r, i) => (
                <tr key={i}>
                  <td>{dt(r.created_at)}</td><td>{r.staff_email || '—'}</td><td>{ACTIONS[r.action] || r.action}</td><td>{link(r)}</td>
                  <td className="adm-diff">{r.before && <span className="is-before">{show(r.before)}</span>}{r.after && <span className="is-after">{show(r.after)}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParams({ ...(entity ? { entity } : {}), page: String(p) })} />
        </section>
      )}
    </>
  );
}

export function SettingsPage() {
  const { staff } = useAdmin();
  const { data, reload } = useApi('/api/admin/settings');
  const act = useAction();
  const pw = useAction();
  const owner = can(staff, 'settings');

  const save = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const body = { free_shipping_above: toPaise(f.free), shipping_fee: toPaise(f.fee), prepaid_discount_pct: Number(f.prepaid) };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Shop settings saved. New checkouts use them immediately.')) reload();
  };
  const changePw = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (f.next !== f.confirm) { pw.setError('The new passwords do not match.'); return; }
    if (await pw.run(() => api('/api/admin/auth/password', { method: 'POST', body: { current: f.current, next: f.next } }), 'Password changed. Other devices were signed out.')) form.reset();
  };
  const s = data?.settings;

  return (
    <>
      <PageHead title="Settings" />
      <Integrations />
      <div className="adm-grid2">
        <section className="adm-card">
          <h2 className="adm-h2">Shipping & discounts</h2>
          {!s ? <Loading /> : (
            <form className="adm-form" onSubmit={save}>
              <label>Free shipping on orders from (₹)<input name="free" type="number" min="0" step="1" defaultValue={s.free_shipping_above / 100} disabled={!owner} required /></label>
              <label>Shipping fee below that (₹)<input name="fee" type="number" min="0" step="1" defaultValue={s.shipping_fee / 100} disabled={!owner} required /></label>
              <label>Prepaid discount for UPI / card / net banking (%)<input name="prepaid" type="number" min="0" max="50" step="0.5" defaultValue={s.prepaid_discount_pct} disabled={!owner} required /></label>
              <p className="adm-muted">Now: free shipping from {rs(s.free_shipping_above)}, otherwise {rs(s.shipping_fee)}; {s.prepaid_discount_pct}% off prepaid orders.</p>
              <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
              {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
            </form>
          )}
        </section>
        <section className="adm-card">
          <h2 className="adm-h2">Your password</h2>
          <form className="adm-form" onSubmit={changePw}>
            <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
            <label>New password<input name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label>Repeat new password<input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
            <ErrorBox>{pw.error}</ErrorBox><Notice>{pw.notice}</Notice>
            <button className="adm-btn" disabled={pw.busy}>Change password</button>
          </form>
          <p className="adm-muted">Signed in as {staff.email} ({staff.role}). Lost your authenticator phone? Ask an owner to reset your 2FA.</p>
        </section>
      </div>
    </>
  );
}

const CODE_MODE = {
  'twilio-verify': ['Twilio Verify', 'ok'], 'twilio-sms': ['Twilio SMS', 'ok'], msg91: ['MSG91', 'ok'],
  none: ['Not set up: customers cannot sign in', 'bad'],
};

/** Live check of the connected services (Twilio credentials are tested against Twilio). */
function Integrations() {
  const { data, error, loading, reload } = useApi('/api/admin/integrations');
  const t = data?.twilio;
  const [codeLabel, codeTone] = CODE_MODE[data?.signInCodes] || ['…', 'off'];
  return (
    <section className="adm-card">
      <div className="adm-row"><h2 className="adm-h2">Connected services</h2><button className="adm-btn is-ghost is-sm" onClick={reload} disabled={loading}>{loading ? 'Checking…' : 'Check again'}</button></div>
      <ErrorBox>{error}</ErrorBox>
      {data && (
        <table className="adm-table is-compact">
          <tbody>
            <tr><td>Sign-in codes</td><td><span className={`adm-badge is-${codeTone}`}>{codeLabel}</span></td></tr>
            <tr><td>Twilio account</td><td>{!t.configured ? <span className="adm-badge is-off">Not configured</span>
              : t.ok ? <><span className="adm-badge is-ok">Connected</span> {t.account?.name} ({t.account?.type}, {t.account?.status}){t.verifyService && <small className="adm-sub">Verify service: {t.verifyService.name}</small>}</>
              : <><span className="adm-badge is-bad">Error</span> {t.error}{t.twilioCode ? ` (Twilio ${t.twilioCode})` : ''}</>}</td></tr>
            <tr><td>Order updates to customers</td><td>{data.orderMessages === 'off' ? <span className="adm-badge is-off">Off</span> : <span className="adm-badge is-ok">{data.orderMessages === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>}</td></tr>
            <tr><td>Online payments (Razorpay)</td><td>{data.razorpay ? <span className="adm-badge is-ok">Connected</span> : <span className="adm-badge is-off">Not configured: cash on delivery only</span>}</td></tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
