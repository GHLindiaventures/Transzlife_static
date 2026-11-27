import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, Pager, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';

const ACTIONS = {
  'content.announcement_create': 'Added bar message', 'content.announcement_update': 'Changed bar message', 'content.announcement_delete': 'Removed bar message',
  'content.announcement_style': 'Changed bar colours', 'content.home': 'Changed homepage',
  'order.cod': 'Recorded COD confirmation',
  'product.pricing': 'Changed price or badge', 'offer.create': 'Created offer', 'offer.update': 'Changed offer', 'offer.delete': 'Deleted offer', 'settings.packs': 'Changed pack discounts',
  'review.approve': 'Published review', 'review.reject': 'Rejected review', 'review.remove': 'Removed review', 'review.reply': 'Replied to review',
  'customer.cart_reminder': 'Sent cart reminder', 'customer.reorder_reminder': 'Sent refill reminder',
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
        <ReturnPolicy s={s} owner={owner} reload={reload} />
        <PaymentGateways s={s} owner={owner} reload={reload} />
        <CompanyBank s={s} owner={owner} reload={reload} />
        <MarketingSeo s={s} owner={owner} reload={reload} />
        <NotificationManager s={s} owner={owner} reload={reload} />
        <Reminders s={s} owner={owner} reload={reload} />
        <Operations s={s} owner={owner} reload={reload} />
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

/** COD confirmation by message, the owner's daily summary, and when to warn about stock running out. */
function Operations({ s, owner, reload }) {
  const act = useAction();
  const { data } = useApi('/api/admin/integrations');
  const [preview, setPreview] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const phones = String(f.phones || '').split(/[\s,]+/).map((x) => x.replace(/\D/g, '').slice(-10)).filter(Boolean);
    const body = { cod_confirmation: f.cod === 'on', stock_alert_days: Number(f.stockDays), daily_summary: { enabled: f.summary === 'on', phones, hour: Number(f.hour) } };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Saved.')) reload();
  };
  const ds = s?.daily_summary || { enabled: false, phones: [], hour: 9 };
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Orders, stock & daily summary</h2>
      {!s ? <Loading /> : (
        <form className="adm-form" onSubmit={save}>
          <label className="adm-check"><input type="checkbox" name="cod" defaultChecked={!!s.cod_confirmation} disabled={!owner} /> Ask cash-on-delivery customers to confirm (reply YES / NO)</label>
          <p className="adm-muted">Customers who don't reply within 24 hours show in "Needs your attention" so you can call them. Replies reach the site only if Twilio's "A message comes in" webhook is set to:<br />
            <code>{data?.replyWebhook || 'set SITE_URL first'}</code></p>
          <label>Warn when a product will run out within (days)<input name="stockDays" type="number" min="3" max="90" defaultValue={s.stock_alert_days ?? 14} disabled={!owner} required /></label>
          <label className="adm-check"><input type="checkbox" name="summary" defaultChecked={!!ds.enabled} disabled={!owner} /> Send a daily summary (yesterday's orders and revenue, today's to-dos)</label>
          <div className="adm-pair">
            <label>To these mobile numbers<span className="adm-sub">Up to 5, separated by commas</span><input name="phones" defaultValue={(ds.phones || []).join(', ')} disabled={!owner} placeholder="98xxxxxxxx" /></label>
            <label>At (India time)<select name="hour" defaultValue={ds.hour ?? 9} disabled={!owner}>{Array.from({ length: 17 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{h}:00</option>)}</select></label>
          </div>
          <button type="button" className="adm-btn is-ghost is-sm" onClick={async () => { try { setPreview((await api('/api/admin/daily-summary/preview')).text); } catch (e) { setPreview(e.message); } }}>Preview today's summary</button>
          {preview && <p className="adm-notice" style={{ whiteSpace: 'pre-line' }}>{preview}</p>}
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}

/** Automatic cart / refill reminders (only to customers who agreed; 9 am to 9 pm India time). */
function Reminders({ s, owner, reload }) {
  const act = useAction();
  const { data } = useApi('/api/admin/integrations');
  const save = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const body = { reminders_cart: f.cart === 'on', reminders_reorder: f.reorder === 'on', cart_reminder_hours: Number(f.hours), reorder_days: Number(f.days),
      review_requests: f.review === 'on', review_request_days: Number(f.rdays) };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Reminder settings saved.')) reload();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Cart, refill & review reminders</h2>
      {!s ? <Loading /> : (
        <form className="adm-form" onSubmit={save}>
          <p className="adm-muted">Sent by {data?.reminders === 'whatsapp' ? 'WhatsApp' : data?.reminders === 'sms' ? 'SMS' : 'SMS / WhatsApp (not set up yet)'} only to customers who ticked
            "Remind me" at checkout or in their account, between 9 am and 9 pm, at most once per cart or order. Staff can also send one from Visitors & carts or a customer's page.</p>
          <label className="adm-check"><input type="checkbox" name="cart" defaultChecked={!!s.reminders_cart} disabled={!owner} /> Remind signed-in customers about items left in their cart</label>
          <label>…after this many hours without an order<input name="hours" type="number" min="1" max="72" step="1" defaultValue={s.cart_reminder_hours ?? 4} disabled={!owner} required /></label>
          <label className="adm-check"><input type="checkbox" name="reorder" defaultChecked={!!s.reminders_reorder} disabled={!owner} /> Refill reminder after their last order</label>
          <label>…this many days after the order (how long a pack lasts)<input name="days" type="number" min="7" max="120" step="1" defaultValue={s.reorder_days ?? 30} disabled={!owner} required /></label>
          <label className="adm-check"><input type="checkbox" name="review" defaultChecked={!!s.review_requests} disabled={!owner} /> Ask for a review after delivery (products not yet reviewed)</label>
          <label>…this many days after delivery<input name="rdays" type="number" min="2" max="60" step="1" defaultValue={s.review_request_days ?? 7} disabled={!owner} required /></label>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
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
            <tr><td>Online payments (Razorpay)</td><td>{data.razorpay ? <span className="adm-badge is-ok">Connected</span> : <span className="adm-badge is-off">Not configured</span>}</td></tr>
            <tr><td>Online payments (Cashfree)</td><td>{data.cashfree ? <span className="adm-badge is-ok">Connected</span> : <span className="adm-badge is-off">Not configured</span>}</td></tr>
            <tr><td>Shipping (Shiprocket)</td><td>{data.shiprocket ? <span className="adm-badge is-ok">Connected</span> : <span className="adm-badge is-off">Not configured</span>}</td></tr>
            <tr><td>Shipping (Delhivery)</td><td>{data.delhivery ? <span className="adm-badge is-ok">Connected</span> : <span className="adm-badge is-off">Not configured</span>}</td></tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Return policy: switch customer returns on or off and set the shop-wide window. */
function ReturnPolicy({ s, owner, reload }) {
  const act = useAction();
  const save = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { returns_enabled: f.get('on') === 'on', return_window_days: Number(f.get('days')) };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Return policy saved.')) reload();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Returns</h2>
      {!s ? <Loading /> : (
        <form className="adm-form" onSubmit={save}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input name="on" type="checkbox" defaultChecked={s.returns_enabled !== false} disabled={!owner} /> Customers can request returns from their account</label>
          <label>Return window (days after delivery)<input name="days" type="number" min="0" max="90" defaultValue={s.return_window_days ?? 7} disabled={!owner} required /></label>
          <p className="adm-muted">A product can have its own window or be marked not returnable on its page (Products).</p>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}

/** Payment gateways: enable/disable Razorpay & Cashfree and choose the active provider. */
function PaymentGateways({ s, owner, reload }) {
  const act = useAction();
  const { data: integ } = useApi('/api/admin/integrations');
  const pg = s?.payment_gateways || {};
  const [rzOn, setRzOn] = useState(pg.razorpayEnabled !== false);
  const [cfOn, setCfOn] = useState(pg.cashfreeEnabled !== false);
  const [active, setActive] = useState(pg.activeProvider || 'razorpay');

  useEffect(() => {
    if (!s) return;
    const g = s.payment_gateways || {};
    setRzOn(g.razorpayEnabled !== false);
    setCfOn(g.cashfreeEnabled !== false);
    setActive(g.activeProvider || 'razorpay');
  }, [s]);

  const save = async (e) => {
    e.preventDefault();
    const body = { payment_gateways: { razorpayEnabled: rzOn, cashfreeEnabled: cfOn, activeProvider: active } };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Payment gateway settings saved.')) reload();
  };

  return (
    <section className="adm-card">
      <h2 className="adm-h2">Payment gateways</h2>
      {!s ? <Loading /> : (
        <form className="adm-form" onSubmit={save}>
          <label className="adm-check">
            <input type="checkbox" checked={rzOn} onChange={(e) => setRzOn(e.target.checked)} disabled={!owner} />
            Razorpay {integ ? (integ.razorpay ? '(Keys configured)' : '(Keys not set in env)') : ''}
          </label>
          <label className="adm-check">
            <input type="checkbox" checked={cfOn} onChange={(e) => setCfOn(e.target.checked)} disabled={!owner} />
            Cashfree {integ ? (integ.cashfree ? '(Keys configured)' : '(Keys not set in env)') : ''}
          </label>
          <label>
            Active online payment provider
            <select value={active} onChange={(e) => setActive(e.target.value)} disabled={!owner}>
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
            </select>
          </label>
          <p className="adm-muted">API keys and webhook secrets remain in backend environment variables.</p>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}

/** Company bank details printed on generated GST invoices. */
function CompanyBank({ s, owner, reload }) {
  const act = useAction();
  const bank = s?.company_bank || {};
  const save = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      company_bank: {
        accountHolder: String(f.get('accountHolder') || '').trim(),
        bankName: String(f.get('bankName') || '').trim(),
        accountNumber: String(f.get('accountNumber') || '').trim(),
        branch: String(f.get('branch') || '').trim(),
        ifsc: String(f.get('ifsc') || '').trim().toUpperCase(),
      },
    };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Bank details saved.')) reload();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2">Invoice bank details</h2>
      {!s ? <Loading /> : (
        <form key={JSON.stringify(bank)} className="adm-form" onSubmit={save}>
          <label>Account holder&apos;s name<input name="accountHolder" defaultValue={bank.accountHolder || ''} disabled={!owner} placeholder="TranzLife Wellness Pvt Ltd" /></label>
          <div className="adm-pair">
            <label>Bank name<input name="bankName" defaultValue={bank.bankName || ''} disabled={!owner} placeholder="HDFC Bank" /></label>
            <label>Branch<input name="branch" defaultValue={bank.branch || ''} disabled={!owner} placeholder="Chennai Main" /></label>
          </div>
          <div className="adm-pair">
            <label>Account number<input name="accountNumber" defaultValue={bank.accountNumber || ''} disabled={!owner} /></label>
            <label>IFSC code<input name="ifsc" defaultValue={bank.ifsc || ''} disabled={!owner} placeholder="HDFC0000001" /></label>
          </div>
          <p className="adm-muted">Shown on customer and admin GST invoices under Company&apos;s Bank Details.</p>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}

/** SEO & Marketing tracking IDs and domain verification codes. */
function MarketingSeo({ s, owner, reload }) {
  const act = useAction();
  const m = s?.marketing_tags || {};
  const save = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      marketing_tags: {
        gtmId: String(f.get('gtmId') || '').trim(),
        ga4Id: String(f.get('ga4Id') || '').trim(),
        metaPixelId: String(f.get('metaPixelId') || '').trim(),
        gscVerification: String(f.get('gscVerification') || '').trim(),
        metaDomainVerification: String(f.get('metaDomainVerification') || '').trim(),
      },
    };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'SEO & marketing tags saved.')) reload();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2">SEO &amp; marketing tags</h2>
      {!s ? <Loading /> : (
        <form key={JSON.stringify(m)} className="adm-form" onSubmit={save}>
          <div className="adm-pair">
            <label>Google Tag Manager ID<input name="gtmId" defaultValue={m.gtmId || ''} disabled={!owner} placeholder="GTM-XXXXXXX" /></label>
            <label>Google Analytics (GA4) ID<input name="ga4Id" defaultValue={m.ga4Id || ''} disabled={!owner} placeholder="G-XXXXXXXXXX" /></label>
          </div>
          <label>Meta (Facebook) Pixel ID<input name="metaPixelId" defaultValue={m.metaPixelId || ''} disabled={!owner} placeholder="123456789012345" /></label>
          <label>Google Search Console verification<input name="gscVerification" defaultValue={m.gscVerification || ''} disabled={!owner} placeholder="Verification token" /></label>
          <label>Meta domain verification<input name="metaDomainVerification" defaultValue={m.metaDomainVerification || ''} disabled={!owner} placeholder="Verification token" /></label>
          <p className="adm-muted">Loaded lazily on the storefront without blocking page render.</p>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}

const ADMIN_EVENT_LABELS = [
  ['new_order', 'New order received'],
  ['payment_confirmed', 'Payment confirmed'],
  ['payment_failed', 'Payment failed'],
  ['pending_confirmation', 'Pending payment / confirmation'],
  ['shipment_update', 'Shipment updates'],
  ['delivery_update', 'Delivery updates'],
];
const CUSTOMER_EVENT_LABELS = [
  ['confirmed', 'Order confirmed'],
  ['processing', 'Processing'],
  ['packed', 'Packed'],
  ['ready_for_pickup', 'Ready for pickup'],
  ['shipped', 'Shipped'],
  ['in_transit', 'In transit'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['delayed', 'Delayed'],
  ['delivery_failed', 'Delivery failed'],
  ['rto', 'Return to origin (RTO)'],
  ['refund_initiated', 'Refund initiated'],
  ['refunded', 'Refunded'],
  ['cancelled', 'Cancelled'],
];

/** Notification channels, admin alert recipients, event toggles and message templates. */
function NotificationManager({ s, owner, reload }) {
  const act = useAction();
  const cfg = s?.notification_config || {};
  const [channels, setChannels] = useState({
    email: cfg.channels?.email !== false,
    sms: Boolean(cfg.channels?.sms),
    whatsapp: cfg.channels?.whatsapp !== false,
  });
  const [adminEvents, setAdminEvents] = useState(() => {
    const out = {};
    for (const [k] of ADMIN_EVENT_LABELS) out[k] = cfg.adminEvents?.[k] !== false;
    return out;
  });
  const [customerEvents, setCustomerEvents] = useState(() => {
    const out = {};
    for (const [k] of CUSTOMER_EVENT_LABELS) out[k] = cfg.customerEvents?.[k] !== false;
    return out;
  });
  const [templates, setTemplates] = useState(cfg.templates || {});

  useEffect(() => {
    if (!s) return;
    const c = s.notification_config || {};
    setChannels({
      email: c.channels?.email !== false,
      sms: Boolean(c.channels?.sms),
      whatsapp: c.channels?.whatsapp !== false,
    });
    setAdminEvents(Object.fromEntries(ADMIN_EVENT_LABELS.map(([k]) => [k, c.adminEvents?.[k] !== false])));
    setCustomerEvents(Object.fromEntries(CUSTOMER_EVENT_LABELS.map(([k]) => [k, c.customerEvents?.[k] !== false])));
    setTemplates(c.templates || {});
  }, [s]);

  const save = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const splitList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
    const cleanTemplates = {};
    for (const [k, v] of Object.entries(templates)) {
      if (typeof v === 'string' && v.trim()) cleanTemplates[k] = v.trim();
    }
    const body = {
      notification_config: {
        channels,
        adminRecipients: {
          emails: splitList(f.get('adminEmails')),
          phones: splitList(f.get('adminPhones')),
        },
        adminEvents,
        customerEvents,
        templates: cleanTemplates,
      },
    };
    if (await act.run(() => api('/api/admin/settings', { method: 'PATCH', body }), 'Notification settings saved.')) reload();
  };

  return (
    <section className="adm-card" style={{ gridColumn: '1 / -1' }}>
      <h2 className="adm-h2">Notifications &amp; templates</h2>
      {!s ? <Loading /> : (
        <form key={JSON.stringify(cfg.adminRecipients || {})} className="adm-form" onSubmit={save}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <label className="adm-check"><input type="checkbox" checked={channels.email} onChange={(e) => setChannels({ ...channels, email: e.target.checked })} disabled={!owner} /> Email</label>
            <label className="adm-check"><input type="checkbox" checked={channels.whatsapp} onChange={(e) => setChannels({ ...channels, whatsapp: e.target.checked })} disabled={!owner} /> WhatsApp</label>
            <label className="adm-check"><input type="checkbox" checked={channels.sms} onChange={(e) => setChannels({ ...channels, sms: e.target.checked })} disabled={!owner} /> SMS</label>
          </div>
          <div className="adm-pair">
            <label>Admin alert emails (comma-separated)<input name="adminEmails" defaultValue={(cfg.adminRecipients?.emails || []).join(', ')} disabled={!owner} placeholder="ops@tranzlife.in" /></label>
            <label>Admin alert phones (comma-separated)<input name="adminPhones" defaultValue={(cfg.adminRecipients?.phones || []).join(', ')} disabled={!owner} placeholder="9150394443" /></label>
          </div>
          <div className="adm-pair">
            <div>
              <strong style={{ display: 'block', marginBottom: 6 }}>Admin alerts</strong>
              <div style={{ display: 'grid', gap: 6 }}>
                {ADMIN_EVENT_LABELS.map(([k, label]) => (
                  <label key={k} className="adm-check">
                    <input type="checkbox" checked={adminEvents[k]} onChange={(e) => setAdminEvents({ ...adminEvents, [k]: e.target.checked })} disabled={!owner} /> {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <strong style={{ display: 'block', marginBottom: 6 }}>Customer notifications</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6 }}>
                {CUSTOMER_EVENT_LABELS.map(([k, label]) => (
                  <label key={k} className="adm-check">
                    <input type="checkbox" checked={customerEvents[k]} onChange={(e) => setCustomerEvents({ ...customerEvents, [k]: e.target.checked })} disabled={!owner} /> {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Custom customer message templates (optional)</summary>
            <p className="adm-muted" style={{ marginTop: 6 }}>Leave blank for default text. Placeholders: <code>{'{order_number}'}</code>, <code>{'{customer_name}'}</code>, <code>{'{total}'}</code>, <code>{'{courier}'}</code>, <code>{'{awb}'}</code>, <code>{'{edd}'}</code>, <code>{'{tracking_url}'}</code></p>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {CUSTOMER_EVENT_LABELS.map(([k, label]) => (
                <label key={k}>{label}
                  <input
                    value={templates[k] || ''}
                    onChange={(e) => setTemplates({ ...templates, [k]: e.target.value })}
                    disabled={!owner}
                    placeholder={`Default ${label.toLowerCase()} message`}
                  />
                </label>
              ))}
            </div>
          </details>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {owner ? <button className="adm-btn" disabled={act.busy}>Save</button> : <p className="adm-muted">Only an owner can change these.</p>}
        </form>
      )}
    </section>
  );
}
