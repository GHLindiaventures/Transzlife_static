// Customer reviews, favourites and "helpful / reported" marks.
//
// IMPORTANT: there is no backend yet, so everything here lives in THIS BROWSER only
// (IndexedDB for reviews incl. photos/videos, localStorage for small flags). Other visitors
// will not see a review until this file is switched to a real API (same function names:
// listReviews / addReview / markHelpful / reportReview). Reviews should be moderated there.

const DB = 'tranzlife-reviews';
const STORE = 'reviews';
const FLAGS = 'tranzlife.reviewFlags.v1'; // { [reviewId]: { helpful: true, reported: 'reason' } }
const FAVS = 'tranzlife.favourites.v1';

export const MAX_FILES = 5;
export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 50;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('productId', 'productId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  }));
}

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

/** All reviews for a product, with this browser's helpful/report flags merged in. */
export async function listReviews(productId) {
  let rows = [];
  try {
    rows = await tx('readonly', (s) => s.index('productId').getAll(productId));
  } catch {
    rows = [];
  }
  const flags = readJson(FLAGS, {});
  return rows.map((r) => ({ ...r, votedHelpful: !!flags[r.id]?.helpful, reported: flags[r.id]?.reported || null }));
}

/** media: [{ type: 'image' | 'video', blob: Blob, name }] */
export async function addReview({ productId, rating, title, body, name, media }) {
  const review = {
    id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    productId,
    rating,
    title: title.trim(),
    body: body.trim(),
    name: name.trim(),
    media,
    helpful: 0,
    createdAt: new Date().toISOString(),
  };
  await tx('readwrite', (s) => s.put(review));
  return { ...review, votedHelpful: false, reported: null };
}

/** Toggles this browser's "helpful" vote. Returns the updated review. */
export async function markHelpful(review) {
  const flags = readJson(FLAGS, {});
  const on = !flags[review.id]?.helpful;
  flags[review.id] = { ...flags[review.id], helpful: on };
  writeJson(FLAGS, flags);
  const next = { ...review, helpful: Math.max(0, (review.helpful || 0) + (on ? 1 : -1)) };
  const { votedHelpful, reported, ...row } = next;
  await tx('readwrite', (s) => s.put(row));
  return { ...next, votedHelpful: on };
}

export function reportReview(review, reason) {
  const flags = readJson(FLAGS, {});
  flags[review.id] = { ...flags[review.id], reported: reason };
  writeJson(FLAGS, flags);
  return { ...review, reported: reason };
}

/* ---------- favourites ---------- */
export const getFavourites = () => readJson(FAVS, []);
export function toggleFavourite(productId) {
  const favs = getFavourites();
  const next = favs.includes(productId) ? favs.filter((f) => f !== productId) : [...favs, productId];
  writeJson(FAVS, next);
  return next.includes(productId);
}

/* ---------- helpers ---------- */
export function summarise(reviews) {
  const counts = [0, 0, 0, 0, 0]; // index 0 = 1 star
  reviews.forEach((r) => { counts[r.rating - 1] += 1; });
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { total, avg, counts };
}

/** Shrinks large photos before saving (keeps uploads light). Videos are kept as they are. */
export function compressImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1.5e6) { URL.revokeObjectURL(url); resolve(file); return; }
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
