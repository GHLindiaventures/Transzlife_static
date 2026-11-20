import { useState } from 'react';
import { Slot } from './ui.jsx';
import { ANNOUNCEMENTS } from '../content/site.js';

export default function Announcement() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <section className="announcement" id="announcement">
      <div className="announcement__track">
        {[0, 1].map((g) => (
          <div className="announcement__group" key={g} aria-hidden={g === 1 || undefined}>
            {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((t, i) => <Slot key={i} className="slot--announce">{t}</Slot>)}
          </div>
        ))}
      </div>
      <button className="announcement__close" aria-label="Close" type="button" onClick={() => setOpen(false)}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l8 8M9 1L1 9" /></svg>
      </button>
    </section>
  );
}
