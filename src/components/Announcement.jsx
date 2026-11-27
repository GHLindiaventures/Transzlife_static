import { Link } from 'react-router-dom';
import { Slot } from './ui.jsx';
import { ANNOUNCEMENTS, fillShopTokens } from '../content/site.js';
import { useSiteContent } from '../store/lib/siteContent.js';

const SPEED = { slow: '45s', normal: '30s', fast: '20s' };

/** One message; a link when staff gave it one (pages on this site open in place, others in a new tab). */
function Message({ m, hidden }) {
  const text = <Slot className="slot--announce">{m.text}</Slot>;
  if (!m.href) return text;
  const tab = hidden ? -1 : undefined;
  return m.href.startsWith('/')
    ? <Link to={m.href} className="announcement__link" tabIndex={tab}>{text}</Link>
    : <a href={m.href} className="announcement__link" target="_blank" rel="noopener noreferrer" tabIndex={tab}>{text}</a>;
}

/**
 * The scrolling bar at the top of every page. Messages, links, schedule and speed come from the
 * dashboard (Website content); the built-in list shows until they load, or if they can't.
 * Colours are always the brand green and gold (theme.css), so the bar never changes colour after loading.
 */
export default function Announcement() {
  const content = useSiteContent();
  const a = content?.announcement;
  const messages = a ? (a.messages.length ? a.messages : [{ text: 'Live naturally. Live healthier.' }]) : ANNOUNCEMENTS.map((t) => ({ text: fillShopTokens(t) }));
  return (
    <aside className="announcement" id="announcement" aria-label="Announcements">
      <div className="announcement__track" style={a ? { animationDuration: SPEED[a.speed] || SPEED.normal } : undefined}>
        {[0, 1].map((g) => (
          <div className="announcement__group" key={g} aria-hidden={g === 1 || undefined}>
            {[...messages, ...messages].map((m, i) => <Message key={i} m={m} hidden={g === 1 || i >= messages.length} />)}
          </div>
        ))}
      </div>
    </aside>
  );
}
