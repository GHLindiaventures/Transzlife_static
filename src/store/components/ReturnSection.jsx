import { useCallback, useEffect, useRef, useState } from 'react';
import { PackageX, Undo2, X, ImagePlus, Loader2, CheckCircle2, Info } from 'lucide-react';
import { loadOrderReturns, requestReturn, uploadReturnPhoto, compressImage, returnTone } from '../data/returnStore';
import { fmtDate } from '../utils/format';
import '../styles/returns.css';

const STATUS_HINT = {
  requested: 'We have your request and will review it shortly.',
  under_review: 'Our team is looking at your request.',
  approved: 'Approved. We will arrange the pickup.',
  pickup_scheduled: 'Pickup is arranged. Please keep the product ready.',
  received: 'We have received the product and are checking it.',
  refund_initiated: 'Your refund has been started. It reaches you in 5 to 7 working days.',
  resolved: 'All done.',
  rejected: 'We could not accept this return.',
};

/** One return: status chip, items, reason and the step-by-step history. */
function ReturnCard({ r }) {
  return (
    <li className="rtn-card">
      <div className="rtn-card__head">
        <strong>{r.number}</strong>
        <span className={`acct-badge ${returnTone(r)}`}>{r.label}</span>
      </div>
      <p className="rtn-card__items">{r.items.map((i) => `${i.qty} × ${i.name}${i.pack > 1 ? ` (pack of ${i.pack})` : ''}`).join(', ')}</p>
      <p className="rtn-card__hint">
        {r.status === 'rejected' && r.rejectReason ? <>Reason: {r.rejectReason}</>
          : r.status === 'resolved' && r.resolution === 'replacement' ? 'A replacement is on its way.'
            : r.status === 'resolved' && r.resolution === 'no_action' ? 'This return is closed.'
              : STATUS_HINT[r.status]}
        {r.status === 'pickup_scheduled' && r.pickupAt && <> Pickup date: <strong>{fmtDate(r.pickupAt)}</strong>.</>}
      </p>
      <ol className="rtn-steps" aria-label="Return history">
        {r.history.map((h, i) => (
          <li key={i}><span>{fmtDate(h.at)}</span><b>{h.status === 'resolved' ? 'Refund / closed' : STATUS_LABELS[h.status] || h.status}</b>{h.note && <em>{h.note}</em>}</li>
        ))}
      </ol>
      {r.photos.length > 0 && (
        <ul className="rtn-photos">{r.photos.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noreferrer"><img src={p.thumb} alt="Photo you attached" loading="lazy" /></a></li>)}</ul>
      )}
    </li>
  );
}
const STATUS_LABELS = { requested: 'Return requested', under_review: 'Under review', approved: 'Approved', pickup_scheduled: 'Pickup scheduled', received: 'Returned to us', refund_initiated: 'Refund initiated', rejected: 'Rejected' };

/** The "Return Product" dialog: choose products and quantities, a reason, an optional description and photos. */
function ReturnForm({ number, data, onClose, onDone }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const { policy, reasons, photoReasons, maxPhotos } = data;
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);       // { id, thumb } | { uploading, key }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const chosen = Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ orderItemId: Number(id), qty: n }));
  const needsPhoto = photoReasons.includes(reason);
  const uploading = photos.some((p) => p.uploading);

  const addFiles = async (list) => {
    setError('');
    const room = maxPhotos - photos.length;
    const picked = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (!picked.length) { if (list.length) setError(`Add photos only (up to ${maxPhotos}).`); return; }
    const pending = picked.map((f, i) => ({ uploading: true, key: `${Date.now()}-${i}` }));
    setPhotos((p) => [...p, ...pending]);
    await Promise.all(picked.map(async (f, i) => {
      try {
        const up = await uploadReturnPhoto(await compressImage(f));
        setPhotos((p) => p.map((x) => (x.key === pending[i].key ? { id: up.id, thumb: up.thumbUrl } : x)));
      } catch (e) {
        setPhotos((p) => p.filter((x) => x.key !== pending[i].key));
        setError(e.message);
      }
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!chosen.length) return setError('Choose at least one product to return.');
    if (!reason) return setError('Choose a reason for the return.');
    if (reason === 'other' && note.trim().length < 5) return setError('Please tell us a little more about why you are returning it.');
    if (needsPhoto && !photos.some((p) => p.id)) return setError('Please add a photo of the product or parcel so we can process this quickly.');
    setBusy(true);
    try {
      const r = await requestReturn(number, { items: chosen, reason, note: note.trim(), photoIds: photos.filter((p) => p.id).map((p) => p.id) });
      onDone(r.number);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <dialog ref={ref} className="rtn-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Return a product">
      <form className="rtn-form" onSubmit={submit} noValidate>
        <header>
          <h2>Return a product</h2>
          <button type="button" className="rtn-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <p className="rtn-policy"><Info size={16} aria-hidden="true" /> You can return eligible products within <strong>{policy.windowDays} days</strong> of delivery. Opened or used products may not be accepted unless they arrived damaged or wrong.</p>

        <fieldset>
          <legend>What are you returning?</legend>
          <ul className="rtn-lines">
            {policy.items.map((i) => (
              <li key={i.orderItemId} className={i.returnable ? '' : 'is-off'}>
                <div>
                  <strong>{i.name}</strong>
                  <small>{i.size}{i.pack > 1 ? ` · pack of ${i.pack}` : ''} · bought {i.bought}</small>
                  {i.returnable > 0 ? (i.returnBy && <small>Return by {fmtDate(i.returnBy)}</small>) : <small className="rtn-why">{i.why}</small>}
                </div>
                {i.returnable > 0 && (
                  <select value={qty[i.orderItemId] || 0} onChange={(e) => setQty({ ...qty, [i.orderItemId]: Number(e.target.value) })} aria-label={`How many ${i.name} to return`}>
                    <option value={0}>Keep</option>
                    {Array.from({ length: i.returnable }, (_, n) => <option key={n + 1} value={n + 1}>Return {n + 1}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </fieldset>

        <label>Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Tell us more {reason === 'other' ? '' : '(optional)'}
          <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What went wrong? Anything our team should know?" />
        </label>

        <div className="rtn-photo-box">
          <span>Photos {needsPhoto ? '(required for this reason)' : '(optional)'}</span>
          <ul>
            {photos.map((p) => (
              <li key={p.id || p.key}>
                {p.uploading ? <Loader2 size={20} className="rtn-spin" aria-label="Uploading" /> : (
                  <>
                    <img src={p.thumb} alt="" />
                    <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((x) => x !== p))}><X size={14} /></button>
                  </>
                )}
              </li>
            ))}
            {photos.length < maxPhotos && (
              <li><button type="button" className="rtn-add" onClick={() => fileRef.current?.click()}><ImagePlus size={20} /><span>Add</span></button></li>
            )}
          </ul>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {error && <p className="rtn-error" role="alert">{error}</p>}
        <div className="rtn-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || uploading}>{busy ? 'Sending…' : 'Submit return request'}</button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * Returns block for the order page: the policy for this order, the "Return Product" button (delivered and
 * eligible only), and every return already made with its live status.
 */
export default function ReturnSection({ order }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState('');
  const delivered = ['delivered', 'returned'].includes(order.status);
  const load = useCallback(() => loadOrderReturns(order.number).then(setData).catch(() => setData(null)), [order.number]);
  useEffect(() => { if (delivered) load(); }, [delivered, load]);

  if (!delivered || !data) return null;
  const { policy, returns } = data;
  const blocked = policy.items.filter((i) => i.why && i.returnable === 0 && !/Already part/.test(i.why));

  return (
    <section className="rtn" id="returns" aria-labelledby="rtn-title">
      <h2 id="rtn-title"><Undo2 size={20} aria-hidden="true" /> Returns</h2>
      {sent && <p className="rtn-sent" role="status"><CheckCircle2 size={18} /> Return request {sent} sent. We will keep you updated here.</p>}

      {policy.canReturn ? (
        <>
          <p className="rtn-lead">Not right? You can return eligible products within {policy.windowDays} days of delivery.</p>
          <button type="button" className="btn" onClick={() => { setSent(''); setOpen(true); }}><Undo2 size={16} /> Return Product</button>
        </>
      ) : (
        <p className="rtn-lead"><PackageX size={16} aria-hidden="true" /> {blocked[0]?.why || (returns.length ? 'Everything eligible on this order is already in a return request.' : 'No product on this order can be returned right now.')}</p>
      )}
      {policy.canReturn && blocked.length > 0 && (
        <ul className="rtn-blocked">{blocked.map((i) => <li key={i.orderItemId}><strong>{i.name}</strong>: {i.why}</li>)}</ul>
      )}
      {returns.length > 0 && <ul className="rtn-list">{returns.map((r) => <ReturnCard key={r.id} r={r} />)}</ul>}

      {open && <ReturnForm number={order.number} data={data} onClose={() => setOpen(false)} onDone={(n) => { setOpen(false); setSent(n); load(); }} />}
    </section>
  );
}
