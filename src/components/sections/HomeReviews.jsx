import { useEffect, useMemo, useState } from 'react';
import Reviews from '../../store/components/pdp/Reviews';
import { listReviews, summarise } from '../../store/data/reviewStore';

/** Site-wide reviews are stored under one id (the store's per-product reviews keep their own ids). */
const SITE = { id: 'tranzlife-site', short: 'TranzLife' };

/**
 * Customer reviews for the home page: star rating summary, written reviews, photo / video upload,
 * "helpful" votes and reporting. It reuses the store's review component and storage (see
 * store/data/reviewStore.js: reviews live in this browser until a real API is connected).
 * With no reviews yet it shows the empty state and the "write the first review" button.
 */
export default function HomeReviews() {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    let live = true;
    listReviews(SITE.id).then((r) => live && setReviews(r));
    return () => { live = false; };
  }, []);
  const summary = useMemo(() => summarise(reviews), [reviews]);

  return (
    <div className="tl-store home-reviews">
      <Reviews product={SITE} reviews={reviews} setReviews={setReviews} summary={summary} />
    </div>
  );
}
