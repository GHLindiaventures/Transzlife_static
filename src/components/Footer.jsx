import { forwardRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { openConsent } from '../store/lib/track.js';
import { BRAND, CONTACT, FOOTER, SOCIAL_LINKS } from '../content/site.js';
import '../styles/footer.css';
import { honeypotProps, isEmail, subscribe } from '../lib/forms.js';

/* ---------- small inline icons (stroke = currentColor) ---------- */
const I = {
  leaf: <><path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" /><path d="M5 19 14 10" /></>,
  building: <><path d="M4 21V5l8-2v18" /><path d="M12 9h7v12" /><path d="M7 8h2M7 12h2M7 16h2M15 13h1M15 17h1" /><path d="M2 21h20" /></>,
  help: <><circle cx="12" cy="12" r="9.5" /><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" /><path d="M12 17.4h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  phone: <path d="M20 16.5v3a1.8 1.8 0 0 1-2 1.8A17.8 17.8 0 0 1 2.7 6a1.8 1.8 0 0 1 1.8-2h3a1.8 1.8 0 0 1 1.8 1.5c.1 1 .4 1.9.7 2.8a1.8 1.8 0 0 1-.4 1.9L8.3 11.5a14.4 14.4 0 0 0 4.2 4.2l1.3-1.3a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.6 2.8.7a1.8 1.8 0 0 1 1.5 1.8z" />,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3.5 2" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  copy: <><circle cx="12" cy="12" r="9.5" /><path d="M14.8 9.6a3.6 3.6 0 1 0 0 4.8" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
};
const Icon = ({ name, size = 20, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>
);

/* social profiles: shown only once a real URL is set in SOCIAL_LINKS (site.js) */
export const SOCIAL = [   // also used on the account page
  { label: 'YouTube', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1z" /></svg> },
  { label: 'LinkedIn', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z" /></svg> },
  { label: 'Instagram', svg: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none" /></svg> },
  { label: 'X', svg: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4zm-1.2 17.9h1.9L7.1 4.2H5.1z" /></svg> },
  { label: 'Facebook', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22z" /></svg> },
].filter((s) => SOCIAL_LINKS[s.label]);

const COLUMN_ICONS = { Products: 'leaf', Company: 'building', Help: 'help' };
const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`;

function LinkColumn({ title, links, chevrons }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="ft-col" aria-label={title}>
      <button
        className="ft-col__head"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`ft-col-${title.toLowerCase()}`}
      >
        <Icon name={COLUMN_ICONS[title] || 'leaf'} size={24} />
        <span>{title}</span>
        <Icon name="chevron" size={16} className={`ft-col__chev ${isOpen ? 'ft-col__chev--open' : ''}`} />
      </button>
      <ul id={`ft-col-${title.toLowerCase()}`} className={`ft-col__list ${isOpen ? 'ft-col__list--open' : ''}`}>
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to}>
              <span>{l.label}</span>
              {chevrons && <Icon name="chevron" size={16} className="ft-col__chev" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Newsletter: saved on our server (see server/shop/enquiries.js); an email hand-off if that fails. */
function Subscribe() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [hp, setHp] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setState('error'); return; }
    setState('sending');
    try {
      await subscribe(email, 'footer', hp);
      setState('done');
    } catch (err) {
      if (err.status === 400) { setState('error'); return; }
      // server unreachable: fall back to an email so the sign-up is not lost
      window.location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent('Subscribe me to TranzLife updates')}&body=${encodeURIComponent(`Please add ${email.trim()} to the TranzLife wellness updates.`)}`;
      setState('done');
    }
  };

  return (
    <form className="ft-sub" onSubmit={onSubmit} noValidate>
      <input {...honeypotProps} value={hp} onChange={(e) => setHp(e.target.value)} />
      <label className="ft-sub__field">
        <span className="visually-hidden">Email address</span>
        <Icon name="mail" size={20} />
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'idle') setState('idle'); }} placeholder="Enter your email address" autoComplete="email" aria-invalid={state === 'error' ? 'true' : undefined} />
      </label>
      <button type="submit" className="ft-sub__btn" disabled={state === 'sending'}>
        {state === 'done' ? <>Thanks <Icon name="check" size={16} /></> : <>Subscribe <Icon name="chevron" size={16} /></>}
      </button>
      <p className="ft-sub__msg" role="status" aria-live="polite">
        {state === 'error' && 'Please enter a valid email address.'}
        {state === 'done' && (endpoint ? 'You are subscribed. Welcome to TranzLife!' : 'Your email app opened; send the message to finish subscribing.')}
      </p>
    </form>
  );
}

/* ---------- decorative top: wave, glass droplet with a sprout, leaves ---------- */
function Decor() {
  return (
    <div className="ft-decor" aria-hidden="true">
      <svg className="ft-wave" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ftRibbon" x1="0" x2="1">
            <stop offset="0" stopColor="#8fcf5a" />
            <stop offset=".45" stopColor="#d6ecb0" />
            <stop offset="1" stopColor="#b8e08a" />
          </linearGradient>
        </defs>
        <path d="M0 150C210 40 420 70 640 120s420 80 800-40V220H0z" fill="url(#ftRibbon)" opacity=".9" />
        <path d="M0 175C230 70 430 100 650 145s430 80 790-35V220H0z" className="ft-wave__fill" />
      </svg>
      <div className="ft-drop">
        <span className="ft-drop__tail" />
        <span className="ft-drop__ball">
          <svg viewBox="0 0 64 64" className="ft-drop__sprout">
            <path d="M32 58V34" />
            <path className="ft-l" d="M32 36C30 24 20 18 9 19c1 11 10 18 23 17z" />
            <path className="ft-l" d="M32 32C34 20 44 13 56 14c-1 12-11 19-24 18z" />
          </svg>
        </span>
      </div>
      <svg className="ft-leaf ft-leaf--a" viewBox="0 0 64 64"><path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" /><path d="M6 54 40 20" /></svg>
      <svg className="ft-leaf ft-leaf--b" viewBox="0 0 64 64"><path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" /><path d="M6 54 40 20" /></svg>
      <svg className="ft-leaf ft-leaf--c" viewBox="0 0 64 64"><path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" /><path d="M6 54 40 20" /></svg>
    </div>
  );
}

const Footer = forwardRef(function Footer(_, ref) {
  const year = new Date().getFullYear();

  // curtain reveal: the footer waits behind the page and is uncovered as the page lifts away.
  // --ftp: 0 (the curtain's lower edge is at the bottom of the screen) to 1 (fully revealed); --ftr: how far the footer lags (px).
  useEffect(() => {
    const el = document.getElementById('footer');
    const curtain = el && el.previousElementSibling;           // <main>: its lower edge is the footer's natural top
    if (!el || !curtain || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    // fixed footer only on larger screens: on phones the URL bar resizing innerHeight makes the
    // fixed/curtain mode flip mid-scroll, which shows up as a glitch
    const desktop = window.matchMedia('(min-width: 990px)');
    let raf = 0;
    let h = 0;
    const measure = () => {
      h = el.offsetHeight;
      // no lag on phones: the footer is one screen tall and the page can't scroll far enough to finish the reveal, leaving a gap
      el.style.setProperty('--ftr', window.innerWidth <= 640 ? '0px' : Math.round(Math.min(h, window.innerHeight * 0.7)) + 'px');
      const fixed = desktop.matches && h > 0 && h <= window.innerHeight;
      const root = document.documentElement;
      root.classList.toggle('ft-fixed', fixed);
      if (fixed) root.style.setProperty('--ft-h', h + 'px');
    };
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const p = (vh - curtain.getBoundingClientRect().bottom) / vh;
      el.style.setProperty('--ftp', Math.max(0, Math.min(1, p)).toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { measure(); onScroll(); };
    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <footer className="footer ft" id="footer" ref={ref}>
      <Decor />

      <div className="ft-body">
        <svg className="ft-leaf ft-leaf--d" viewBox="0 0 64 64" aria-hidden="true"><path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" /><path d="M6 54 40 20" /></svg>
        <svg className="ft-leaf ft-leaf--e" viewBox="0 0 64 64" aria-hidden="true"><path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" /><path d="M6 54 40 20" /></svg>
        <div className="ft-grid">
          {/* brand */}
          <div className="ft-brand">
            <Link to="/" className="ft-logo" aria-label={`${BRAND.name}, home`}>
              <span className="ft-logo__word">Tran<span className="ft-logo__z">z<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M4 36C14 12 34 4 60 4 52 26 30 38 4 36z" /><path d="M4 36 38 16" /></svg></span>Life</span>
              <sup>®</sup>
            </Link>
            <p className="ft-brand__tag">{FOOTER.tagline}</p>
            <span className="ft-brand__rule" aria-hidden="true" />
            <p className="ft-brand__text">{FOOTER.blurb}</p>
            {SOCIAL.length > 0 && (
              <ul className="ft-social">
                {SOCIAL.map((s) => (
                  <li key={s.label}><a href={SOCIAL_LINKS[s.label]} target="_blank" rel="noopener noreferrer" aria-label={s.label}>{s.svg}</a></li>
                ))}
              </ul>
            )}
          </div>

          <LinkColumn {...FOOTER.products} chevrons />
          <LinkColumn {...FOOTER.company} />
          <LinkColumn {...FOOTER.help} />

          {/* stay connected + about */}
          <div className="ft-card">
            <div className="ft-card__head">
              <span className="ft-card__ic"><Icon name="mail" size={26} /></span>
              <h2>Stay Connected</h2>
            </div>
            <p className="ft-card__text">Get wellness tips, product updates and more, straight to your inbox.</p>
            <Subscribe />
            <hr />
            <h3 className="ft-card__about"><Icon name="leaf" size={22} /> {FOOTER.about.title}</h3>
            <ul className="ft-card__list">
              <li><Icon name="pin" size={20} /><address>{BRAND.address}</address></li>
              <li><Icon name="phone" size={20} /><span>{CONTACT.phones.map((p, i) => <span key={p}>{i > 0 && ' / '}<a href={tel(p)}>{p}</a></span>)}</span></li>
              <li><Icon name="mail" size={20} /><a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></li>
              <li><Icon name="clock" size={20} /><span>{BRAND.hours}</span></li>
            </ul>
          </div>
        </div>

        <div className="ft-bottom">
          <p className="ft-bottom__copy"><Icon name="copy" size={18} /> {year} {BRAND.name} &nbsp;|&nbsp; {BRAND.license}</p>
          <p className="ft-bottom__motto">
            {FOOTER.motto.map((m, i) => <span key={m}>{i > 0 && <i aria-hidden="true">•</i>}{m}</span>)}
          </p>
          {FOOTER.legal.length > 0 && (
            <nav className="ft-bottom__links" aria-label="Legal">
              {FOOTER.legal.map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}
              <button type="button" className="ft-privacy-btn" onClick={openConsent}>Privacy choices</button>
            </nav>
          )}
        </div>
        <p className="ft-disclaimer">{BRAND.disclaimer}</p>
      </div>
    </footer>
  );
});

export default Footer;
