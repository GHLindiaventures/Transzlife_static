// Review moderation: clean reviews publish on their own; held and reported ones wait here.
// Reject / remove always needs a content reason. There is no "negative review" reason on purpose.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, Check, X, Trash2, MessageSquareReply, BadgeCheck, Flag, Search, ShieldAlert } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Empty, ErrorBox, Loading, Notice, PageHead, Pager, can, dt, useAction, useAdmin, useApi } from '../ui';

const TABS = [['pending', 'Waiting for a check'], ['reported', 'Reported'], ['approved', 'Published'], ['rejected', 'Rejected'], ['removed', 'Removed']];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function ReviewsAdmin() {
  const { staff } = useAdmin();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'pending';
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(params.get('q') || '');
  const qs = new URLSearchParams({ status, page, ...(params.get('product') ? { product: params.get('product') } : {}), ...(params.get('rating') ? { rating: params.get('rating') } : {}),
    ...(params.get('q') ? { q: params.get('q') } : {}), ...(params.get('photos') ? { photos: '1' } : {}) });
  const { data, error, reload } = useApi(`/api/admin/reviews?${qs}`);
  const act = useAction();
  const [sel, setSel] = useState([]);
  const edit = can(staff, 'products.edit');
  const setParam = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n); setPage(1); setSel([]); };

  const moderate = async (ids, next, reason) => {
    const body = { status: next, ...(reason ? { reason } : {}) };
    const done = ids.length === 1
      ? await act.run(() => api(`/api/admin/reviews/${ids[0]}/status`, { method: 'POST', body }), next === 'approved' ? 'Published.' : next === 'rejected' ? 'Rejected.' : 'Removed.')
      : await act.run(() => api('/api/admin/reviews/bulk', { method: 'POST', body: { ids, ...body } }), `${ids.length} reviews updated.`);
    if (done) { setSel([]); reload(); }
  };

  return (
    <>
      <PageHead title="Reviews" sub="Every review is from a customer whose order was delivered. Clean reviews publish automatically; suspicious ones wait here." />
      {data && <ProductRatings products={data.products} onPick={(id) => setParam('product', id)} active={params.get('product')} />}

      <div className="adm-tabs" role="tablist" aria-label="Review status">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={status === k} className={`adm-tab ${status === k ? 'is-on' : ''} ${k === 'pending' && data?.counts?.pending ? 'is-hot' : ''}`} onClick={() => setParam('status', k)}>
            {l} <b>{data?.counts?.[k] ?? '…'}</b>
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }} role="search">
          <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search review text or customer" aria-label="Search reviews" />
        </form>
        <select value={params.get('product') || ''} onChange={(e) => setParam('product', e.target.value)} aria-label="Product">
          <option value="">All products</option>
          {data?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={params.get('rating') || ''} onChange={(e) => setParam('rating', e.target.value)} aria-label="Rating">
          <option value="">Any rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
        </select>
        <label className="adm-check"><input type="checkbox" checked={!!params.get('photos')} onChange={(e) => setParam('photos', e.target.checked ? '1' : '')} /> With photos</label>
      </div>

      <ErrorBox>{error || act.error}</ErrorBox><Notice>{act.notice}</Notice>
      {edit && sel.length > 0 && (
        <div className="adm-bulk" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <strong>{sel.length} selected</strong>
          <button className="adm-btn is-sm" disabled={act.busy} onClick={() => moderate(sel, 'approved')}><Check size={14} /> Publish</button>
          <RejectMenu reasons={data.rejectReasons} label="Reject" busy={act.busy} onPick={(r) => moderate(sel, 'rejected', r)} />
          <button className="adm-btn is-ghost is-sm" onClick={() => setSel([])}>Clear</button>
        </div>
      )}

      {!data ? <Loading /> : data.rows.length === 0 ? (
        <Empty icon={Star} title={status === 'pending' ? 'Nothing waiting for a check' : 'No reviews here'}>{status === 'pending' ? 'Clean reviews from verified buyers are published automatically.' : null}</Empty>
      ) : (
        <>
          <ul className="adm-stack" style={{ listStyle: 'none', padding: 0 }}>
            {data.rows.map((r) => (
              <ReviewRow key={r.id} r={r} data={data} edit={edit} replyOk={can(staff, 'orders.note')} busy={act.busy} selected={sel.includes(r.id)}
                onSelect={(on) => setSel((s) => (on ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                onModerate={(next, reason) => moderate([r.id], next, reason)} onReplied={reload} />
            ))}
          </ul>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function ProductRatings({ products, onPick, active }) {
  return (
    <div className="adm-kpis is-6" style={{ marginBottom: 14 }}>
      {products.map((p) => (
        <button key={p.id} type="button" className="adm-kpi" onClick={() => onPick(active === p.id ? '' : p.id)} aria-pressed={active === p.id}
          style={{ textAlign: 'left', cursor: 'pointer', outline: active === p.id ? '2px solid var(--brand)' : undefined }}>
          <div className="adm-kpi__label"><span className="adm-eyebrow">{p.name.replace(/^TranzLife /, '')}</span></div>
          <strong className="tabular">{p.count ? p.avg.toFixed(1) : '–'} <small style={{ fontSize: 14, color: 'var(--muted)' }}>★</small></strong>
          <div className="adm-kpi__foot">{p.count} review{p.count === 1 ? '' : 's'}{p.low30d ? ` · ${p.low30d} low (1–2★) this month` : ''}</div>
        </button>
      ))}
    </div>
  );
}

function RejectMenu({ reasons, label, busy, onPick, danger }) {
  return (
    <details className="adm-menu">
      <summary className={`adm-btn is-ghost is-sm ${danger ? 'is-danger' : ''}`}>{danger ? <Trash2 size={14} /> : <X size={14} />} {label}</summary>
      <div className="adm-pop" style={{ width: 260 }}>
        <p className="adm-eyebrow adm-pop__title">Why?</p>
        {Object.entries(reasons).map(([k, l]) => <button key={k} type="button" className="adm-result" disabled={busy} onClick={(e) => { e.currentTarget.closest('details').open = false; onPick(k); }}><span>{l}</span></button>)}
        <p className="adm-muted" style={{ padding: '6px 12px 10px', fontSize: 12 }}>Unhappy but genuine reviews stay published. Reply to them instead.</p>
      </div>
    </details>
  );
}

function ReviewRow({ r, data, edit, replyOk, busy, selected, onSelect, onModerate, onReplied }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(r.reply || '');
  const act = useAction();
  const saveReply = async () => { if (await act.run(() => api(`/api/admin/reviews/${r.id}/reply`, { method: 'POST', body: { reply: text } }), 'Reply saved.')) { setReplying(false); onReplied(); } };
  return (
    <li className="adm-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {edit && r.status !== 'removed' && <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="Select review" style={{ marginTop: 4 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="adm-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span>
              <span style={{ color: 'var(--gold-2, #b8840f)', letterSpacing: 1 }} aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</span>{' '}
              <Link to={`/admin/products/${r.product_id}`}><strong>{r.product}</strong></Link>
            </span>
            <span className="adm-muted">{dt(r.updated_at)}</span>
          </div>
          <p className="adm-muted" style={{ margin: '4px 0 8px' }}>
            <Link to={`/admin/customers/${r.customer_id}`}>{r.customer}</Link> (shown as "{r.display_name}")
            {r.verified && <> · <BadgeCheck size={13} style={{ verticalAlign: -2, color: 'var(--brand)' }} /> Verified purchase</>}
            {r.order_number && <> · order <Link to={`/admin/orders/${r.order_number}`}>{r.order_number}</Link></>}
          </p>
          {r.hold_reasons.length > 0 && r.status === 'pending' && (
            <p className="adm-badge is-warn" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><ShieldAlert size={13} /> Held: {r.hold_reasons.map((h) => data.holdLabels[h] || h).join(' · ')}</p>
          )}
          {r.reports.length > 0 && <p className="adm-muted" style={{ margin: '0 0 8px' }}><Flag size={13} style={{ verticalAlign: -2 }} /> Reported: {r.reports.map((x) => `${x.reason} (${x.n})`).join(', ')}</p>}
          {r.reject_reason && r.status !== 'approved' && <p className="adm-muted" style={{ margin: '0 0 8px' }}>{r.status === 'removed' ? 'Removed' : 'Rejected'}: {data.rejectReasons[r.reject_reason] || r.reject_reason} · by {r.moderated_by}</p>}
          {r.title && <h3 className="adm-h3" style={{ margin: '0 0 4px' }}>{r.title}</h3>}
          <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{r.body}</p>
          {r.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {r.photos.map((m) => <a key={m.url} href={m.url} target="_blank" rel="noreferrer"><img src={m.thumb} alt="Customer photo" style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} /></a>)}
            </div>
          )}
          {r.reply && !replying && <p style={{ margin: '10px 0 0', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-2)' }}><MessageSquareReply size={14} style={{ verticalAlign: -2 }} /> <strong>Our reply:</strong> {r.reply}</p>}
          {replying && (
            <div className="adm-form" style={{ marginTop: 10 }}>
              <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank them, or explain what you will do. Shown publicly under the review." aria-label="Public reply" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn is-sm" disabled={act.busy} onClick={saveReply}>Save reply</button>
                <button className="adm-btn is-ghost is-sm" onClick={() => setReplying(false)}>Cancel</button>
                {r.reply && <button className="adm-btn is-ghost is-sm" onClick={() => setText('')}>Clear</button>}
              </div>
            </div>
          )}
          <ErrorBox>{act.error}</ErrorBox>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {edit && r.status !== 'approved' && r.status !== 'removed' && <button className="adm-btn is-sm" disabled={busy} onClick={() => onModerate('approved')}><Check size={14} /> Publish</button>}
            {edit && r.status !== 'rejected' && r.status !== 'removed' && <RejectMenu reasons={data.rejectReasons} label="Reject" busy={busy} onPick={(reason) => onModerate('rejected', reason)} />}
            {replyOk && r.status === 'approved' && !replying && <button className="adm-btn is-ghost is-sm" onClick={() => setReplying(true)}><MessageSquareReply size={14} /> {r.reply ? 'Edit reply' : 'Reply'}</button>}
            {edit && r.status !== 'removed' && <RejectMenu reasons={data.rejectReasons} label="Remove" danger busy={busy} onPick={(reason) => { if (confirm('Remove this review for good? Its photos are deleted and the customer cannot post it again.')) onModerate('removed', reason); }} />}
          </div>
        </div>
      </div>
    </li>
  );
}
