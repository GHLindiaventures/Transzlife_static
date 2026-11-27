import { PRODUCTS, STORE_ID } from '../../content/site.js';

/* Background-removed packshots (public/assets/product-N.png), keyed by the store product id. */
const CUTOUT = Object.fromEntries(
  PRODUCTS.filter((x) => STORE_ID[x.id] && x.photo).map((x) => [STORE_ID[x.id], `${import.meta.env.BASE_URL}assets/product-${x.photo}.png?v=5`]),
);

/** The clean cut-out image for a store product (falls back to its first photo). Use it on a white tile. */
export const packshot = (p) => (p ? CUTOUT[p.id] || p.images?.[0] : undefined);
export const hasPackshot = (p) => Boolean(p && CUTOUT[p.id]);
