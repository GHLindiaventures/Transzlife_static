export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
/** digits only (no ₹), for when the symbol is styled separately */
export const inrDigits = (n) => Math.round(n).toLocaleString('en-IN');
export const pctOff = (price, mrp) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);
/** Prepaid discount in whole rupees, rounded the same way as the server (server/shop/pricing.js). */
export const prepaidSaving = (amount, rate) => Math.round(amount * rate);
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
