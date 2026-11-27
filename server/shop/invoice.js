// Indian GST Tax Invoice engine:
//   - Atomic per-financial-year sequential invoice numbering (TZL/YY-YY/00001)
//   - Intra-state (CGST + SGST) vs Inter-state (IGST) calculation using GST state codes
//   - HSN/SAC summary table, proportional discount allocation, Indian-rupee amount in words
//   - Branded TranzLife printable/PDF HTML layout

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (paise) => (Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (paise) => `₹${fmtNum(paise)}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '');

const STATE_CODES = new Map([
  ['jammu and kashmir', '01'], ['jammu & kashmir', '01'],
  ['himachal pradesh', '02'], ['punjab', '03'], ['chandigarh', '04'],
  ['uttarakhand', '05'], ['haryana', '06'], ['delhi', '07'], ['new delhi', '07'],
  ['rajasthan', '08'], ['uttar pradesh', '09'], ['bihar', '10'], ['sikkim', '11'],
  ['arunachal pradesh', '12'], ['nagaland', '13'], ['manipur', '14'], ['mizoram', '15'],
  ['tripura', '16'], ['meghalaya', '17'], ['assam', '18'], ['west bengal', '19'],
  ['jharkhand', '20'], ['odisha', '21'], ['orissa', '21'], ['chhattisgarh', '22'],
  ['madhya pradesh', '23'], ['gujarat', '24'], ['dadra and nagar haveli', '26'],
  ['daman and diu', '26'], ['maharashtra', '27'], ['andhra pradesh', '37'],
  ['karnataka', '29'], ['goa', '30'], ['lakshadweep', '31'], ['kerala', '32'],
  ['tamil nadu', '33'], ['tamilnadu', '33'], ['puducherry', '34'], ['pondicherry', '34'],
  ['andaman and nicobar islands', '35'], ['telangana', '36'], ['ladakh', '38'],
]);

export function gstStateCode(stateName) {
  const key = String(stateName || '').trim().toLowerCase();
  return STATE_CODES.get(key) || '';
}

/** Returns Indian financial year string like "26-27" (Apr 2026 - Mar 2027). */
export function financialYearOf(date = new Date()) {
  const d = new Date(date);
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  const end = start + 1;
  return `${String(start).slice(-2)}-${String(end).slice(-2)}`;
}

/**
 * Ensures an order has a unique, sequential GST invoice number (TZL/YY-YY/00001).
 * Eligible once confirmed/paid (never for pending_payment or unpaid cancelled orders).
 */
export async function ensureInvoiceNumber(q, orderId, issuedAt = new Date()) {
  const row = (await q('SELECT id, order_number, status, payment_status, invoice_number, invoice_issued_at, created_at FROM orders WHERE id = $1', [orderId])).rows[0];
  if (!row) return null;
  if (row.invoice_number) return { invoiceNumber: row.invoice_number, issuedAt: row.invoice_issued_at };
  if (row.status === 'pending_payment' || (row.status === 'cancelled' && row.payment_status !== 'paid')) {
    return null;
  }

  const fy = financialYearOf(issuedAt || row.created_at);
  const seq = (await q(
    `INSERT INTO invoice_counters (fy, last_seq) VALUES ($1, 1)
     ON CONFLICT (fy) DO UPDATE SET last_seq = invoice_counters.last_seq + 1
     RETURNING last_seq`,
    [fy],
  )).rows[0].last_seq;

  const num = `TZL/${fy}/${String(seq).padStart(5, '0')}`;
  const upd = (await q(
    `UPDATE orders SET invoice_number = COALESCE(invoice_number, $2), invoice_issued_at = COALESCE(invoice_issued_at, $3)
      WHERE id = $1 RETURNING invoice_number, invoice_issued_at`,
    [orderId, num, new Date(issuedAt || Date.now()).toISOString()],
  )).rows[0];
  return { invoiceNumber: upd.invoice_number, issuedAt: upd.invoice_issued_at };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function intToIndianWords(n) {
  n = Math.floor(Math.max(0, Number(n || 0)));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${intToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return parts.join(' ');
}

export function amountInWords(paise) {
  const total = Math.max(0, Math.round(Number(paise || 0)));
  const rupees = Math.floor(total / 100);
  const p = total % 100;
  const rText = intToIndianWords(rupees);
  const pText = p > 0 ? ` and ${twoDigits(p)} Paise` : '';
  return `INR ${rText}${pText} Only`;
}

export function renderInvoiceHtml(order, items, env = process.env, settings = {}) {
  const addr = typeof order.ship_address === 'string' ? JSON.parse(order.ship_address) : (order.ship_address || {});
  const bank = settings.company_bank || {};
  const hasBank = !!(bank.accountHolder || bank.bankName || bank.accountNumber || bank.ifsc);
  const billedBy = order.billed_by_name || 'Online Checkout';
  const sellerName = env.SELLER_NAME || 'TRANZ LIFE BIO SCIENCES PRIVATE LIMITED';
  const sellerGstin = env.SELLER_GSTIN || '33AAMCT8943N1ZJ';
  const sellerState = env.SELLER_STATE || 'Tamil Nadu';
  const sellerStateCode = gstStateCode(sellerState) || '33';
  const sellerAddress = env.SELLER_ADDRESS || 'Ground Floor, Door No 84, Murugesa Naicker Building B Block, Greams Road, Thousand Lights West, Chennai, Tamil Nadu - 600006';
  const buyerStateCode = gstStateCode(addr.state);
  const intraState = String(addr.state || '').trim().toLowerCase() === sellerState.toLowerCase();

  const invNo = order.invoice_number || `INV-${order.order_number}`;
  const invDate = fmtDate(order.invoice_issued_at || order.created_at);
  const orderDate = fmtDate(order.created_at);
  const trackingId = order.tracking_id || `TRK-${order.order_number}`;

  const grossItemsTotal = items.reduce((s, it) => s + Number(it.line_total || it.unit_price * it.qty), 0);
  const orderDiscount = Number(order.discount || 0);

  let totalTaxable = 0;
  let totalTax = 0;
  let totalUnits = 0;
  const hsnMap = new Map();

  const itemRows = items.map((it, idx) => {
    const rate = Number(it.gst_rate ?? 12);
    const hsn = String(it.hsn_code || '30049011');
    const qty = Number(it.qty || 1);
    const grossLine = Number(it.line_total || it.unit_price * qty);
    const shareDiscount = grossItemsTotal > 0 ? Math.round((grossLine / grossItemsTotal) * orderDiscount) : 0;
    const netGross = Math.max(0, grossLine - shareDiscount);
    const discPct = grossLine > 0 && shareDiscount > 0 ? ((shareDiscount / grossLine) * 100).toFixed(1) : '';

    const taxable = Math.round(netGross / (1 + rate / 100));
    const tax = netGross - taxable;
    const unitIncl = Math.round(grossLine / qty);
    const unitExcl = Math.round(taxable / qty);

    totalTaxable += taxable;
    totalTax += tax;
    totalUnits += qty;

    const hsnKey = `${hsn}|${rate}`;
    const prev = hsnMap.get(hsnKey) || { hsn, rate, taxable: 0, tax: 0 };
    prev.taxable += taxable;
    prev.tax += tax;
    hsnMap.set(hsnKey, prev);

    return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>
          <strong>${esc(it.name)}</strong>
          <div class="sub">${esc(it.size || '')}${it.pack > 1 ? ` · Pack of ${it.pack}` : ''}</div>
        </td>
        <td class="c">${esc(hsn)}</td>
        <td class="num"><strong>${qty} Nos</strong></td>
        <td class="num">${fmtNum(unitIncl)}</td>
        <td class="num">${fmtNum(unitExcl)}</td>
        <td class="c">Nos</td>
        <td class="num">${discPct ? `${discPct}%` : '—'}</td>
        <td class="num"><strong>${fmtNum(taxable)}</strong></td>
      </tr>`;
  }).join('');

  const shippingGross = Number(order.shipping || 0);
  const computedSum = totalTaxable + totalTax + shippingGross;
  const roundOff = Number(order.total || 0) - computedSum;

  const cgstTotal = intraState ? Math.floor(totalTax / 2) : 0;
  const sgstTotal = intraState ? totalTax - cgstTotal : 0;
  const igstTotal = intraState ? 0 : totalTax;

  const hsnRows = [...hsnMap.values()].map((h) => {
    const halfRate = (h.rate / 2).toFixed(h.rate % 2 ? 1 : 0);
    const cgst = intraState ? Math.floor(h.tax / 2) : 0;
    const sgst = intraState ? h.tax - cgst : 0;
    return `
      <tr>
        <td>${esc(h.hsn)}</td>
        <td class="num">${fmtNum(h.taxable)}</td>
        ${intraState ? `
          <td class="num">${halfRate}%</td><td class="num">${fmtNum(cgst)}</td>
          <td class="num">${halfRate}%</td><td class="num">${fmtNum(sgst)}</td>
        ` : `
          <td class="num">${h.rate}%</td><td class="num">${fmtNum(h.tax)}</td>
        `}
        <td class="num"><strong>${fmtNum(h.tax)}</strong></td>
      </tr>`;
  }).join('');

  const payText = `${String(order.payment_method || '').toUpperCase()} · ${String(order.payment_status || '').replace(/_/g, ' ')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tax Invoice ${esc(invNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #15241b; background: #f3f5f2; margin: 0; padding: 24px 16px; font-size: 12.5px; line-height: 1.4; }
    .actions { max-width: 860px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 10px; }
    .btn { background: #124a2c; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; font-size: 13px; }
    .btn:hover { background: #1a633c; }
    .sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1.5px solid #124a2c; box-shadow: 0 8px 28px rgba(18, 74, 44, 0.08); }
    .titlebar { background: #124a2c; color: #fff; text-align: center; padding: 8px 14px; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 3px solid #efc04a; }
    .topgrid { display: grid; grid-template-columns: 1.15fr 1fr; border-bottom: 1px solid #2b4a37; }
    .leftcol { border-right: 1px solid #2b4a37; }
    .box { padding: 10px 12px; border-bottom: 1px solid #cdd8cf; }
    .box:last-child { border-bottom: 0; }
    .seller-head { display: flex; gap: 10px; align-items: flex-start; }
    .seller-head img { width: 38px; height: 38px; object-fit: contain; border-radius: 6px; border: 1px solid #dbe4dc; padding: 2px; background: #fff; }
    .lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #4f6657; font-weight: 700; margin-bottom: 3px; }
    .metagrid { display: grid; grid-template-columns: 1fr 1fr; }
    .meta-cell { padding: 7px 10px; border-bottom: 1px solid #cdd8cf; border-right: 1px solid #cdd8cf; min-height: 44px; }
    .meta-cell:nth-child(2n) { border-right: 0; }
    .meta-cell:nth-last-child(-n+2) { border-bottom: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cdd8cf; padding: 6px 8px; vertical-align: top; }
    th { background: #eef4ef; color: #124a2c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; }
    .c { text-align: center; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sub { font-size: 11px; color: #546a5c; margin-top: 2px; }
    .words { padding: 8px 12px; border-top: 1px solid #2b4a37; border-bottom: 1px solid #2b4a37; display: flex; justify-content: space-between; gap: 12px; background: #fafcf9; }
    .footgrid { display: grid; grid-template-columns: 1.2fr 1fr; border-top: 1px solid #2b4a37; }
    .decl { padding: 10px 12px; border-right: 1px solid #cdd8cf; font-size: 11.5px; }
    .sign { padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; min-height: 82px; }
    .bottom-note { text-align: center; font-size: 11px; color: #4f6657; padding: 8px 12px; border-top: 1px solid #cdd8cf; background: #fafcf9; }
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .sheet { border: 1px solid #124a2c; box-shadow: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="actions"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  <div class="sheet">
    <div class="titlebar">Tax Invoice</div>
    <div class="topgrid">
      <div class="leftcol">
        <div class="box">
          <div class="seller-head">
            <img src="/assets/logo.png" alt="" onerror="this.style.display='none'">
            <div>
              <strong style="font-size:13.5px;color:#124a2c">${esc(sellerName)}</strong>
              <div>${esc(sellerAddress)}</div>
              <div><strong>GSTIN/UIN:</strong> ${esc(sellerGstin)}</div>
              <div><strong>State Name:</strong> ${esc(sellerState)}, Code: ${esc(sellerStateCode)}</div>
              <div>E-Mail: care@tranzlife.in · Ph: +91 91503 94443</div>
            </div>
          </div>
        </div>
        <div class="box">
          <div class="lbl">Consignee (Ship to)</div>
          <strong>${esc(addr.name)}</strong>
          <div>${esc(addr.line1)}${addr.line2 ? `, ${esc(addr.line2)}` : ''}</div>
          <div>${esc(addr.city)}, ${esc(addr.state)} - ${esc(addr.pin)}</div>
          <div>Ph. No: +91 ${esc(addr.phone)}${buyerStateCode ? ` · State: ${esc(addr.state)}, Code: ${esc(buyerStateCode)}` : ''}</div>
        </div>
        <div class="box">
          <div class="lbl">Buyer (Bill to)</div>
          <strong>${esc(addr.name)}</strong>
          <div>${esc(addr.line1)}${addr.line2 ? `, ${esc(addr.line2)}` : ''}</div>
          <div>${esc(addr.city)}, ${esc(addr.state)} - ${esc(addr.pin)}</div>
          <div>Ph. No: +91 ${esc(addr.phone)}${buyerStateCode ? ` · State: ${esc(addr.state)}, Code: ${esc(buyerStateCode)}` : ''}</div>
        </div>
      </div>

      <div class="metagrid">
        <div class="meta-cell"><div class="lbl">Invoice No.</div><strong>${esc(invNo)}</strong></div>
        <div class="meta-cell"><div class="lbl">Dated</div><strong>${esc(invDate)}</strong></div>
        <div class="meta-cell"><div class="lbl">Order No.</div><strong>${esc(order.order_number)}</strong></div>
        <div class="meta-cell"><div class="lbl">Mode / Status of Payment</div><strong>${esc(payText)}</strong></div>
        <div class="meta-cell"><div class="lbl">Order Date</div><strong>${esc(orderDate)}</strong></div>
        <div class="meta-cell"><div class="lbl">Tracking ID</div><strong>${esc(trackingId)}</strong></div>
        <div class="meta-cell"><div class="lbl">Dispatch Doc No. (AWB)</div><strong>${esc(order.awb_number || '—')}</strong></div>
        <div class="meta-cell"><div class="lbl">Dispatched Through</div><strong>${esc(order.courier_name || 'Standard Courier')}</strong></div>
        <div class="meta-cell"><div class="lbl">Destination</div><strong>${esc([addr.city, addr.pin].filter(Boolean).join(' - '))}</strong></div>
        <div class="meta-cell"><div class="lbl">Place of Supply</div><strong>${esc(addr.state || '—')}${buyerStateCode ? ` (${esc(buyerStateCode)})` : ''}</strong></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c" style="width:36px">Sl</th>
          <th>Description of Goods</th>
          <th class="c">HSN/SAC</th>
          <th class="num">Quantity</th>
          <th class="num">Rate (Incl. Tax)</th>
          <th class="num">Rate</th>
          <th class="c">per</th>
          <th class="num">Disc. %</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr>
          <td colspan="8" class="num">Taxable Subtotal</td>
          <td class="num">${fmtNum(totalTaxable)}</td>
        </tr>
        ${intraState ? `
          <tr><td colspan="8" class="num">CGST Output</td><td class="num">${fmtNum(cgstTotal)}</td></tr>
          <tr><td colspan="8" class="num">SGST Output</td><td class="num">${fmtNum(sgstTotal)}</td></tr>
        ` : `
          <tr><td colspan="8" class="num">IGST Output</td><td class="num">${fmtNum(igstTotal)}</td></tr>
        `}
        ${shippingGross > 0 ? `<tr><td colspan="8" class="num">Shipping &amp; Handling</td><td class="num">${fmtNum(shippingGross)}</td></tr>` : ''}
        ${roundOff !== 0 ? `<tr><td colspan="8" class="num">Round Off</td><td class="num">${roundOff > 0 ? '' : '-'}${fmtNum(Math.abs(roundOff))}</td></tr>` : ''}
        <tr style="background:#eef4ef">
          <td colspan="3" class="num"><strong>Total</strong></td>
          <td class="num"><strong>${totalUnits} Nos</strong></td>
          <td colspan="4"></td>
          <td class="num" style="font-size:14px;color:#124a2c"><strong>${rs(order.total)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="words">
      <div><span class="lbl" style="display:inline;margin-right:6px">Amount Chargeable (in words):</span><strong>${esc(amountInWords(order.total))}</strong></div>
      <div><em>E. &amp; O.E</em></div>
    </div>

    <table>
      <thead>
        <tr>
          <th rowspan="2">HSN/SAC</th>
          <th rowspan="2" class="num">Taxable Value</th>
          ${intraState
            ? `<th colspan="2" class="c">CGST</th><th colspan="2" class="c">SGST/UTGST</th>`
            : `<th colspan="2" class="c">IGST</th>`}
          <th rowspan="2" class="num">Total Tax Amount</th>
        </tr>
        <tr>
          ${intraState
            ? `<th class="num">Rate</th><th class="num">Amount</th><th class="num">Rate</th><th class="num">Amount</th>`
            : `<th class="num">Rate</th><th class="num">Amount</th>`}
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
        <tr style="background:#fafcf9">
          <td><strong>Total</strong></td>
          <td class="num"><strong>${fmtNum(totalTaxable)}</strong></td>
          ${intraState
            ? `<td></td><td class="num"><strong>${fmtNum(cgstTotal)}</strong></td><td></td><td class="num"><strong>${fmtNum(sgstTotal)}</strong></td>`
            : `<td></td><td class="num"><strong>${fmtNum(igstTotal)}</strong></td>`}
          <td class="num"><strong>${fmtNum(totalTax)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="words" style="border-top:0">
      <div><span class="lbl" style="display:inline;margin-right:6px">Tax Amount (in words):</span><strong>${esc(amountInWords(totalTax))}</strong></div>
    </div>

    <div class="footgrid" style="border-top:0">
      <div class="decl">
        <div class="lbl">Remarks</div>
        <div><strong>Billed By – ${esc(billedBy)}</strong></div>
      </div>
      <div class="decl" style="border-right:0">
        <div class="lbl">Company's Bank Details</div>
        ${hasBank ? `
          <div>A/c Holder's Name: <strong>${esc(bank.accountHolder || sellerName)}</strong></div>
          <div>Bank Name: <strong>${esc(bank.bankName || '—')}</strong></div>
          <div>A/c No.: <strong>${esc(bank.accountNumber || '—')}</strong></div>
          <div>Branch &amp; IFS Code: <strong>${esc([bank.branch, bank.ifsc].filter(Boolean).join(' & ') || '—')}</strong></div>
        ` : `<div class="sub">Bank details can be updated in Admin → Store settings.</div>`}
      </div>
    </div>

    <div class="footgrid">
      <div class="decl">
        <div class="lbl">Declaration</div>
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
      </div>
      <div class="sign">
        <div><strong>for ${esc(sellerName)}</strong></div>
        <div style="font-size:11px;color:#4f6657;margin-top:24px">Authorised Signatory</div>
      </div>
    </div>
    <div class="bottom-note">
      <strong>SUBJECT TO CHENNAI JURISDICTION</strong> · This is a Computer Generated Invoice
    </div>
  </div>
</body>
</html>`;
}
