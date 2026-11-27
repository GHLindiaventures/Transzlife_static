// Printable GST Tax Invoice HTML generator for orders (accessible by order owner or staff).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = (p) => `₹${(Number(p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderInvoiceHtml(order, items, env = process.env) {
  const addr = typeof order.ship_address === 'string' ? JSON.parse(order.ship_address) : (order.ship_address || {});
  const sellerName = env.SELLER_NAME || 'TranzLife Biosciences Pvt. Ltd.';
  const sellerGstin = env.SELLER_GSTIN || '33AAACT0000A1Z5 (configure SELLER_GSTIN)';
  const sellerState = env.SELLER_STATE || 'Tamil Nadu';
  const sellerAddress = env.SELLER_ADDRESS || 'Montieth Road, Egmore, Chennai, Tamil Nadu 600008';
  const intraState = String(addr.state || '').trim().toLowerCase() === sellerState.toLowerCase();

  let totalTaxable = 0;
  let totalTax = 0;
  const rowsHtml = items.map((it, idx) => {
    const rate = Number(it.gst_rate ?? 12);
    const gross = Number(it.line_total || it.unit_price * it.qty);
    const taxable = Math.round(gross / (1 + rate / 100));
    const tax = gross - taxable;
    totalTaxable += taxable;
    totalTax += tax;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${esc(it.name)}</strong><br><small>${esc(it.size)}${it.pack > 1 ? ` · Pack of ${it.pack}` : ''}</small></td>
        <td>${esc(it.hsn_code || '30049011')}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${rs(taxable)}</td>
        <td class="num">${rate}%</td>
        <td class="num">${rs(tax)}</td>
        <td class="num"><strong>${rs(gross)}</strong></td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tax Invoice INV-${esc(order.order_number)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #16261d; margin: 28px auto; max-width: 820px; padding: 0 18px; line-height: 1.45; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #124a2c; padding-bottom: 14px; margin-bottom: 18px; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #124a2c; }
    .meta { text-align: right; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 13.5px; }
    .box { background: #f6f8f5; border: 1px solid #d9e2da; border-radius: 8px; padding: 12px 14px; }
    .box h2 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4a6353; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e1e8e2; padding: 9px 8px; text-align: left; }
    th { background: #eef4ef; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #2b4a37; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { width: 320px; margin-left: auto; font-size: 13.5px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { border-top: 2px solid #124a2c; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 15px; }
    .actions { margin-bottom: 18px; display: flex; justify-content: flex-end; }
    .btn { background: #124a2c; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; }
    @media print { .actions { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="actions"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  <div class="head">
    <div>
      <h1>Tax Invoice</h1>
      <div><strong>${esc(sellerName)}</strong></div>
      <div style="font-size:13px;color:#4a6353">GSTIN: ${esc(sellerGstin)}</div>
    </div>
    <div class="meta">
      <div><strong>Invoice #:</strong> INV-${esc(order.order_number)}</div>
      <div><strong>Order #:</strong> ${esc(order.order_number)}</div>
      <div><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <div><strong>Payment:</strong> ${esc(String(order.payment_method || '').toUpperCase())} (${esc(order.payment_status)})</div>
    </div>
  </div>
  <div class="grid">
    <div class="box">
      <h2>Sold By</h2>
      <div>${esc(sellerName)}</div>
      <div>${esc(sellerAddress)}</div>
    </div>
    <div class="box">
      <h2>Billed &amp; Shipped To</h2>
      <div><strong>${esc(addr.name)}</strong></div>
      <div>${esc(addr.line1)}${addr.line2 ? `, ${esc(addr.line2)}` : ''}</div>
      <div>${esc(addr.city)}, ${esc(addr.state)} ${esc(addr.pin)}</div>
      <div>Phone: +91 ${esc(addr.phone)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Item</th><th>HSN</th><th class="num">Qty</th>
        <th class="num">Taxable</th><th class="num">GST</th><th class="num">Tax</th><th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div><span>Taxable Value</span><span>${rs(totalTaxable)}</span></div>
    ${intraState
      ? `<div><span>CGST</span><span>${rs(Math.floor(totalTax / 2))}</span></div><div><span>SGST</span><span>${rs(Math.ceil(totalTax / 2))}</span></div>`
      : `<div><span>IGST</span><span>${rs(totalTax)}</span></div>`}
    ${order.shipping_fee > 0 ? `<div><span>Shipping</span><span>${rs(order.shipping_fee)}</span></div>` : ''}
    ${order.discount > 0 ? `<div><span>Prepaid / Offer Discount</span><span>-${rs(order.discount)}</span></div>` : ''}
    <div class="grand"><span>Invoice Total</span><span>${rs(order.total)}</span></div>
  </div>
  <p style="margin-top:28px;font-size:12px;color:#5a7062">This is a computer-generated GST tax invoice and does not require a physical signature.</p>
</body>
</html>`;
}
