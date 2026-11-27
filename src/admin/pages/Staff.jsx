import { useState } from 'react';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, dt, useAction, useAdmin, useApi } from '../ui';

const ROLE_HELP = {
  owner: 'Everything, including staff and shop settings',
  manager: 'Orders, refunds, products, stock, customers',
  support: 'View everything, add order notes; cannot change orders, prices or stock',
  content_manager: 'Blogs, images, SEO, redirects and website text; no access to orders, customers or payments',
};
export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', support: 'Support', content_manager: 'Content manager' };
const roleOptions = ['owner', 'manager', 'content_manager', 'support'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>);

/** Owner only: add staff, change roles, deactivate, reset passwords or 2FA. */
export default function Staff() {
  const { staff: me } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/staff');
  const act = useAction();
  const [temp, setTemp] = useState(null);          // { email, password } shown once
  const [form, setForm] = useState({ email: '', name: '', role: 'support' });

  const add = async (e) => {
    e.preventDefault();
    const r = await act.run(() => api('/api/admin/staff', { method: 'POST', body: form }));
    if (r) { setTemp({ email: form.email, password: r.tempPassword }); setForm({ email: '', name: '', role: 'support' }); reload(); }
  };
  const patch = async (s, body, msg) => { if (await act.run(() => api(`/api/admin/staff/${s.id}`, { method: 'PATCH', body }), msg)) reload(); };
  const resetPw = async (s) => {
    if (!window.confirm(`Give ${s.name} a new temporary password? They will be signed out everywhere.`)) return;
    const r = await act.run(() => api(`/api/admin/staff/${s.id}/reset-password`, { method: 'POST', body: {} }));
    if (r) { setTemp({ email: s.email, password: r.tempPassword }); reload(); }
  };
  const reset2fa = async (s) => {
    if (!window.confirm(`Turn off two-step verification for ${s.name}? They must set it up again at their next sign-in (use this if they lost their phone).`)) return;
    if (await act.run(() => api(`/api/admin/staff/${s.id}/reset-2fa`, { method: 'POST', body: {} }), '2FA reset. They will set it up again at their next sign-in.')) reload();
  };

  return (
    <>
      <PageHead title="Staff" sub="Everyone signs in with their own account and two-step verification. Every change they make is in the activity log." />
      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>
      {temp && (
        <div className="adm-temp" role="status">
          <strong>Temporary password for {temp.email}</strong>
          <code>{temp.password}</code>
          <p>Share it privately (not by email if you can avoid it). It is shown only once. They sign in at <b>{window.location.origin}/admin</b>, then set their own password and two-step verification.</p>
          <button className="adm-btn is-ghost is-sm" onClick={() => setTemp(null)}>Done</button>
        </div>
      )}
      {!data ? <Loading /> : (
        <section className="adm-card is-flush">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Role</th><th>2FA</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>{data.staff.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong>{s.id === me.id && <span className="adm-badge is-info">You</span>}<small className="adm-sub">{s.email}</small></td>
                <td>
                  <select value={s.role} onChange={(e) => patch(s, { role: e.target.value }, 'Role updated.')} disabled={act.busy} aria-label={`Role for ${s.name}`}>
                    {roleOptions}
                  </select>
                </td>
                <td>{s.totp_enabled ? <span className="adm-badge is-ok">On</span> : <span className="adm-badge is-warn">{s.must_change_password ? 'Not set up yet' : 'Off'}</span>}</td>
                <td>{dt(s.last_login_at)}{s.locked && <small className="adm-sub is-bad">Locked (too many attempts)</small>}</td>
                <td>{s.active ? <span className="adm-badge is-ok">Active</span> : <span className="adm-badge is-off">Deactivated</span>}</td>
                <td className="adm-rowbtns">
                  <button className="adm-btn is-ghost is-sm" onClick={() => resetPw(s)} disabled={act.busy}>Reset password</button>
                  {s.totp_enabled && <button className="adm-btn is-ghost is-sm" onClick={() => reset2fa(s)} disabled={act.busy}>Reset 2FA</button>}
                  {s.id !== me.id && <button className={`adm-btn is-sm ${s.active ? 'is-danger is-ghost' : 'is-ghost'}`} disabled={act.busy}
                    onClick={() => patch(s, { active: !s.active }, s.active ? `${s.name} deactivated and signed out.` : `${s.name} reactivated.`)}>{s.active ? 'Deactivate' : 'Reactivate'}</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
      <section className="adm-card">
        <h2 className="adm-h2">Add a staff member</h2>
        <form className="adm-form adm-inline-form" onSubmit={add}>
          <label>Name<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Email<input type="email" required maxLength={120} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            {roleOptions}
          </select></label>
          <button className="adm-btn" disabled={act.busy}>Add</button>
        </form>
        <p className="adm-muted">{ROLE_LABEL[form.role]}: {ROLE_HELP[form.role]}.</p>
      </section>
    </>
  );
}
