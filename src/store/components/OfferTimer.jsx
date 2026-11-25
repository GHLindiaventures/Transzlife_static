import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');

/**
 * The real end of a running offer. A countdown only when staff switched it on and the offer ends
 * within 7 days; otherwise the end date. Never restarts or fakes urgency: when it ends, it says so.
 */
export default function OfferTimer({ offer }) {
  const end = Date.parse(offer.endsAt);
  const [now, setNow] = useState(Date.now());
  const counting = offer.showCountdown && end - now < 7 * 86400000;
  useEffect(() => {
    if (!counting) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);
  const left = end - now;
  if (left <= 0) return <p className="offer-timer is-over"><Clock size={15} /> {offer.name} has ended. Prices update at checkout.</p>;
  if (!counting) {
    const when = new Date(end).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return <p className="offer-timer"><Clock size={15} /> <strong>{offer.name}</strong> · ends {when}</p>;
  }
  const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  return (
    <p className="offer-timer is-live" aria-live="off">
      <Clock size={15} /> <strong>{offer.name}</strong> ends in{' '}
      <span className="offer-timer__clock" role="timer">{d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(s)}</span>
    </p>
  );
}
