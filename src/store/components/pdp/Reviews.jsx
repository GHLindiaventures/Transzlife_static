import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Star, ThumbsUp, Flag, ImagePlus, X, PenLine, Check, ChevronDown, Camera, BadgeCheck, MessageSquareReply, Clock, Loader2 } from 'lucide-react';
import Stars, { StarInput } from './Stars';
import '../../styles/reviews.css';
import { saveReview, uploadReviewPhoto, markHelpful, reportReview, compressImage, MAX_FILES, MAX_IMAGE_MB } from '../../data/reviewStore';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/* ---------------- who can write ---------------- */
/** The "write a review" action, depending on who is looking (reviews come from verified buyers only). */
function WriteCta({ data, product, onWrite, big }) {
  const { pathname } = useLocation();
  const cls = big ? 'btn btn--lg' : 'btn';
  if (data.mine) return <button type="button" className={`${cls} btn--ghost`} onClick={onWrite}><PenLine size={18} /> Edit your review</button>;
  if (data.canReview) return <button type="button" className={cls} onClick={onWrite}><PenLine size={18} /> Write a review</button>;
  if (!data.signedIn) {
    return <Link className={`${cls} btn--ghost`} to={`/login?next=${encodeURIComponent(`${pathname}?review=1#reviews`)}`}>Bought {product.short}? Sign in to review</Link>;
  }
  return <p className="rv-note">You can review {product.short} once an order with it has been delivered to you.</p>;
}

/* ---------------- summary ---------------- */
function Summary({ data, product, filter, setFilter, onWrite }) {
  const { summary } = data;
  return (
    <div className="rv-sum">
      <div className="rv-sum__score">
        <strong>{summary.total ? summary.avg.toFixed(1) : '–'}</strong>
        <Stars value={summary.avg} size={20} label={summary.total ? undefined : 'No ratings yet'} />
        <span>{summary.total ? `Based on ${summary.total} verified review${summary.total === 1 ? '' : 's'}` : 'No reviews yet'}</span>
      </div>
      <ul className="rv-bars">
        {[5, 4, 3, 2, 1].map((n) => {
          const c = summary.counts[n - 1];
          const pct = summary.total ? (c / summary.total) * 100 : 0;
          return (
            <li key={n}>
              <button type="button" className={`rv-bar ${filter === n ? 'is-on' : ''}`} onClick={() => setFilter(filter === n ? 'all' : n)} disabled={!c} aria-pressed={filter === n} aria-label={`${n} star reviews: ${c}`}>
                <span className="rv-bar__n">{n} <Star size={12} /></span>
                <span className="rv-bar__track"><span style={{ width: `${pct}%` }} /></span>
                <span className="rv-bar__c">{c}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="rv-sum__cta">
        <p>Every review here is from a customer whose order was delivered.</p>
        <WriteCta data={data} product={product} onWrite={onWrite} big />
      </div>
    </div>
  );
}

/* ---------------- one review ---------------- */
const REASONS = ['Spam or advertising', 'Offensive or abusive', 'Not about this product', 'Shares private information'];

function ReviewCard({ r, onUpdate, onOpenMedia }) {
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const long = r.body.length > 240;

  if (r.reported) {
    return (
      <li className="rv-card rv-card--reported">
        <Flag size={16} /> <span>You reported this review ({r.reported.toLowerCase()}). It is hidden for you while we take a look.</span>
        <button type="button" className="rv-more" onClick={() => onUpdate(reportReview(r, null))}>Undo</button>
      </li>
    );
  }

  const vote = async () => {
    setVoteError('');
    try { onUpdate(await markHelpful(r)); } catch (e) { setVoteError(e.status === 401 ? 'Sign in to mark reviews as helpful.' : e.message); }
  };

  return (
    <li className="rv-card">
      <div className="rv-card__head">
        <span className="rv-avatar" aria-hidden="true">{initials(r.name)}</span>
        <div>
          <strong className="rv-card__name">{r.name}</strong>
          <span className="rv-card__date">
            {r.verified && <span className="rv-verified"><BadgeCheck size={13} /> Verified purchase</span>}
            {fmtDate(r.createdAt)}
          </span>
        </div>
        <Stars value={r.rating} size={15} />
      </div>
      {r.title && <h4 className="rv-card__title">{r.title}</h4>}
      <p className={`rv-card__body ${long && !more ? 'is-clamped' : ''}`}>{r.body}</p>
      {long && <button type="button" className="rv-more" onClick={() => setMore((v) => !v)}>{more ? 'Show less' : 'Read more'}</button>}

      {r.media.length > 0 && (
        <ul className="rv-media">
          {r.media.map((m, i) => (
            <li key={m.url}>
              <button type="button" className="rv-thumb" onClick={() => onOpenMedia(r, i)} aria-label={`Open photo ${i + 1} from ${r.name}`}>
                <img src={m.thumb} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {r.reply && (
        <div className="rv-reply">
          <MessageSquareReply size={15} aria-hidden="true" />
          <div><strong>Reply from TranzLife</strong><p>{r.reply.text}</p></div>
        </div>
      )}

      <div className="rv-card__foot">
        <button type="button" className={`rv-act ${r.votedHelpful ? 'is-on' : ''}`} aria-pressed={r.votedHelpful} onClick={vote}>
          <ThumbsUp size={15} /> Helpful{r.helpful ? ` (${r.helpful})` : ''}
        </button>
        <button type="button" className="rv-act rv-act--quiet" onClick={() => setReporting((v) => !v)} aria-expanded={reporting}>
          <Flag size={14} /> Report
        </button>
      </div>
      {voteError && <p className="rv-err" role="status">{voteError}</p>}
      {reporting && (
        <div className="rv-report" role="group" aria-label="Why are you reporting this review?">
          <p>Why are you reporting this review?</p>
          <div>
            {REASONS.map((x) => (
              <button type="button" key={x} className="rv-chip" onClick={() => onUpdate(reportReview(r, x))}>{x}</button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------------- lightbox ---------------- */
function Lightbox({ item, onClose }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item) { setI(item.index); if (!d.open) d.showModal(); } else if (d.open) d.close();
  }, [item]);
  const m = item?.review.media[i];
  const n = item?.review.media.length || 0;
  return (
    <dialog ref={ref} className="rv-lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Review photo">
      {m && (
        <div className="rv-lightbox__inner">
          <button type="button" className="rv-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
          <img src={m.url} alt={`Photo from ${item.review.name}'s review`} />
          {n > 1 && (
            <div className="rv-lightbox__dots">
              {item.review.media.map((_, k) => (
                <button key={k} type="button" className={k === i ? 'is-on' : ''} onClick={() => setI(k)} aria-label={`Show photo ${k + 1} of ${n}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/* ---------------- write / edit a review ---------------- */
function WriteReview({ open, product, mine, onClose, onSaved }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]); // { id, thumb } | { uploading: true, key }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setRating(mine?.rating || 0); setTitle(mine?.title || ''); setBody(mine?.body || ''); setErrors({});
      setPhotos(mine ? mine.media.map((m, k) => ({ id: mine.photoIds[k], thumb: m.thumb })) : []);
      if (!d.open) d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, mine]);

  const uploading = photos.some((x) => x.uploading);

  const addFiles = async (list) => {
    const errs = [];
    const room = MAX_FILES - photos.length;
    const picked = Array.from(list).filter((f) => {
      if (!f.type.startsWith('image/')) { errs.push(`${f.name}: only photos can be added.`); return false; }
      if (f.size > MAX_IMAGE_MB * 1e6) { errs.push(`${f.name}: photos must be under ${MAX_IMAGE_MB} MB.`); return false; }
      return true;
    });
    if (picked.length > room) errs.push(`You can add up to ${MAX_FILES} photos.`);
    setErrors((e) => ({ ...e, media: errs.join(' ') || undefined }));
    for (const f of picked.slice(0, Math.max(0, room))) {
      const key = `${f.name}-${Math.random()}`;
      setPhotos((p) => [...p, { uploading: true, key }]);
      try {
        const up = await uploadReviewPhoto(await compressImage(f));
        setPhotos((p) => p.map((x) => (x.key === key ? { id: up.id, thumb: up.thumbUrl } : x)));
      } catch (e) {
        setPhotos((p) => p.filter((x) => x.key !== key));
        setErrors((x) => ({ ...x, media: e.message }));
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!rating) errs.rating = 'Please choose a star rating.';
    if (body.trim().length < 20) errs.body = 'Please write at least 20 characters about your experience.';
    setErrors(errs);
    if (Object.keys(errs).length) { ref.current?.querySelector('[aria-invalid="true"], .star-input input')?.focus(); return; }
    setSaving(true);
    try {
      const r = await saveReview({ productId: product.id, rating, title, body, photoIds: photos.filter((x) => x.id).map((x) => x.id) });
      onSaved(r);
    } catch (err) {
      setErrors({ form: err.message || 'Sorry, your review could not be saved. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} className="rv-dialog" onClose={onClose} aria-labelledby="rv-dialog-title">
      <form className="rv-form" onSubmit={submit} noValidate>
        <div className="rv-form__head">
          <div>
            <p className="eyebrow">{mine ? 'Edit your review' : 'Write a review'}</p>
            <h2 id="rv-dialog-title">{product.short}</h2>
          </div>
          <button type="button" className="rv-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <div className="rv-field">
          <span className="rv-label">Overall rating <em>*</em></span>
          <StarInput value={rating} onChange={(n) => { setRating(n); setErrors((x) => ({ ...x, rating: undefined })); }} />
          {errors.rating && <p className="rv-err" role="alert">{errors.rating}</p>}
        </div>

        <label className="rv-field">
          <span className="rv-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Sum it up in a few words" />
        </label>

        <label className="rv-field">
          <span className="rv-label">Your review <em>*</em></span>
          <textarea value={body} onChange={(e) => { setBody(e.target.value); if (e.target.value.trim().length >= 20) setErrors((x) => ({ ...x, body: undefined })); }} rows={5} maxLength={2000} placeholder="What did you like? How long have you used it? Would you recommend it?" aria-invalid={errors.body ? 'true' : undefined} />
          <span className="rv-count">{body.trim().length}/2000</span>
          {errors.body && <p className="rv-err" role="alert">{errors.body}</p>}
        </label>

        <div className="rv-field">
          <span className="rv-label">Photos <small>optional, up to {MAX_FILES}</small></span>
          <div
            className={`rv-drop ${drag ? 'is-drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          >
            {photos.map((f, k) => (
              <div className="rv-prev" key={f.id || f.key}>
                {f.uploading ? <span className="rv-prev__busy"><Loader2 size={18} className="spin" aria-label="Uploading" /></span> : <img src={f.thumb} alt="" />}
                {!f.uploading && <button type="button" onClick={() => setPhotos(photos.filter((_, i) => i !== k))} aria-label={`Remove photo ${k + 1}`}><X size={14} /></button>}
              </div>
            ))}
            {photos.length < MAX_FILES && (
              <button type="button" className="rv-add" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={22} />
                <span>Add photo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          <p className="rv-hint"><Camera size={14} /> JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB each.</p>
          {errors.media && <p className="rv-err" role="alert">{errors.media}</p>}
        </div>

        <p className="rv-hint">Shown with your first name and initial, marked "Verified purchase". Please share your own experience and avoid medical claims, links or phone numbers: those reviews are checked by our team before they appear.</p>
        {errors.form && <p className="rv-err" role="alert">{errors.form}</p>}

        <div className="rv-form__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving || uploading}>{saving ? 'Posting…' : uploading ? 'Uploading photos…' : mine ? 'Update review' : 'Post review'}</button>
        </div>
      </form>
    </dialog>
  );
}

/* ---------------- section ---------------- */
const SORTS = { recent: 'Newest', helpful: 'Most helpful', high: 'Highest rated', low: 'Lowest rated' };
const PAGE = 4;

export default function Reviews({ product, data, onChanged }) {
  const { search } = useLocation();
  const reviews = data.reviews;
  const [filter, setFilter] = useState('all'); // 'all' | 'media' | 1..5
  const [sort, setSort] = useState('recent');
  const [writing, setWriting] = useState(false);
  const [media, setMedia] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [flash, setFlash] = useState('');
  const [local, setLocal] = useState({});     // vote / report changes made on this page

  useEffect(() => { setFilter('all'); setShown(PAGE); setLocal({}); }, [product.id]);
  // ?review=1 (from the review-request message or sign-in): open the form for buyers
  useEffect(() => {
    if (new URLSearchParams(search).get('review') === '1' && (data.canReview || data.mine)) setWriting(true);
  }, [search, data.canReview, data.mine]);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  const all = useMemo(() => reviews.map((r) => local[r.id] || r), [reviews, local]);
  const list = useMemo(() => {
    let l = all;
    if (filter === 'media') l = l.filter((r) => r.media.length);
    else if (filter !== 'all') l = l.filter((r) => r.rating === filter);
    const by = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      helpful: (a, b) => (b.helpful || 0) - (a.helpful || 0) || b.createdAt.localeCompare(a.createdAt),
      high: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
      low: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt),
    };
    return [...l].sort(by[sort]);
  }, [all, filter, sort]);

  const update = (r) => setLocal((m) => ({ ...m, [r.id]: r }));
  const withMedia = all.filter((r) => r.media.length).length;
  const pendingMine = data.mine && data.mine.status !== 'approved';

  return (
    <section className="section rv" id="reviews" aria-labelledby="rv-title">
      <div className="container">
        <div className="shead">
          <div>
            <p className="eyebrow">Customer reviews</p>
            <h2 id="rv-title">What customers say</h2>
          </div>
        </div>

        {pendingMine && (
          <p className="rv-pending" role="status"><Clock size={16} /> {data.mine.status === 'pending'
            ? 'Thanks for your review! Our team is giving it a quick check before it appears.'
            : 'Your review was not published because it did not meet our review guidelines. You can edit and post it again.'}</p>
        )}

        <div className={`rv-grid ${reviews.length ? '' : 'rv-grid--empty'}`}>
          {reviews.length > 0 && <Summary data={data} product={product} filter={filter} setFilter={(f) => { setFilter(f); setShown(PAGE); }} onWrite={() => setWriting(true)} />}

          <div className="rv-main">
            {reviews.length > 0 && (
              <div className="rv-tools">
                <div className="rv-filters" role="group" aria-label="Filter reviews">
                  <button type="button" className={`rv-chip ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>All ({reviews.length})</button>
                  {withMedia > 0 && <button type="button" className={`rv-chip ${filter === 'media' ? 'is-on' : ''}`} onClick={() => setFilter('media')}><Camera size={14} /> With photos ({withMedia})</button>}
                  {typeof filter === 'number' && <button type="button" className="rv-chip is-on" onClick={() => setFilter('all')}>{filter} <Star size={12} /> <X size={12} /></button>}
                </div>
                <label className="rv-sort">
                  <span>Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </label>
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="rv-empty">
                <span className="rv-empty__ic" aria-hidden="true"><Star size={28} /></span>
                <h3>No reviews yet</h3>
                <p>Reviews come from customers whose order has been delivered, so every one is a verified purchase.</p>
                <WriteCta data={data} product={product} onWrite={() => setWriting(true)} />
              </div>
            ) : list.length === 0 ? (
              <p className="rv-none">No reviews match this filter.</p>
            ) : (
              <>
                <ul className="rv-list">
                  {list.slice(0, shown).map((r) => (
                    <ReviewCard key={r.id} r={r} onUpdate={update} onOpenMedia={(review, index) => setMedia({ review, index })} />
                  ))}
                </ul>
                {list.length > shown && (
                  <button type="button" className="ings2__more" onClick={() => setShown((s) => s + PAGE)}>
                    Show more reviews ({list.length - shown}) <ChevronDown size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <WriteReview
        open={writing}
        product={product}
        mine={data.mine}
        onClose={() => setWriting(false)}
        onSaved={(r) => {
          setWriting(false); setFilter('all'); setSort('recent');
          setFlash(r.held ? 'Thank you! Your review will appear after a quick check.' : 'Thank you! Your review is posted.');
          onChanged();
        }}
      />
      <Lightbox item={media} onClose={() => setMedia(null)} />
      <div className={`toast ${flash ? 'is-on' : ''}`} role="status" aria-live="polite">
        {flash && <><Check size={16} /> {flash}</>}
      </div>
    </section>
  );
}
