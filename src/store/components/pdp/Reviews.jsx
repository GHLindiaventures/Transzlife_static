import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, ThumbsUp, Flag, ImagePlus, X, Play, PenLine, Check, ChevronDown, Camera } from 'lucide-react';
import Stars, { StarInput } from './Stars';
import { addReview, markHelpful, reportReview, compressImage, MAX_FILES, MAX_IMAGE_MB, MAX_VIDEO_MB } from '../../data/reviewStore';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/** Object URLs for stored blobs; revoked when the list changes. */
function useBlobUrls(media) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const u = (media || []).map((m) => URL.createObjectURL(m.blob));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [media]);
  return urls;
}

/* ---------------- summary ---------------- */
function Summary({ summary, filter, setFilter, onWrite }) {
  return (
    <div className="rv-sum">
      <div className="rv-sum__score">
        <strong>{summary.total ? summary.avg.toFixed(1) : '–'}</strong>
        <Stars value={summary.avg} size={20} label={summary.total ? undefined : 'No ratings yet'} />
        <span>{summary.total ? `Based on ${summary.total} review${summary.total === 1 ? '' : 's'}` : 'No reviews yet'}</span>
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
        <p>Tried it? Share your experience to help others choose.</p>
        <button type="button" className="btn btn--lg" onClick={onWrite}><PenLine size={18} /> Write a review</button>
      </div>
    </div>
  );
}

/* ---------------- one review ---------------- */
const REASONS = ['Spam or advertising', 'Offensive or abusive', 'Not about this product', 'Shares private information'];

function ReviewCard({ r, onUpdate, onOpenMedia }) {
  const urls = useBlobUrls(r.media);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  const long = r.body.length > 240;

  if (r.reported) {
    return (
      <li className="rv-card rv-card--reported">
        <Flag size={16} /> <span>You reported this review ({r.reported.toLowerCase()}). It is hidden for you while we take a look.</span>
        <button type="button" className="rv-more" onClick={() => onUpdate(reportReview(r, null))}>Undo</button>
      </li>
    );
  }

  return (
    <li className="rv-card">
      <div className="rv-card__head">
        <span className="rv-avatar" aria-hidden="true">{initials(r.name)}</span>
        <div>
          <strong className="rv-card__name">{r.name}</strong>
          <span className="rv-card__date">{fmtDate(r.createdAt)}</span>
        </div>
        <Stars value={r.rating} size={15} />
      </div>
      {r.title && <h4 className="rv-card__title">{r.title}</h4>}
      <p className={`rv-card__body ${long && !more ? 'is-clamped' : ''}`}>{r.body}</p>
      {long && <button type="button" className="rv-more" onClick={() => setMore((v) => !v)}>{more ? 'Show less' : 'Read more'}</button>}

      {urls.length > 0 && (
        <ul className="rv-media">
          {r.media.map((m, i) => (
            <li key={urls[i] || i}>
              <button type="button" className="rv-thumb" onClick={() => onOpenMedia(r, i)} aria-label={`Open ${m.type} ${i + 1} from ${r.name}`}>
                {m.type === 'video'
                  ? <><video src={urls[i]} muted preload="metadata" /><span className="rv-thumb__play"><Play size={16} /></span></>
                  : <img src={urls[i]} alt="" loading="lazy" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rv-card__foot">
        <button type="button" className={`rv-act ${r.votedHelpful ? 'is-on' : ''}`} aria-pressed={r.votedHelpful} onClick={async () => onUpdate(await markHelpful(r))}>
          <ThumbsUp size={15} /> Helpful{r.helpful ? ` (${r.helpful})` : ''}
        </button>
        <button type="button" className="rv-act rv-act--quiet" onClick={() => setReporting((v) => !v)} aria-expanded={reporting}>
          <Flag size={14} /> Report
        </button>
      </div>
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
  const urls = useBlobUrls(item?.review.media);
  const [i, setI] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item) { setI(item.index); if (!d.open) d.showModal(); } else if (d.open) d.close();
  }, [item]);
  const m = item?.review.media[i];
  const n = item?.review.media.length || 0;
  return (
    <dialog ref={ref} className="rv-lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Review photo or video">
      {m && urls[i] && (
        <div className="rv-lightbox__inner">
          <button type="button" className="rv-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
          {m.type === 'video' ? <video src={urls[i]} controls autoPlay playsInline /> : <img src={urls[i]} alt={`Photo from ${item.review.name}'s review`} />}
          {n > 1 && (
            <div className="rv-lightbox__dots">
              {item.review.media.map((_, k) => (
                <button key={k} type="button" className={k === i ? 'is-on' : ''} onClick={() => setI(k)} aria-label={`Show item ${k + 1} of ${n}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/* ---------------- write a review ---------------- */
function WriteReview({ open, product, onClose, onSaved }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]); // { type, blob, name, url }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setRating(0); setTitle(''); setBody(''); setName(''); setFiles([]); setErrors({});
  };

  const addFiles = async (list) => {
    const errs = [];
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { errs.push(`You can add up to ${MAX_FILES} photos or videos.`); break; }
      const isVideo = f.type.startsWith('video/');
      const isImage = f.type.startsWith('image/');
      if (!isVideo && !isImage) { errs.push(`${f.name}: only photos and videos can be added.`); continue; }
      if (isImage && f.size > MAX_IMAGE_MB * 1e6) { errs.push(`${f.name}: photos must be under ${MAX_IMAGE_MB} MB.`); continue; }
      if (isVideo && f.size > MAX_VIDEO_MB * 1e6) { errs.push(`${f.name}: videos must be under ${MAX_VIDEO_MB} MB.`); continue; }
      const blob = isImage ? await compressImage(f) : f;
      next.push({ type: isVideo ? 'video' : 'image', blob, name: f.name, url: URL.createObjectURL(blob) });
    }
    setFiles(next);
    setErrors((e) => ({ ...e, media: errs.join(' ') || undefined }));
  };

  const removeFile = (k) => {
    URL.revokeObjectURL(files[k].url);
    setFiles(files.filter((_, i) => i !== k));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!rating) errs.rating = 'Please choose a star rating.';
    if (body.trim().length < 20) errs.body = 'Please write at least 20 characters about your experience.';
    if (!name.trim()) errs.name = 'Please add your name.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      ref.current?.querySelector('[aria-invalid="true"], .star-input input')?.focus();
      return;
    }
    setSaving(true);
    try {
      const saved = await addReview({ productId: product.id, rating, title, body, name, media: files.map(({ type, blob, name: n }) => ({ type, blob, name: n })) });
      reset();
      onSaved(saved);
    } catch {
      setErrors({ form: 'Sorry, your review could not be saved. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} className="rv-dialog" onClose={onClose} aria-labelledby="rv-dialog-title">
      <form className="rv-form" onSubmit={submit} noValidate>
        <div className="rv-form__head">
          <div>
            <p className="eyebrow">Write a review</p>
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
          <span className="rv-label">Photos &amp; videos <small>up to {MAX_FILES}</small></span>
          <div
            className={`rv-drop ${drag ? 'is-drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          >
            {files.map((f, k) => (
              <div className="rv-prev" key={f.url}>
                {f.type === 'video' ? <><video src={f.url} muted /><span className="rv-thumb__play"><Play size={14} /></span></> : <img src={f.url} alt="" />}
                <button type="button" onClick={() => removeFile(k)} aria-label={`Remove ${f.name}`}><X size={14} /></button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button type="button" className="rv-add" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={22} />
                <span>Add photo / video</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          <p className="rv-hint"><Camera size={14} /> Photos up to {MAX_IMAGE_MB} MB, videos up to {MAX_VIDEO_MB} MB.</p>
          {errors.media && <p className="rv-err" role="alert">{errors.media}</p>}
        </div>

        <label className="rv-field">
          <span className="rv-label">Your name <em>*</em></span>
          <input value={name} onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setErrors((x) => ({ ...x, name: undefined })); }} maxLength={40} autoComplete="name" placeholder="Shown with your review" aria-invalid={errors.name ? 'true' : undefined} />
          {errors.name && <p className="rv-err" role="alert">{errors.name}</p>}
        </label>

        <p className="rv-hint">Please share your own experience. Do not include medical claims or personal details. Reviews may be moderated.</p>
        {errors.form && <p className="rv-err" role="alert">{errors.form}</p>}

        <div className="rv-form__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Posting…' : 'Post review'}</button>
        </div>
      </form>
    </dialog>
  );
}

/* ---------------- section ---------------- */
const SORTS = { recent: 'Most recent', helpful: 'Most helpful', high: 'Highest rated', low: 'Lowest rated' };
const PAGE = 4;

export default function Reviews({ product, reviews, setReviews, summary }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'media' | 1..5
  const [sort, setSort] = useState('recent');
  const [writing, setWriting] = useState(false);
  const [media, setMedia] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [flash, setFlash] = useState('');

  useEffect(() => { setFilter('all'); setShown(PAGE); }, [product.id]);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const list = useMemo(() => {
    let l = reviews;
    if (filter === 'media') l = l.filter((r) => r.media?.length);
    else if (filter !== 'all') l = l.filter((r) => r.rating === filter);
    const by = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      helpful: (a, b) => (b.helpful || 0) - (a.helpful || 0) || b.createdAt.localeCompare(a.createdAt),
      high: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
      low: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt),
    };
    return [...l].sort(by[sort]);
  }, [reviews, filter, sort]);

  const update = (r) => setReviews((all) => all.map((x) => (x.id === r.id ? r : x)));
  const withMedia = reviews.filter((r) => r.media?.length).length;

  return (
    <section className="section rv" id="reviews" aria-labelledby="rv-title">
      <div className="container">
        <div className="shead">
          <div>
            <p className="eyebrow">Customer reviews</p>
            <h2 id="rv-title">What customers say</h2>
          </div>
        </div>

        <div className={`rv-grid ${reviews.length ? '' : 'rv-grid--empty'}`}>
          {reviews.length > 0 && <Summary summary={summary} filter={filter} setFilter={(f) => { setFilter(f); setShown(PAGE); }} onWrite={() => setWriting(true)} />}

          <div className="rv-main">
            {reviews.length > 0 && (
              <div className="rv-tools">
                <div className="rv-filters" role="group" aria-label="Filter reviews">
                  <button type="button" className={`rv-chip ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>All ({reviews.length})</button>
                  {withMedia > 0 && <button type="button" className={`rv-chip ${filter === 'media' ? 'is-on' : ''}`} onClick={() => setFilter('media')}><Camera size={14} /> With media ({withMedia})</button>}
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
                <p>Be the first to share how {product.short} fits into your routine. You can add photos and videos too.</p>
                <button type="button" className="btn" onClick={() => setWriting(true)}><PenLine size={18} /> Write the first review</button>
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
        onClose={() => setWriting(false)}
        onSaved={(r) => { setReviews((all) => [r, ...all]); setWriting(false); setFilter('all'); setSort('recent'); setFlash('Thank you! Your review is posted.'); }}
      />
      <Lightbox item={media} onClose={() => setMedia(null)} />
      <div className={`toast ${flash ? 'is-on' : ''}`} role="status" aria-live="polite">
        {flash && <><Check size={16} /> {flash}</>}
      </div>
    </section>
  );
}
