// Customer reviews (server: server/shop/reviews.js), favourites, and photo helpers.
// Reviews come from verified buyers only (a delivered order with the product) and are moderated;
// the "reported" mark is also remembered in this browser so a reported review hides at once.
import { api, ApiError } from '../lib/api';
import { visitorId, track } from '../lib/track';

const FLAGS = 'tranzlife.reviewFlags.v1'; // { [reviewId]: { reported: 'reason' } }
const FAVS = 'tranzlife.favourites.v1';

export const MAX_FILES = 5;
export const MAX_IMAGE_MB = 10;

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};
const withFlags = (r) => ({ ...r, reported: readJson(FLAGS, {})[r.id]?.reported || null });

const EMPTY = { summary: { avg: 0, total: 0, counts: [0, 0, 0, 0, 0] }, reviews: [], mine: null, canReview: null, signedIn: false };

/** Approved reviews + summary, and (signed in) my own review and whether I can write one. */
export async function loadReviews(productId) {
  try {
    const v = visitorId();
    const d = await api(`/api/products/${encodeURIComponent(productId)}/reviews${v ? `?v=${v}` : ''}`);
    return { ...d, reviews: d.reviews.map(withFlags) };
  } catch {
    return EMPTY;
  }
}

/** Uploads one photo (already compressed) and returns { id, url, thumbUrl }. */
export async function uploadReviewPhoto(blob) {
  let res;
  try {
    res = await fetch('/api/reviews/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
  } catch {
    throw new ApiError('Could not upload the photo. Check your connection and try again.', 0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Could not upload the photo.', res.status, data.code);
  return data;
}

/** Creates or edits my review. Returns { review, held }. */
export async function saveReview({ productId, rating, title, body, photoIds }) {
  const r = await api('/api/reviews', { method: 'POST', body: { productId, rating, title, body, photoIds } });
  track('review_submit', { pid: productId, rating, photos: photoIds.length, held: r.held });
  return r;
}

/** Toggles my "helpful" vote. Returns the updated review. */
export async function markHelpful(review) {
  const r = await api(`/api/reviews/${review.id}/helpful`, { method: 'POST', body: { v: visitorId() } });
  if (r.votedHelpful) track('review_helpful');
  return { ...review, helpful: r.helpful, votedHelpful: r.votedHelpful };
}

/** Reports a review (or undoes it in this browser when reason is null). */
export function reportReview(review, reason) {
  const flags = readJson(FLAGS, {});
  flags[review.id] = { ...flags[review.id], reported: reason };
  writeJson(FLAGS, flags);
  if (reason) api(`/api/reviews/${review.id}/report`, { method: 'POST', body: { reason, v: visitorId() } }).catch(() => {});
  return { ...review, reported: reason };
}

/** Products I can review (delivered, not reviewed yet) and my reviews. */
export const myReviews = () => api('/api/reviews/mine');

/* ---------- favourites ---------- */
export const getFavourites = () => readJson(FAVS, []);
export function toggleFavourite(productId) {
  const favs = getFavourites();
  const next = favs.includes(productId) ? favs.filter((f) => f !== productId) : [...favs, productId];
  writeJson(FAVS, next);
  return next.includes(productId);
}

/** Shrinks large photos before uploading (keeps uploads light on mobile data). */
export function compressImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1.5e6 && /jpe?g|png|webp/.test(file.type)) { URL.revokeObjectURL(url); resolve(file); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
