import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Media, Slot, Ph, range } from '../ui.jsx';
import {
  RICH, BANNER, BENEFITS, STRIP, STORY_BLOCK, BRANDS, BGVIDEO, NEWSLETTER, HELP_CTA,
  PHOTOS,
} from '../../content/site.js';

export const Sep = ({ gap = false }) => <hr className={`sep${gap ? ' sep--gap' : ''}`} />;

/* ---------------- home page blocks ---------------- */

export function Rich() {
  return (
    <section className="rich">
      <div className="rich__inner" data-reveal>
        {RICH.eyebrow && <Slot as="p" className="slot--eyebrow">{RICH.eyebrow}</Slot>}
        <Slot as="h2" className="slot--rich">{RICH.title}</Slot>
        {RICH.text && <p className="rich__text">{RICH.text}</p>}
        {RICH.link && <Link className="link-btn link-btn--dark rich__link" to={RICH.link.to}><Slot className="slot--link">{RICH.link.label}</Slot></Link>}
      </div>
    </section>
  );
}

export function LeafIcon({ className = 'banner__leaf-icon' }) {
  return (
    <span className="banner__leaf-wrap" aria-hidden="true">
      <svg
        className={className}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Vibrant botanical leaf body */}
        <path
          d="M27.5 4.5C27.5 4.5 22 5 15.5 11C9 17 5 23 5 28C10 28 16 24 22 17.5C28 11 27.5 4.5 27.5 4.5Z"
          fill="#22c55e"
          stroke="#4ade80"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* High-contrast crisp center vein */}
        <path
          d="M5 28C11 22 17.5 16 27.5 4.5"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Side leaf veins for botanical detail */}
        <path
          d="M12 21C15 20.5 17 18.5 17.5 17"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        <path
          d="M16 16C19 15.5 21 13.5 21.5 12"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
      </svg>
    </span>
  );
}

/** Full-width banner with a scrolling headline and a button. */
export function Banner() {
  const cleanWords = BANNER.words.map((w) => w.replace(/\.+$/, ''));
  // Repeat sequence 3 times in each half to ensure seamless width on all displays
  const sequence = [...cleanWords, ...cleanWords, ...cleanWords];

  return (
    <section className="banner">
      <Media className="media--fill banner__bg" photo={PHOTOS.banner} />
      <div className="banner__shade" />
      <div className="banner__inner">
        <div className="banner__marquee" aria-hidden="true">
          {[0, 1].map((half) => (
            <div className="banner__marquee-group" key={half}>
              {sequence.map((w, idx) => (
                <span className="banner__item" key={idx}>
                  <Slot as="h2" className="slot--banner-title">{w}</Slot>
                  <LeafIcon />
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="visually-hidden">{cleanWords.join(' ')}</p>
        <Link className="btn btn--light" to={BANNER.to}><Slot className="slot--btn">{BANNER.cta}</Slot></Link>
      </div>
    </section>
  );
}

const BENEFIT_ICONS = [
  /* flask */ <><path d="M9 3h6M10 3v6l-5 9.2A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-2.8L14 9V3" /><path d="M7.6 15h8.8" /><path d="M12 17.5c0-1.2.8-2 2-2 0 1.2-.8 2-2 2z" /></>,
  /* microscope */ <><path d="M6 21h12" /><path d="M9 21v-1.5a5 5 0 0 1 5-5h.5" /><path d="M9.5 3.5l3.8 1.7-2.7 6.5-3.8-1.7z" /><path d="M14.5 14.5a4 4 0 0 0 2.5-3.7" /></>,
  /* badge check */ <><circle cx="12" cy="9" r="6" /><path d="M9.5 9l1.8 1.8L15 7.2" /><path d="M8.6 14l-1.4 7 4.8-2.6L16.8 21l-1.4-7" /></>,
  /* sprout in hand */ <><path d="M12 12.5V8" /><path d="M12 9c0-3 2-4.6 5-4.6 0 3-2 4.6-5 4.6z" /><path d="M12 11c0-2.6-1.8-3.9-4.5-3.9 0 2.6 1.8 3.9 4.5 3.9z" /><path d="M3.5 17.5c2 0 3-1 5-1h4c1.2 0 1.6 1.2.5 1.6H10" /><path d="M13 16.8l5-2.6c1-.5 2.1.6 1.3 1.5L15 20.5H8l-4.5-2" /></>,
  /* mortar + leaf */ <><path d="M4 12h16a8 8 0 0 1-16 0z" /><path d="M14 11l4.2-6.2" /><path d="M7.5 9c0-2.2 1.6-3.4 3.8-3.4 0 2.2-1.6 3.4-3.8 3.4z" /><path d="M9 20.5h6" /></>,
  /* shield check */ <><path d="M12 3l7 3v5.2c0 4.8-3.2 8.3-7 9.8-3.8-1.5-7-5-7-9.8V6z" /><path d="M8.8 12l2.2 2.2 4.2-4.6" /></>,
];

export function Benefits() {
  const col = (items, offset, right) => (
    <div className={`benefits__col${right ? ' benefits__col--right' : ''}`}>
      {items.map((b, i) => (
        <div className="benefit" data-reveal key={b.title}>
          <span className="benefit__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{BENEFIT_ICONS[offset + i]}</svg>
          </span>
          <div className="benefit__body">
            <Slot as="h3" className="slot--b-title">{b.title}</Slot>
            <Slot as="p" className="slot--b-text">{b.text}</Slot>
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <section className="benefits">
      <div className="benefits__inner page-pad--lg">
        <div className="benefits__head" data-reveal>
          <Slot as="h2" className="headline slot--headline">{BENEFITS.headline}</Slot>
          <Slot as="p" className="benefits__sub">{BENEFITS.subtitle}</Slot>
          <Slot as="p" className="benefits__lead">{BENEFITS.lead}</Slot>
        </div>
        <div className="benefits__grid">
          {col(BENEFITS.items.slice(0, 3), 0, false)}
          <div className="benefits__center">
            <div className="benefits__orb" role="img" aria-label="Tulsi, ginger, cloves, cinnamon and a wooden mortar on a stone" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/photos/why-tranzlife.webp)` }} data-reveal />
          </div>
          {col(BENEFITS.items.slice(3), 3, true)}
        </div>
      </div>
    </section>
  );
}

/** Small scrolling text strip. */
export function Strip({ items = STRIP }) {
  return (
    <section className="strip">
      <div className="strip__marquee" aria-hidden="true">
        {range(2).map((g) => (
          <div className="strip__group" key={g}>
            {[...items, ...items].map((t, i) => (
              <Fragment key={i}><Slot className="slot--strip">{t}</Slot><i /></Fragment>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ImageWithText() {
  return (
    <section className="iwt">
      <div className="iwt__media"><Media className="media--fill" photo={PHOTOS.iwt} data-reveal /></div>
      <div className="iwt__text">
        {STORY_BLOCK.eyebrow && <Slot as="p" className="slot--eyebrow" data-reveal>{STORY_BLOCK.eyebrow}</Slot>}
        <Slot as="h2" className="slot--iwt-title" data-reveal>{STORY_BLOCK.title}</Slot>
        {STORY_BLOCK.paragraphs.map((t) => <Slot as="p" className="slot--iwt-p" data-reveal key={t}>{t}</Slot>)}
        {STORY_BLOCK.link && (
          <div data-reveal><Link className="link-btn link-btn--dark iwt__link" to={STORY_BLOCK.link.to}><Slot className="slot--link">{STORY_BLOCK.link.label}</Slot></Link></div>
        )}
      </div>
    </section>
  );
}

export function Brands() {
  return (
    <section className="brands">
      <div className="brands__inner">
        <Slot as="h2" className="headline slot--headline" data-reveal>{BRANDS.headline}</Slot>
        <div className="brands__marquee">
          {range(2).map((g) => (
            // the second copy only exists to make the loop seamless: hidden from screen readers
            <ul className="brands__group" key={g} aria-hidden={g === 1 || undefined} aria-label={g === 0 ? BRANDS.headline : undefined}>
              {[...BRANDS.badges, ...BRANDS.badges].map((b, i) => (
                <li className="media media--logo" key={i} aria-hidden={i >= BRANDS.badges.length || undefined}>
                  <img src={`${import.meta.env.BASE_URL}assets/badges/${b.src}`} alt={b.alt} loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Background-video / Mint showcase block with parallax curtain reveal effect. `small` = the 560px version used on About / Science. */
export function BgVideo({ small = false, photo = BGVIDEO.photo, eyebrow = BGVIDEO.eyebrow, title = BGVIDEO.title }) {
  return (
    <section className={`bgvideo${small ? ' bgvideo--sm' : ''}`}>
      <div className="bgvideo__fixed" aria-hidden="true">
        <Media className="media--fill bgvideo__bg" photo={photo} />
        <div className="bgvideo__shade" />
      </div>
      <div className="bgvideo__inner" data-reveal>
        <Slot as="p" className="slot--eyebrow-w">{eyebrow}</Slot>
        <Slot as="h2" className="slot--bgv-title">{title}</Slot>
      </div>
    </section>
  );
}

const WC_ICONS = [
  /* chat bubble with dots */ <><path d="M4 5.5h16v10H12l-4.5 3.5v-3.5H4z" /><path d="M8.6 10.5h.01M12 10.5h.01M15.4 10.5h.01" /></>,
  /* sprout */ <><path d="M12 20v-8" /><path d="M12 13c0-3.4-2.2-5.3-5.6-5.3 0 3.4 2.2 5.3 5.6 5.3z" /><path d="M12 11c0-3 2-4.8 5.2-4.8 0 3-2 4.8-5.2 4.8z" /><path d="M8 20h8" /></>,
  /* open book */ <><path d="M3.5 5.5c3-1 5.5-.8 8.5 1 3-1.8 5.5-2 8.5-1v12c-3-1-5.5-.8-8.5 1-3-1.8-5.5-2-8.5-1z" /><path d="M12 6.5v12" /></>,
];

/** Closing call to action: talk to the wellness team (contact + FAQ). */
export function HelpCta() {
  return (
    <section className="wc">
      <div className="wc__inner">
        <div className="wc__content" data-reveal>
          <p className="wc__eyebrow">{HELP_CTA.eyebrow}</p>
          <h2 className="wc__title">{HELP_CTA.title} <em>{HELP_CTA.titleEm}</em></h2>
          <p className="wc__text">{HELP_CTA.text}</p>
          <div className="wc__actions">
            <Link className="wc__btn wc__btn--primary" to={HELP_CTA.primary.to}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{WC_ICONS[0]}</svg>
              {HELP_CTA.primary.label}
            </Link>
            <Link className="wc__btn wc__btn--ghost" to={HELP_CTA.secondary.to}>{HELP_CTA.secondary.label}</Link>
          </div>
          <ul className="wc__features">
            {HELP_CTA.features.map((f, i) => (
              <li key={f}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{WC_ICONS[i]}</svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="wc__media" data-reveal>
          <img
            src={`${import.meta.env.BASE_URL}assets/photos/wellness-lab.webp`}
            alt="Fresh green leaves in a glass laboratory flask and petri dish in soft morning light"
            width="1672" height="941" loading="lazy" decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

export function Newsletter({ small = false }) {
  return (
    <section className={`news${small ? ' news--sm' : ''}`}>
      <Media className="media--fill news__bg" />
      <div className="news__card" data-reveal>
        <Slot as="h2" className="slot--news-title">{NEWSLETTER.title}</Slot>
        <Slot as="p" className="slot--news-p">{NEWSLETTER.text}</Slot>
        <form className="news__form" onSubmit={(e) => e.preventDefault()}>
          <label className="news__field">
            <span className="visually-hidden">{NEWSLETTER.email}</span>
            <input type="email" autoComplete="email" placeholder={NEWSLETTER.email} />
          </label>
          <button className="btn btn--dark news__send" type="submit"><Slot className="slot--btn-sm">{NEWSLETTER.button}</Slot></button>
        </form>
      </div>
    </section>
  );
}

/* ---------------- inner page blocks (about / science / faq / blog / contact) ---------------- */

/** variant: '' (480) | 'about' (661) | 'dark' (580) */
export function PageBanner({ variant = '', title, photo }) {
  return (
    <section className={`pbanner${variant ? ` pbanner--${variant}` : ''}`}>
      <Media className="media--fill" photo={photo} />
      <div className="pbanner__shade" />
      <div className="pbanner__inner"><Slot as="h1" className="slot--pb-title">{title}</Slot></div>
    </section>
  );
}

export function Intro({ title, text }) {
  return (
    <section className={`pintro${text ? '' : ' pintro--title-only'}`}>
      <div className="pintro__inner" data-reveal>
        <Slot as="h2" className="slot--i-title">{title}</Slot>
        {text && <Slot as="p" className="slot--i-text">{text}</Slot>}
      </div>
    </section>
  );
}

/** Image + text row. reverse = image on the right. mod: '' | 'short' | 'tall' */
export function Row({ reverse = false, mod = '', title, text, photo }) {
  return (
    <section className={`iwt iwt--row${reverse ? ' iwt--rev' : ''}${mod ? ` iwt--${mod}` : ''}`}>
      <div className="iwt__media"><Media className="media--fill" photo={photo} data-reveal /></div>
      <div className="iwt__text">
        <Slot as="h2" className="slot--r-title" data-reveal>{title}</Slot>
        <Slot as="p" className="slot--r-text" data-reveal>{text}</Slot>
      </div>
    </section>
  );
}

/** Row of icon + title + text columns. cls: 'pfeat--science' | 'pfeat--plain' | '' */
export function Features({ cls = '', items }) {
  return (
    <section className={`pfeat ${cls}`.trim()}>
      <div className="pfeat__grid">
        {items.map((it) => (
          <div className="pfeat__item" data-reveal key={it.title}>
            <Media className="media--icon" />
            <Slot as="h3" className="slot--b-title">{it.title}</Slot>
            <Slot as="p" className="slot--b-text">{it.text}</Slot>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Note({ title, text, button }) {
  return (
    <section className={`pnote${button ? ' pnote--cta' : ''}`}>
      <div data-reveal>
        <Slot as="h2" className="slot--n-title">{title}</Slot>
        <Slot as="p" className="slot--n-text">{text}</Slot>
        {button && <Ph className="btn btn--dark"><Slot className="slot--btn-sm">{button}</Slot></Ph>}
      </div>
    </section>
  );
}
