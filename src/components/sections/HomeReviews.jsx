import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, BadgeCheck, ChevronLeft, ChevronRight, MessageSquareQuote } from 'lucide-react';
import { loadReviews } from '../../store/data/reviewStore';
import { fmtDate } from '../../store/utils/format';
import { PRODUCTS, STORE_ID } from '../../content/site.js';

/** Only genuine reviews rated above 4 stars are featured on the home page (never edited, never invented). */
const MIN_EXCLUSIVE = 4;
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function Card({ r }) {
  return (
    <li className="hr__card">
      <div className="hr__who">
        <span className="hr__avatar" aria-hidden="true">{initials(r.name)}</span>
        <div>
          <strong>{r.name}</strong>
          <span>{r.verified && <em><BadgeCheck size={13} aria-hidden="true" /> Verified purchase</em>}{fmtDate(r.createdAt)}</span>
        </div>
      </div>
      <span className="hr__stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} aria-hidden="true" className={i < r.rating ? 'is-on' : ''} />)}
      </span>
      {r.title && <h3>{r.title}</h3>}
      <p>{r.body}</p>
    </li>
  );
}

/**
 * Customer reviews for the home page: a compact left-to-right carousel of the newest published reviews
 * rated above 4 stars, from the same review database the product pages use (verified buyers write them
 * on each product page).
 */
export default function HomeReviews() {
  const [reviews, setReviews] = useState(null);       // null = loading
  const track = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    let live = true;
    const ids = PRODUCTS.map((p) => STORE_ID[p.id]).filter(Boolean);
    Promise.all(ids.map((id) => loadReviews(id))).then((lists) => {
      if (!live) return;
      const seen = new Set();
      const all = lists.flatMap((d) => d.reviews || [])
        .filter((r) => r.rating > MIN_EXCLUSIVE && r.body && !seen.has(r.id) && seen.add(r.id))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setReviews(all);
    });
    return () => { live = false; };
  }, []);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [reviews, measure]);

  const go = (dir) => {
    const el = track.current;
    const card = el?.querySelector('.hr__card');
    if (el) el.scrollBy({ left: dir * (card ? card.offsetWidth + 16 : el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className="hr" aria-labelledby="hr-title">
      <div className="hr__head">
        <p className="hr__eyebrow">Customer reviews</p>
        <h2 id="hr-title">What customers say</h2>
      </div>

      {reviews === null ? (
        <div className="hr__skeleton" aria-busy="true" />
      ) : reviews.length === 0 ? (
        <div className="hr__empty">
          <MessageSquareQuote size={22} aria-hidden="true" />
          <p><strong>No reviews yet.</strong> Reviews from verified buyers appear here after their order is delivered.</p>
        </div>
      ) : (
        <div className="hr__wrap">
          <button type="button" className="hr__nav hr__nav--prev" onClick={() => go(-1)} disabled={edge.start} aria-label="Previous reviews"><ChevronLeft size={20} /></button>
          <ul className="hr__track" ref={track} onScroll={measure} tabIndex={0} aria-label="Customer reviews">
            {reviews.map((r) => <Card key={r.id} r={r} />)}
          </ul>
          <button type="button" className="hr__nav hr__nav--next" onClick={() => go(1)} disabled={edge.end} aria-label="Next reviews"><ChevronRight size={20} /></button>
        </div>
      )}
    </section>
  );
}
