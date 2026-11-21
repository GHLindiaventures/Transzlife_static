export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const pctOff = (price, mrp) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
