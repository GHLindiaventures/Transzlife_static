import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { presencePage, startPresence, usePresence } from '../store/lib/presence.js';
import '../styles/live.css';

// pages where the indicator would distract from paying or signing in
const QUIET = /^\/(checkout|order|login|account|cart|admin)(\/|$)/;
const HIDE_KEY = 'tl.live.hidden';

/** Small "N people are browsing TranzLife right now" pill. Real count only, shown from 3 people. */
export default function LiveVisitors() {
  const { pathname } = useLocation();
  const { site } = usePresence();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });

  useEffect(() => { startPresence(); }, []);
  useEffect(() => { presencePage(); }, [pathname]);

  if (hidden || !site || QUIET.test(pathname)) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } };
  return (
    <div className="live-pill" role="status" aria-live="off">
      <span className="live-pill__dot" aria-hidden="true" />
      <span><strong>{site}</strong> people are browsing TranzLife right now</span>
      <button type="button" onClick={close} aria-label="Hide this message"><X size={13} /></button>
    </div>
  );
}
