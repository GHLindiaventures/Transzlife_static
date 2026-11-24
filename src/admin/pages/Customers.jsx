import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, ErrorBox, Loading, METHOD, PageHead, Pager, can, d, dt, rs, useAction, useAdmin, useApi } from '../ui';

export function CustomerList() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '', page = params.get('page') || '1';
  const { data, error } = useApi(`/api/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page })}`);
  const [term, setTerm] = useState(q);
  return (
    <>
      <PageHead title="Customers" />
      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); setParams(term.trim() ? { q: term.trim() } : {}); }}>
          <input type="search" placeholder="Name, phone or email" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search customers" />
        </form>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <section className="adm-card is-flush">
          {data.rows.length === 0 ? <p className="adm-muted adm-pad">No customers found.</p> : (
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th className="num">Orders</th><th className="num">Spent</th></tr></thead>
              <tbody>{data.rows.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/admin/customers/${c.id}`}><strong>{c.name || '(no name yet)'}</strong></Link></td>
                  <td>+91 {c.phone}</td><td>{c.email || '—'}</td><td>{d(c.created_at)}</td>
                  <td className="num">{c.orders}</td><td className="num">{rs(c.spent)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParams({ ...(q ? { q } : {}), page: String(p) })} />
        </section>
      )}
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { staff } = useAdmin();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(`/api/admin/customers/${id}`);
  const act = useAction();
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const { customer: c, orders, addresses } = data;

  const remove = async () => {
    const typed = window.prompt(`This permanently removes ${c.name}'s name, email, phone and saved addresses (their orders stay for tax records). Type DELETE to confirm.`);
    if (typed !== 'DELETE') return;
    if (await act.run(() => api(`/api/admin/customers/${c.id}/delete`, { method: 'POST', body: {} }))) { reload(); navigate(`/admin/customers/${c.id}`, { replace: true }); }
  };

  return (
    <>
      <Link to="/admin/customers" className="adm-link adm-back"><ArrowLeft size={15} /> Customers</Link>
      <PageHead title={c.name || '(no name yet)'} sub={c.deleted_at ? `Personal data deleted ${dt(c.deleted_at)}` : `Customer since ${d(c.created_at)} · last sign-in ${dt(c.last_login_at)}`}>
        {can(staff, 'customers.edit') && !c.deleted_at && <button className="adm-btn is-danger is-ghost" disabled={act.busy} onClick={remove}>Delete personal data</button>}
      </PageHead>
      <ErrorBox>{act.error}</ErrorBox>
      <div className="adm-grid2 is-wide-left">
        <section className="adm-card is-flush">
          <h2 className="adm-h2 adm-pad">Orders</h2>
          {orders.length === 0 ? <p className="adm-muted adm-pad">No orders.</p> : (
            <table className="adm-table">
              <thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>{orders.map((o) => (
                <tr key={o.order_number}><td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link></td><td>{dt(o.created_at)}</td><td>{METHOD[o.payment_method]}</td><td><Badge value={o.status} /></td><td className="num">{rs(o.total)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
        <section className="adm-card">
          <h2 className="adm-h2">Contact</h2>
          <p>{c.deleted_at ? <span className="adm-muted">Deleted</span> : <>+91 {c.phone}<br />{c.email || <span className="adm-muted">No email</span>}</>}</p>
          <h2 className="adm-h2">Saved addresses</h2>
          {addresses.length === 0 ? <p className="adm-muted">None.</p> : (
            <ul className="adm-list">{addresses.map((a, i) => (
              <li key={i}><strong>{a.name}</strong>{a.is_default && <span className="adm-badge is-info">Default</span>}<small className="adm-sub">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pin} · {a.phone}</small></li>
            ))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
