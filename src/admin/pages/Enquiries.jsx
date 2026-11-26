// Contact enquiries & newsletter subscribers: view website enquiries, mark handled/spam, export newsletter list.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Download, Check, Ban, RotateCcw, Search, MessageSquare } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Badge, Empty, ErrorBox, Loading, Notice, PageHead, Pager, can, dt, useAction, useAdmin, useApi } from '../ui';

const STATUS = {
  new: ['New', 'warn'],
  handled: ['Handled', 'ok'],
  spam: ['Spam', 'off'],
};
const TABS = [['new', 'New'], ['handled', 'Handled'], ['spam', 'Spam'], ['all', 'All']];

export default function Enquiries() {
  const { staff } = useAdmin();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'new';
  const page = params.get('page') || '1';
  const qParam = params.get('q') || '';
  const [q, setQ] = useState(qParam);
  const qs = new URLSearchParams({ status, page, ...(qParam ? { q: qParam } : {}) }).toString();
  const { data, error, reload } = useApi(`/api/admin/enquiries?${qs}`);
  const act = useAction();
  const edit = can(staff, 'orders.note');

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n);
  };

  const setStatus = async (id, next) => {
    const label = next === 'handled' ? 'Marked as handled.' : next === 'spam' ? 'Marked as spam.' : 'Reopened.';
    if (await act.run(() => api(`/api/admin/enquiries/${id}`, { method: 'PATCH', body: { status: next } }), label)) reload();
  };

  return (
    <>
      <PageHead title="Enquiries & newsletter" sub="Messages from the website contact form and active newsletter subscribers.">
        <a className="adm-btn is-ghost" href="/api/admin/newsletter.csv"><Download size={16} /> Export subscribers</a>
      </PageHead>

      <div className="adm-tabs" role="tablist" aria-label="Enquiry status">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={status === k}
            className={`adm-tab ${status === k ? 'is-on' : ''} ${k === 'new' && data?.counts?.new > 0 ? 'is-hot' : ''}`}
            onClick={() => setParam('status', k)}
          >
            {label} <b>{data?.counts?.[k] ?? '…'}</b>
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }} role="search">
          <Search size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, topic or message" aria-label="Search enquiries" />
        </form>
      </div>

      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      {!data ? <Loading /> : (
        <div className="adm-grid2 is-wide-left">
          <section className="adm-card is-flush">
            {data.rows.length === 0 ? (
              <Empty icon={MessageSquare} title={status === 'new' ? 'No new enquiries' : 'No enquiries here'}>
                {status !== 'all' && <button className="adm-link" onClick={() => setParam('status', 'all')}>See all enquiries</button>}
              </Empty>
            ) : (
              <div className="adm-tablewrap">
                <table className="adm-table">
                  <thead><tr><th>When</th><th>Customer</th><th>Details</th><th>Status</th>{edit && <th />}</tr></thead>
                  <tbody>{data.rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dt(r.created_at)}</td>
                      <td>
                        <strong>{r.name}</strong>
                        <span className="adm-sub">{r.email} · +91 {r.phone}</span>
                        {r.city && <span className="adm-sub">{r.city} · Prefers {r.method || 'Phone'}</span>}
                      </td>
                      <td>
                        {(r.topic || r.product) && <span className="adm-sub" style={{ marginTop: 0, fontWeight: 600 }}>{[r.topic, r.product].filter(Boolean).join(' · ')}</span>}
                        <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{r.message || '—'}</p>
                      </td>
                      <td><Badge map={STATUS} value={r.status} /></td>
                      {edit && (
                        <td className="adm-rowbtns" style={{ whiteSpace: 'nowrap' }}>
                          {r.status !== 'handled' && <button className="adm-btn is-sm" disabled={act.busy} onClick={() => setStatus(r.id, 'handled')}><Check size={14} /> Handle</button>}
                          {r.status !== 'spam' && <button className="adm-btn is-ghost is-sm" disabled={act.busy} onClick={() => setStatus(r.id, 'spam')}><Ban size={14} /> Spam</button>}
                          {r.status !== 'new' && <button className="adm-btn is-ghost is-sm" disabled={act.busy} onClick={() => setStatus(r.id, 'new')}><RotateCcw size={14} /> Reopen</button>}
                        </td>
                      )}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParam('page', String(p))} />
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-h2"><Mail size={17} /> Newsletter subscribers</h2>
              <strong className="tabular">{data.newsletter.total}</strong>
            </div>
            {data.newsletter.recent.length === 0 ? (
              <p className="adm-muted">No subscribers yet.</p>
            ) : (
              <ul className="adm-list">
                {data.newsletter.recent.map((s) => (
                  <li key={s.email} className="adm-row">
                    <span><strong>{s.email}</strong><span className="adm-sub">{s.source} · {dt(s.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
