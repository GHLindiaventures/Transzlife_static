import { Fragment } from 'react';
import { Media, Slot, Ph, range } from '../ui.jsx';

export const Sep = ({ gap = false }) => <hr className={`sep${gap ? ' sep--gap' : ''}`} />;

/* ---------------- home page blocks ---------------- */

export function Rich() {
  return (
    <section className="rich">
      <div className="rich__inner" data-reveal>
        <Slot as="p" className="slot--eyebrow" />
        <Slot as="h2" className="slot--rich" />
      </div>
    </section>
  );
}

/** Full-width banner with a scrolling headline and a button. */
export function Banner() {
  return (
    <section className="banner">
      <Media className="media--fill banner__bg" />
      <div className="banner__shade" />
      <div className="banner__inner">
        <div className="banner__marquee" aria-hidden="true">
          {range(2).map((g) => (
            <div className="banner__marquee-group" key={g}>
              <Slot as="h2" className="slot--banner-title" />
              <Slot as="h2" className="slot--banner-title" />
            </div>
          ))}
        </div>
        <Ph className="btn btn--light"><Slot className="slot--btn" /></Ph>
      </div>
    </section>
  );
}

export function Benefits() {
  const col = (right) => (
    <div className={`benefits__col${right ? ' benefits__col--right' : ''}`}>
      {range(3).map((i) => (
        <div className="benefit" data-reveal key={i}>
          <Slot as="h3" className="slot--b-title" />
          <Slot as="p" className="slot--b-text" />
        </div>
      ))}
    </div>
  );
  return (
    <section className="benefits">
      <div className="benefits__inner page-pad--lg">
        <Slot as="h2" className="headline slot--headline" data-reveal />
        <div className="benefits__grid">
          {col(false)}
          <div className="benefits__center"><Media className="media--benefits" data-reveal /></div>
          {col(true)}
        </div>
      </div>
    </section>
  );
}

/** Small scrolling text strip. */
export function Strip() {
  return (
    <section className="strip">
      <div className="strip__marquee" aria-hidden="true">
        {range(2).map((g) => (
          <div className="strip__group" key={g}>
            {range(4).map((i) => (
              <Fragment key={i}><Slot className="slot--strip" /><i /></Fragment>
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
      <div className="iwt__media"><Media className="media--fill" data-reveal /></div>
      <div className="iwt__text">
        <Slot as="h2" className="slot--iwt-title" data-reveal />
        {range(3).map((i) => <Slot as="p" className="slot--iwt-p" data-reveal key={i} />)}
      </div>
    </section>
  );
}

export function Brands() {
  return (
    <section className="brands">
      <div className="brands__inner">
        <Slot as="h2" className="headline slot--headline" data-reveal />
        <div className="brands__marquee" aria-hidden="true">
          {range(2).map((g) => (
            <div className="brands__group" key={g}>
              {range(8).map((i) => <Media className="media--logo" key={i} />)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Background-video block. `small` = the 560px version used on About / Science. */
export function BgVideo({ small = false }) {
  return (
    <section className={`bgvideo${small ? ' bgvideo--sm' : ''}`}>
      <Media className="media--fill bgvideo__bg" />
      <div className="bgvideo__shade" />
      <div className="bgvideo__inner" data-reveal>
        <Slot as="p" className="slot--eyebrow-w" />
        <Slot as="h2" className="slot--bgv-title" />
      </div>
    </section>
  );
}

export function Newsletter({ small = false }) {
  return (
    <section className={`news${small ? ' news--sm' : ''}`}>
      <Media className="media--fill news__bg" />
      <div className="news__card" data-reveal>
        <Slot as="h2" className="slot--news-title" />
        <Slot as="p" className="slot--news-p" />
        <form className="news__form" onSubmit={(e) => e.preventDefault()}>
          <label className="news__field">
            <span className="visually-hidden">Email</span>
            <input type="email" autoComplete="email" />
          </label>
          <button className="btn btn--dark news__send" type="submit"><Slot className="slot--btn-sm" /></button>
        </form>
      </div>
    </section>
  );
}

/* ---------------- inner page blocks (about / science / faq / blog / contact) ---------------- */

/** variant: '' (480) | 'about' (661) | 'dark' (580) */
export function PageBanner({ variant = '' }) {
  return (
    <section className={`pbanner${variant ? ` pbanner--${variant}` : ''}`}>
      <Media className="media--fill" />
      <div className="pbanner__shade" />
      <div className="pbanner__inner"><Slot as="h1" className="slot--pb-title" /></div>
    </section>
  );
}

export function Intro({ withText = true }) {
  return (
    <section className={`pintro${withText ? '' : ' pintro--title-only'}`}>
      <div className="pintro__inner" data-reveal>
        <Slot as="h2" className="slot--i-title" />
        {withText && <Slot as="p" className="slot--i-text" />}
      </div>
    </section>
  );
}

/** Image + text row. reverse = image on the right. mod: '' | 'short' | 'tall' */
export function Row({ reverse = false, mod = '' }) {
  return (
    <section className={`iwt iwt--row${reverse ? ' iwt--rev' : ''}${mod ? ` iwt--${mod}` : ''}`}>
      <div className="iwt__media"><Media className="media--fill" data-reveal /></div>
      <div className="iwt__text">
        <Slot as="h2" className="slot--r-title" data-reveal />
        <Slot as="p" className="slot--r-text" data-reveal />
      </div>
    </section>
  );
}

/** Row of icon + title + text columns. cls: 'pfeat--science' | 'pfeat--plain' | '' */
export function Features({ cls = '', count = 4 }) {
  return (
    <section className={`pfeat ${cls}`.trim()}>
      <div className="pfeat__grid">
        {range(count).map((i) => (
          <div className="pfeat__item" data-reveal key={i}>
            <Media className="media--icon" />
            <Slot as="h3" className="slot--b-title" />
            <Slot as="p" className="slot--b-text" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Note({ cta = false }) {
  return (
    <section className={`pnote${cta ? ' pnote--cta' : ''}`}>
      <div data-reveal>
        <Slot as="h2" className="slot--n-title" />
        <Slot as="p" className="slot--n-text" />
        {cta && <Ph className="btn btn--dark"><Slot className="slot--btn-sm" /></Ph>}
      </div>
    </section>
  );
}
