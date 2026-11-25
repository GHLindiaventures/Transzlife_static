import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, onConsentChange, setConsent } from '../store/lib/track.js';
import '../styles/consent.css';

/**
 * Privacy choice (India DPDP Act): shown until the visitor picks one; reopened from the footer.
 * "Only essential" keeps the site fully working; we then count page views anonymously only.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getConsent() === null);
  const [current, setCurrent] = useState(getConsent);

  useEffect(() => onConsentChange(({ reopen, value }) => {
    if (reopen) { setCurrent(getConsent()); setOpen(true); }
    if (value) { setCurrent(value); setOpen(false); }
  }), []);

  if (!open) return null;
  return (
    <section className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title" aria-describedby="consent-text">
      <div className="consent__body">
        <h2 id="consent-title">Your privacy, your choice</h2>
        <p id="consent-text">
          We use our own analytics to learn which products help people most and to keep your cart safe.
          No ad networks, no third-party trackers, and we never sell your data. <Link to="/policies/privacy">Privacy policy</Link>
        </p>
        {current && <p className="consent__now">Current choice: <strong>{current === 'all' ? 'Analytics on' : 'Only essential'}</strong></p>}
      </div>
      <div className="consent__actions">
        <button type="button" className="consent__btn is-ghost" onClick={() => setConsent('essential')}>Only essential</button>
        <button type="button" className="consent__btn" onClick={() => setConsent('all')}>Accept</button>
      </div>
    </section>
  );
}
