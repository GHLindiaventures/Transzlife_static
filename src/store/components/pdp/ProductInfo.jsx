import { BadgeCheck, CalendarClock, Factory, Info } from 'lucide-react';
import { inr } from '../../utils/format';
import '../../styles/pdp-info.css';

const month = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null);

/**
 * Label declarations for selling online in India (MRP, net quantity, manufacturer, origin, best
 * before, consumer care…), filled in from the admin dashboard ("Label & compliance"). Dates come
 * from the batch the customer will actually receive (the one that expires first).
 * Hidden until at least one detail has been filled in.
 */
export default function ProductInfo({ p }) {
  const k = p.compliance || {};
  const rows = [
    ['MRP', p.mrp ? `${inr(p.mrp)} (inclusive of all taxes)` : null],
    ['Net quantity', k.netQuantity || p.size],
    ['Manufactured', p.batch ? month(p.batch.mfg) : null],
    ['Use before', p.batch ? month(p.batch.expiry) : null],
    ['Shelf life', k.shelfLifeMonths ? `${k.shelfLifeMonths} months from manufacture` : null],
    ['Manufactured by', [k.manufacturer, k.manufacturerAddress].filter(Boolean).join(', ') || null],
    ['Licence no.', k.licenceNo],
    ['Country of origin', k.countryOfOrigin],
    ['Storage', k.storage],
    ['Consumer care', k.consumerCare],
  ].filter(([, v]) => v);
  const certs = k.certifications || [];
  const hasDetail = rows.some(([label]) => !['MRP', 'Net quantity'].includes(label)) || certs.length;
  if (!hasDetail) return null;
  return (
    <section className="section">
      <div className="container pinfo">
        <div className="pinfo__head">
          <p className="eyebrow">Product information</p>
          <h2>What's on the label</h2>
          {p.batch && (
            <p className="pinfo__batch"><CalendarClock size={18} /><span>The pack you receive is from a batch made in <strong>{month(p.batch.mfg)}</strong>, best used before <strong>{month(p.batch.expiry)}</strong>.</span></p>
          )}
          {certs.length > 0 && (
            <ul className="pinfo__certs" aria-label="Certifications">{certs.map((c) => <li key={c}><BadgeCheck size={15} /> {c}</li>)}</ul>
          )}
        </div>
        <dl className="pinfo__list">
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label === 'Manufactured by' ? <><Factory size={14} /> {label}</> : label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <p className="pinfo__note"><Info size={14} /> Please read the label on the pack before use. Details on the pack take precedence.</p>
      </div>
    </section>
  );
}
