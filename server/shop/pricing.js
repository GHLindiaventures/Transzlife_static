// The one place order totals are calculated. The browser only sends product, pack and quantity;
// prices, pack discounts, prepaid discount and shipping all come from the database here.
// Rounding matches the site (src/store/context/CartContext.jsx): pack prices and the prepaid
// discount are rounded to whole rupees, so the numbers customers saw are the numbers they pay.
// Running offers (server/shop/offers.js) lower the selling price first; packs and prepaid apply on top.

import { activeOffers, effectivePrice } from './offers.js';

export const ONLINE_METHODS = ['upi', 'card', 'netbanking'];
export const PAYMENT_METHODS = [...ONLINE_METHODS, 'cod'];

const rupees = (paise) => paise / 100;
const toPaise = (r) => Math.round(r) * 100;

export class PricingError extends Error {
  constructor(message, code = 'pricing') { super(message); this.code = code; this.status = 400; }
}

export async function loadSettings(q) {
  const rows = (await q('SELECT key, value FROM settings')).rows;
  return Object.fromEntries(rows.map((r) => [r.key, typeof r.value === 'string' ? JSON.parse(r.value) : r.value]));
}

/**
 * items: [{ id, pack, qty }]  ->  priced lines + totals (paise).
 * `q` is db.query or a transaction's query, so it can run inside the order transaction.
 */
export async function quote(q, items, paymentMethod) {
  if (!Array.isArray(items) || !items.length) throw new PricingError('Your cart is empty.', 'empty');
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) throw new PricingError('Unknown payment method.');
  const settings = await loadSettings(q);
  const maxQty = settings.max_qty_per_line ?? 10;

  // merge duplicate lines (same product + pack)
  const merged = new Map();
  for (const it of items) {
    const key = `${it.id}:${it.pack}`;
    merged.set(key, { id: it.id, pack: it.pack, qty: Math.min((merged.get(key)?.qty ?? 0) + it.qty, maxQty) });
  }
  const lines = [...merged.values()];
  const ids = [...new Set(lines.map((l) => l.id))];
  const products = new Map((await q(
    `SELECT p.id, p.name, p.size, p.price, p.mrp, p.active, i.on_hand - i.reserved AS available
       FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ANY($1)`, [ids])).rows.map((r) => [r.id, r]));
  const packs = new Map((await q('SELECT qty, discount_pct FROM pack_options')).rows.map((r) => [Number(r.qty), Number(r.discount_pct)]));
  const offers = await activeOffers(q);

  const priced = lines.map((l) => {
    const p = products.get(l.id);
    if (!p || !p.active) throw new PricingError('One of the products is no longer available.', 'unavailable');
    if (!(p.price > 0)) throw new PricingError(`${p.name} is coming soon and cannot be ordered yet.`, 'not_on_sale');
    if (!packs.has(l.pack)) throw new PricingError('That pack size is not available.');
    const off = packs.get(l.pack) / 100;
    const eff = effectivePrice(p, offers);
    const unit = toPaise(rupees(eff.price) * l.pack * (1 - off));
    const listUnit = toPaise(rupees(eff.regular) * l.pack * (1 - off));       // same pack at the regular price
    const unitMrp = p.mrp * l.pack;
    return { id: l.id, name: p.name, size: p.size, pack: l.pack, qty: l.qty, units: l.pack * l.qty,
      unit, unitMrp, total: unit * l.qty, mrpTotal: unitMrp * l.qty, available: Number(p.available ?? 0),
      listUnit, offerId: eff.offer?.id ?? null, offerName: eff.offer?.name ?? null,
      offerSaving: (listUnit - unit) * l.qty, packSaving: (eff.price * l.pack - unit) * l.qty };
  });

  // stock check across lines of the same product
  const need = new Map();
  for (const l of priced) need.set(l.id, (need.get(l.id) ?? 0) + l.units);
  const short = priced.filter((l) => need.get(l.id) > l.available).map((l) => l.name);

  const subtotal = priced.reduce((s, l) => s + l.total, 0);
  const mrpTotal = priced.reduce((s, l) => s + l.mrpTotal, 0);
  const shipping = subtotal >= settings.free_shipping_above ? 0 : settings.shipping_fee;
  const prepaid = paymentMethod ? ONLINE_METHODS.includes(paymentMethod) : false;
  const discount = prepaid ? toPaise(rupees(subtotal) * (settings.prepaid_discount_pct / 100)) : 0;
  const total = subtotal - discount + shipping;

  return {
    lines: priced.map(({ available, ...l }) => l),
    subtotal, mrpTotal, savings: mrpTotal - subtotal, discount, shipping, tax: 0, total,
    prepaidDiscountPct: settings.prepaid_discount_pct,
    outOfStock: [...new Set(short)],
  };
}
