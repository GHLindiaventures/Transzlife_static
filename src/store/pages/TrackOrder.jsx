import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, Copy, Check, ExternalLink, MapPin, Package, Search, Truck,
  ClipboardCheck, PackageCheck, Undo2, XCircle, Navigation, Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { subscribePublicEvents } from '../lib/realtime';
import { Breadcrumbs, useTitle } from '../components/Common';
import '../styles/track.css';

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';

/*
 * Shipment activity: each event gets a colour and an icon for what it means, so the timeline can be
 * read at a glance. Only four tones are used, each for one kind of moment:
 *   green  done (delivered, refund completed)      blue  on the move (shipped, in transit, out for delivery)
 *   amber  being prepared (placed, confirmed, packed) or waiting (delayed, payment pending)
 *   red    stopped or going back (cancelled, returned, RTO, failed delivery, a return request)
 */
const RED_NOTE = /\b(return|rto|cancel|reject|fail|undeliver|damag|lost)/i;
function eventLook(ev) {
  const st = String(ev.status || '').toLowerCase();
  if (['cancelled', 'rto', 'returned'].includes(st)) return { tone: 'red', Icon: st === 'cancelled' ? XCircle : Undo2 };
  if (st === 'refunded') return { tone: 'green', Icon: Wallet };
  // a return / cancellation noted on an otherwise normal step: say what actually happened
  if (RED_NOTE.test(ev.note || '')) {
    const ret = /return|rto/i.test(ev.note);
    return { tone: 'red', Icon: ret ? Undo2 : XCircle, label: ret ? (/request/i.test(ev.note) ? 'Return requested' : 'Return update') : 'Issue reported' };
  }
  if (st === 'delivered') return { tone: 'green', Icon: CheckCircle2 };
  if (st === 'out_for_delivery') return { tone: 'blue', Icon: Navigation };
  if (['shipped', 'in_transit'].includes(st)) return { tone: 'blue', Icon: Truck };
  if (st === 'packed') return { tone: 'amber', Icon: PackageCheck };
  if (/delay|pending/.test(st)) return { tone: 'amber', Icon: Clock };
  return { tone: 'amber', Icon: ClipboardCheck };      // placed, confirmed, processing
}

export default function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(id || '');
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useTitle(id ? `Track ${id}` : 'Track your order');

  useEffect(() => {
    setQuery(id || '');
    if (!id) { setTracking(null); setLoading(false); setError(''); return; }
    let active = true;
    const fetchTracking = (silent = false) => {
      if (!silent) { setLoading(true); setError(''); }
      api(`/api/track/${encodeURIComponent(id)}`)
        .then((res) => { if (active) { setTracking(res.tracking); setError(''); } })
        .catch((e) => { if (active && !silent) { setTracking(null); setError(e.message || 'Could not find that order.'); } })
        .finally(() => { if (active && !silent) setLoading(false); });
    };
    fetchTracking(false);
    const stopSse = subscribePublicEvents({
      trackId: id,
      onEvent: (ev) => {
        if (ev?.type === 'order') fetchTracking(true);
      },
    });
    return () => { active = false; stopSse(); };
  }, [id]);

  const onSearch = (e) => {
    e.preventDefault();
    const clean = query.trim();
    if (clean) navigate(`/track/${encodeURIComponent(clean)}`);
  };

  const copyId = () => {
    if (!tracking?.trackingId) return;
    navigator.clipboard?.writeText(tracking.trackingId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const stopped = tracking && ['cancelled', 'shipment_failed', 'delivery_failed', 'refund_initiated', 'refunded', 'rto', 'returned'].includes(tracking.status);

  return (
    <div className="trk-page">
      <div className="container">
        <Breadcrumbs items={[['Account', '/account'], ['Track order']]} />

        <div className="trk-head">
          <div>
            <h1>Track your delivery</h1>
            <p>Follow your TranzLife order step by step from confirmation to your doorstep.</p>
          </div>
          <form className="trk-search" onSubmit={onSearch}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tracking ID (TRK-TZL-...) or Order # (TZL-...)"
              aria-label="Tracking ID or Order Number"
            />
            <button type="submit" className="trk-btn">Track</button>
          </form>
        </div>

        {loading && <div className="trk-card"><p className="trk-muted">Looking up shipment details…</p></div>}

        {error && !loading && (
          <div className="trk-card trk-error" role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>Order not found</strong>
              <p>{error} Double-check your tracking ID (e.g. <code>TRK-TZL-001001</code>) or <Link to="/account">view orders in your account</Link>.</p>
            </div>
          </div>
        )}

        {!id && !loading && (
          <div className="trk-card trk-empty">
            <Truck size={32} />
            <h2>Enter your Tracking ID or Order Number</h2>
            <p>You can find your tracking link in your order confirmation SMS/WhatsApp, or sign in to <Link to="/account">your account</Link> to see all orders.</p>
          </div>
        )}

        {tracking && !loading && (
          <div className="trk-layout">
            {/* Top Status + EDD Banner */}
            <section className={`trk-card trk-banner ${tracking.isDelayed && tracking.status !== 'delivered' ? 'is-delayed' : tracking.status === 'delivered' ? 'is-delivered' : ''}`}>
              <div className="trk-banner__main">
                <span className="trk-eyebrow">
                  {tracking.status === 'delivered' ? 'Delivered' : stopped ? tracking.status.replace(/_/g, ' ') : 'Expected delivery'}
                </span>
                <h2>
                  {tracking.status === 'delivered'
                    ? `Delivered ${fmtDay(tracking.deliveredAt || tracking.events.at(-1)?.at)}`
                    : stopped
                      ? `Order ${tracking.status.replace(/_/g, ' ')}`
                      : tracking.estimatedDeliveryAt
                        ? fmtDay(tracking.estimatedDeliveryAt)
                        : 'Calculating delivery date'}
                </h2>
                {tracking.isDelayed && tracking.status !== 'delivered' && !stopped && (
                  <p className="trk-delay">
                    <Clock size={15} /> Delayed{tracking.delayReason ? `: ${tracking.delayReason}` : ' — updated delivery estimate shown above.'}
                  </p>
                )}
              </div>

              <div className="trk-meta">
                <div>
                  <span className="trk-eyebrow">Tracking ID</span>
                  <div className="trk-copyrow">
                    <strong>{tracking.trackingId}</strong>
                    <button type="button" className="trk-copy" onClick={copyId} aria-label="Copy tracking ID">
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="trk-eyebrow">Order number</span>
                  <strong>{tracking.orderNumber}</strong>
                </div>
                <div>
                  <span className="trk-eyebrow">Courier partner</span>
                  <strong>{tracking.courierName || 'Assigning courier'}</strong>
                  {tracking.awbNumber && <span className="trk-sub">AWB: {tracking.awbNumber}</span>}
                </div>
                {tracking.trackingUrl && (
                  <a className="trk-ext" href={tracking.trackingUrl} target="_blank" rel="noreferrer">
                    Courier site <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </section>

            {/* 9-Stage Visual Timeline (Amazon / Flipkart style) */}
            {!stopped && (
              <section className="trk-card" aria-label="Delivery progress">
                <h3 className="trk-h3">Delivery journey</h3>
                <div className="trk-stepper-wrap">
                  <ol className="trk-stepper">
                    {tracking.stages.map((st, idx) => (
                      <li
                        key={st.key}
                        className={`trk-step ${st.completed ? 'is-done' : ''} ${st.current ? 'is-now' : ''}`}
                        aria-current={st.current ? 'step' : undefined}
                      >
                        <div className="trk-step__dot" aria-hidden="true">
                          {st.completed ? <CheckCircle2 size={18} /> : <span>{idx + 1}</span>}
                        </div>
                        <div className="trk-step__body">
                          <strong>{st.label}</strong>
                          <span>{st.at ? fmtDateTime(st.at) : st.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            <div className="trk-grid2">
              {/* Scan & Event History */}
              <section className="trk-card">
                <h3 className="trk-h3">Shipment activity</h3>
                <ol className="trk-events">
                  {[...tracking.events].reverse().map((ev, i) => { const { tone, Icon, label } = eventLook(ev); return (
                    <li key={i} className={`trk-ev trk-ev--${tone}${i === 0 ? ' is-latest' : ''}`}>
                      <span className="trk-ev__icon" aria-hidden="true"><Icon size={14} strokeWidth={2.4} /></span>
                      <div className="trk-events__time">{fmtDateTime(ev.at)}</div>
                      <div className="trk-events__info">
                        <strong>{label || ev.status.replace(/_/g, ' ')}</strong>
                        {ev.location && <span className="trk-loc"><MapPin size={13} /> {ev.location}</span>}
                        {ev.note && <p>{ev.note}</p>}
                      </div>
                    </li>
                  ); })}
                </ol>
              </section>

              {/* Items + Destination */}
              <div className="trk-side">
                <section className="trk-card">
                  <h3 className="trk-h3"><Package size={16} /> Items in this order</h3>
                  <ul className="trk-items">
                    {tracking.items.map((it, idx) => (
                      <li key={idx}>
                        <span>{it.qty} × <strong>{it.name}</strong></span>
                        <span className="trk-muted">{it.size}{it.pack > 1 ? ` · Pack of ${it.pack}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="trk-card">
                  <h3 className="trk-h3"><MapPin size={16} /> Delivery destination</h3>
                  {tracking.destination?.line1 ? (
                    <p className="trk-addr">
                      <strong>{tracking.destination.name}</strong><br />
                      {tracking.destination.line1}{tracking.destination.line2 ? `, ${tracking.destination.line2}` : ''}<br />
                      {tracking.destination.city}, {tracking.destination.state} {tracking.destination.pin}
                    </p>
                  ) : (
                    <p className="trk-addr">
                      {tracking.destination?.city}, {tracking.destination?.state} {tracking.destination?.pin}
                      <span className="trk-sub" style={{ display: 'block', marginTop: 6 }}>
                        <Link to="/login">Sign in</Link> to view full street address.
                      </span>
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
