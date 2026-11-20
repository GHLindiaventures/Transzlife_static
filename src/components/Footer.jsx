import { forwardRef } from 'react';
import { Slot, range, stop } from './ui.jsx';

const SOCIAL = [
  { label: 'Social 1', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9 16V9h2.4l.4-3H9V4.3c0-.8.2-1.3 1.4-1.3H12V.4C11.7.3 10.8.2 9.8.2 7.6.2 6.1 1.5 6.1 4v2H3.7v3h2.4v7z" /></svg> },
  { label: 'Social 2', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 1.5l13 13M14.5 1.5l-13 13" /></svg> },
  { label: 'Social 3', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="14" height="14" rx="4" /><circle cx="8" cy="8" r="3.2" /><circle cx="12" cy="4" r=".6" fill="currentColor" /></svg> },
  { label: 'Social 4', svg: <svg width="18" height="16" viewBox="0 0 18 16" fill="currentColor"><path d="M1 3.5C1 2.1 2.1 1 3.5 1h11C15.9 1 17 2.1 17 3.5v9c0 1.4-1.1 2.5-2.5 2.5h-11C2.1 15 1 13.9 1 12.5zM7 5v6l5-3z" /></svg> },
];

const Footer = forwardRef(function Footer(_, ref) {
  return (
    <footer className="footer" id="footer" ref={ref}>
      <div className="footer__inner page-pad--lg">
        <div className="footer__cols">
          {range(3).map((c) => (
            <div className="footer__col" key={c}>
              <Slot as="h4" className="slot--f-head" />
              <ul>
                {range(5).map((i) => (
                  <li key={i}><a href="#" onClick={stop}><Slot className="slot--f-link" /></a></li>
                ))}
              </ul>
            </div>
          ))}
          <div className="footer__col footer__col--wide">
            <Slot as="h4" className="slot--f-head" />
            <Slot as="p" className="slot--f-address" />
            <Slot as="p" className="slot--f-address slot--f-address-2" />
          </div>
        </div>
        <ul className="footer__social">
          {SOCIAL.map((s) => (
            <li key={s.label}><a href="#" onClick={stop} aria-label={s.label}>{s.svg}</a></li>
          ))}
        </ul>
        <p className="footer__copy"><Slot className="slot--copy" /></p>
      </div>
    </footer>
  );
});

export default Footer;
