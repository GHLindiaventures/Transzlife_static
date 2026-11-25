import { useCallback, useEffect, useState } from 'react';
import Reviews from '../../store/components/pdp/Reviews';
import { loadReviews } from '../../store/data/reviewStore';
import { PRODUCTS, STORE_ID } from '../../content/site.js';

const SITE = { id: 'tranzlife-site', short: 'TranzLife' };
const EMPTY = { summary: { avg: 0, total: 0, counts: [0, 0, 0, 0, 0] }, reviews: [], mine: null, canReview: null, signedIn: false };

/** Combines the per-product review lists into one site-wide list and summary. */
function combine(lists) {
  const reviews = lists.flatMap((d) => d.reviews || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1] += 1; });
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { summary: { avg, total, counts }, reviews, mine: null, canReview: null, signedIn: lists.some((d) => d.signedIn) };
}

/**
 * Customer reviews for the home page: star summary and every approved review across the products, with their photos.
 * Reviews are written by verified buyers on each product page (the store's review system), so this section shows
 * the empty state until the first review is approved.
 */
export default function HomeReviews() {
  const [data, setData] = useState(EMPTY);
  const load = useCallback(() => {
    const ids = PRODUCTS.map((p) => STORE_ID[p.id]).filter(Boolean);
    Promise.all(ids.map((id) => loadReviews(id))).then((lists) => setData(combine(lists)));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="tl-store home-reviews">
      <Reviews product={SITE} data={data} onChanged={load} />
    </div>
  );
}
