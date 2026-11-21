import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Slot } from './ui.jsx';
import { BRAND, FOOTER, SOCIAL_LINKS } from '../content/site.js';

const SOCIAL = [
  { label: 'Facebook', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9 16V9h2.4l.4-3H9V4.3c0-.8.2-1.3 1.4-1.3H12V.4C11.7.3 10.8.2 9.8.2 7.6.2 6.1 1.5 6.1 4v2H3.7v3h2.4v7z" /></svg> },
  { label: 'X', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M1.5 1.5l13 13M14.5 1.5l-13 13" /></svg> },
  { label: 'Instagram', svg: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="4" /><circle cx="8" cy="8" r="3.2" /><circle cx="12" cy="4" r=".6" fill="currentColor" /></svg> },
  { label: 'YouTube', svg: <svg width="18" height="16" viewBox="0 0 18 16" fill="currentColor" aria-hidden="true"><path d="M1 3.5C1 2.1 2.1 1 3.5 1h11C15.9 1 17 2.1 17 3.5v9c0 1.4-1.1 2.5-2.5 2.5h-11C2.1 15 1 13.9 1 12.5zM7 5v6l5-3z" /></svg> },
].filter((s) => SOCIAL_LINKS[s.label]);

function LinkColumn({ title, links }) {
  return (
    <nav className="footer__col" aria-label={title}>
      <Slot as="h2" className="slot--f-head">{title}</Slot>
      <ul>
        {links.map((l) => (
          <li key={l.label}><Link to={l.to}><Slot className="slot--f-link">{l.label}</Slot></Link></li>
        ))}
      </ul>
    </nav>
  );
}

const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`;

const Footer = forwardRef(function Footer(_, ref) {
  const phones = BRAND.phone.split('/').map((p) => p.trim());
  return (
    <footer className="footer" id="footer" ref={ref}>
      <div className="footer__inner page-pad--lg">
        <div className="footer__cols">
          <LinkColumn {...FOOTER.products} />
          <LinkColumn {...FOOTER.company} />
          <LinkColumn {...FOOTER.help} />
          <div className="footer__col footer__col--wide">
            <Slot as="h2" className="slot--f-head">{FOOTER.about.title}</Slot>
            <Slot as="address" className="slot--f-address">{BRAND.address}</Slot>
            <Slot as="p" className="slot--f-address">
              <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a><br />
              {phones.map((p, i) => <span key={p}>{i > 0 && ' / '}<a href={tel(p)}>{p}</a></span>)}
            </Slot>
            <Slot as="p" className="slot--f-address">{BRAND.hours}</Slot>
          </div>
        </div>
        {SOCIAL.length > 0 && (
          <ul className="footer__social">
            {SOCIAL.map((s) => (
              <li key={s.label}><a href={SOCIAL_LINKS[s.label]} target="_blank" rel="noopener noreferrer" aria-label={s.label}>{s.svg}</a></li>
            ))}
          </ul>
        )}
        <p className="footer__copy">
          <Slot className="slot--copy">{BRAND.copyright} · {BRAND.license}</Slot>
          <Slot className="slot--copy">{BRAND.disclaimer}</Slot>
        </p>
        <div className="footer__massive-brand" aria-hidden="true">
          <span className="footer__massive-text">
            {BRAND.wordmark || 'TranzLife'}
            <span className="footer__massive-reg">®</span>
          </span>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
