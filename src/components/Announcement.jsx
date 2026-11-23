import { Slot } from './ui.jsx';
import { ANNOUNCEMENTS } from '../content/site.js';

export default function Announcement() {
  return (
    <aside className="announcement" id="announcement" aria-label="Announcements">
      <div className="announcement__track">
        {[0, 1].map((g) => (
          <div className="announcement__group" key={g} aria-hidden={g === 1 || undefined}>
            {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((t, i) => (
              <Slot key={i} className="slot--announce">{t}</Slot>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

