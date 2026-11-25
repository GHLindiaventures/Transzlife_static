// Offers (scheduled sales, flash sales) and product badges. Used by the catalogue, the checkout quote and
// the admin, so the price a customer sees is the price they pay.
//
// Price rules (India, Legal Metrology + CCPA dark-pattern guidelines 2023):
//   - an offer can only LOWER the regular selling price; the selling price is never above the MRP
//   - the struck-through price on the site is always the MRP printed on the pack
//   - prices are whole rupees (as on the site); several offers on one product: the lowest price wins
// Badge rules (no claims the data can't back):
//   - BEST SELLER / TRENDING are automatic: real sales (last 30 days) / real product views (last 7 days)
//   - NEW ARRIVAL switches itself off 30 days after it was turned on
//   - HOT DEAL / LIMITED OFFER / SPECIAL DISCOUNT show only while a real offer is running on the product

export const BADGE_TONES = {
  forest: { bg: '#1f6b3c', fg: '#ffffff' }, gold: { bg: '#8a5a00', fg: '#ffffff' }, red: { bg: '#b3261e', fg: '#ffffff' },
  plum: { bg: '#5b2a6e', fg: '#ffffff' }, ink: { bg: '#1b2a20', fg: '#ffffff' }, orange: { bg: '#b4470f', fg: '#ffffff' },
};
export const BADGES = {
  hot_deal: { text: 'Hot deal', tone: 'red', needsOffer: true },
  limited_offer: { text: 'Limited offer', tone: 'orange', needsOffer: true },
  special_discount: { text: 'Special discount', tone: 'plum', needsOffer: true },
  new_arrival: { text: 'New arrival', tone: 'forest', days: 30 },
  best_seller: { text: 'Best seller', tone: 'gold', auto: true },
  trending: { text: 'Trending', tone: 'ink', auto: true },
  custom: { text: '', tone: 'forest' },
};
export const MANUAL_BADGES = ['hot_deal', 'limited_offer', 'special_discount', 'new_arrival', 'custom'];
export const OFFER_BADGES = ['hot_deal', 'limited_offer', 'special_discount'];
export const BEST_SELLER_MIN_ORDERS = 5;
export const TRENDING_MIN_VIEWS = 30;

const rupees = (paise) => paise / 100;
const toPaise = (r) => Math.round(r) * 100;

/** Offers running right now (optionally at another moment, e.g. a preview). */
export async function activeOffers(q, at = null) {
  return (await q(`SELECT * FROM offers WHERE active AND starts_at <= COALESCE($1::timestamptz, now()) AND ends_at > COALESCE($1::timestamptz, now())
                    ORDER BY ends_at`, [at])).rows;
}

/** The price one offer gives a product (paise, whole rupees), never above the regular price, never below ₹1. */
export function priceWith(offer, regular) {
  const v = offer.value;
  const raw = offer.discount_type === 'percent' ? toPaise(rupees(regular) * (1 - Math.min(v, 95) / 100))
    : offer.discount_type === 'flat' ? regular - v
      : v;
  return Math.max(100, Math.min(regular, raw));
}

export const appliesTo = (offer, productId) => !offer.product_ids?.length || offer.product_ids.includes(productId);

/** { price, regular, offer } for a product row (price/mrp in paise) given the running offers. */
export function effectivePrice(p, offers) {
  const regular = Math.min(p.price, p.mrp);
  let best = null;
  for (const o of offers) {
    if (!appliesTo(o, p.id)) continue;
    const price = priceWith(o, regular);
    if (price < regular && (!best || price < best.price)) best = { price, offer: o };
  }
  return best ? { price: best.price, regular, offer: best.offer } : { price: regular, regular, offer: null };
}

/** Sales and views that decide the automatic badges. Returns { bestSellers: Set, trending: Set }. */
export async function autoBadgeFacts(q) {
  const sold = (await q(`
    SELECT i.product_id AS id, SUM(i.pack * i.qty)::int AS units, COUNT(DISTINCT o.id)::int AS orders
      FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status NOT IN ('pending_payment', 'cancelled') AND o.created_at > now() - interval '30 days'
     GROUP BY 1`)).rows;
  const eligible = sold.filter((r) => r.orders >= BEST_SELLER_MIN_ORDERS);
  const top = Math.max(0, ...eligible.map((r) => r.units));
  const bestSellers = new Set(eligible.filter((r) => r.units === top && top > 0).map((r) => r.id));
  const views = (await q(`
    SELECT product_id AS id,
           COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS now7,
           COUNT(*) FILTER (WHERE created_at <= now() - interval '7 days')::int AS prev7
      FROM events WHERE name = 'page_view' AND product_id IS NOT NULL AND created_at > now() - interval '14 days'
     GROUP BY 1`)).rows;
  const trending = new Set(views.filter((v) => v.now7 >= TRENDING_MIN_VIEWS && v.now7 >= 1.5 * Math.max(1, v.prev7)).map((v) => v.id));
  return { bestSellers, trending };
}

/** The old free-text badge, read as a structured one (products saved before badges were structured). */
function legacyConfig(text) {
  if (!text) return null;
  if (/best\s*-?seller/i.test(text)) return { key: 'auto', enabled: true };
  if (/^new/i.test(text)) return null;          // "New" without a start date can't expire: not shown
  return { key: 'custom', text, tone: 'forest', enabled: true };
}

/**
 * The badge a product shows right now, or null: { key, text, bg, fg, reason }.
 * Staff badge (if valid now) > the running offer's badge > automatic best seller > trending.
 */
export function resolveBadge(p, offer, facts, now = Date.now()) {
  const cfg = p.badge_config || legacyConfig(p.badge);
  const out = (key, text, tone, reason) => ({ key, text, ...(BADGE_TONES[tone] || BADGE_TONES.forest), reason });
  if (cfg?.enabled && MANUAL_BADGES.includes(cfg.key)) {
    const def = BADGES[cfg.key];
    const start = cfg.startsAt ? Date.parse(cfg.startsAt) : null, end = cfg.endsAt ? Date.parse(cfg.endsAt) : null;
    const inDates = (!start || start <= now) && (!end || end > now);
    const fresh = !def.days || (start && now - start < def.days * 86400000);
    const backed = !def.needsOffer || !!offer;
    if (inDates && fresh && backed && (cfg.key !== 'custom' || cfg.text)) {
      return out(cfg.key, cfg.key === 'custom' ? cfg.text : def.text, cfg.tone || def.tone, 'staff');
    }
  }
  if (offer?.badge && BADGES[offer.badge]) return out(offer.badge, BADGES[offer.badge].text, BADGES[offer.badge].tone, 'offer');
  const autoOn = !cfg || cfg.auto !== false;
  if (autoOn && facts?.bestSellers.has(p.id)) return out('best_seller', BADGES.best_seller.text, 'gold', 'sales');
  if (autoOn && facts?.trending.has(p.id)) return out('trending', BADGES.trending.text, 'ink', 'views');
  return null;
}

/** Why a staff badge is not showing (for the admin), or null when it shows. */
export function badgeProblem(p, offer, now = Date.now()) {
  const cfg = p.badge_config;
  if (!cfg?.enabled || !MANUAL_BADGES.includes(cfg.key)) return null;
  const def = BADGES[cfg.key];
  if (def.needsOffer && !offer) return 'Shows only while an offer is running on this product.';
  const start = cfg.startsAt ? Date.parse(cfg.startsAt) : null, end = cfg.endsAt ? Date.parse(cfg.endsAt) : null;
  if (start && start > now) return 'Scheduled: starts later.';
  if (end && end <= now) return 'Ended.';
  if (def.days && (!start || now - start >= def.days * 86400000)) return `Switched off automatically after ${def.days} days.`;
  return null;
}
