import { Fragment } from 'react';
import { Media, Slot, Ph, range } from '../ui.jsx';
import {
  RICH, BANNER, BENEFITS, STRIP, STORY_BLOCK, BRANDS, BGVIDEO, NEWSLETTER,
  PHOTOS,
} from '../../content/site.js';

export const Sep = ({ gap = false }) => <hr className={`sep${gap ? ' sep--gap' : ''}`} />;

/* ---------------- home page blocks ---------------- */

export function Rich() {
  return (
    <section className="rich">
      <div className="rich__inner" data-reveal>
        <Slot as="p" className="slot--eyebrow">{RICH.eyebrow}</Slot>
        <Slot as="h2" className="slot--rich">{RICH.title}</Slot>
      </div>
    </section>
  );
}

/** Full-width banner with a scrolling headline and a button. */
export function Banner() {
  return (
    <section className="banner">
      <Media className="media--fill banner__bg" photo={PHOTOS.banner} />
      <div className="banner__shade" />
      <div className="banner__inner">
        <div className="banner__marquee" aria-hidden="true">
          {range(2).map((g) => (
            <div className="banner__marquee-group" key={g}>
              {BANNER.words.map((w) => <Slot as="h2" className="slot--banner-title" key={w}>{w}</Slot>)}
            </div>
          ))}
        </div>
        <Ph className="btn btn--light"><Slot className="slot--btn">{BANNER.cta}</Slot></Ph>
      </div>
    </section>
  );
}

export function Benefits() {
  const col = (items, right) => (
    <div className={`benefits__col${right ? ' benefits__col--right' : ''}`}>
      {items.map((b) => (
        <div className="benefit" data-reveal key={b.title}>
          <Slot as="h3" className="slot--b-title">{b.title}</Slot>
          <Slot as="p" className="slot--b-text">{b.text}</Slot>
        </div>
      ))}
    </div>
  );
  return (
    <section className="benefits">
      <div className="benefits__inner page-pad--lg">
        <Slot as="h2" className="headline slot--headline" data-reveal>{BENEFITS.headline}</Slot>
        <div className="benefits__grid">
          {col(BENEFITS.items.slice(0, 3), false)}
          <div className="benefits__center"><Media className="media--benefits" photo={PHOTOS.benefits} data-reveal /></div>
          {col(BENEFITS.items.slice(3), true)}
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
        <Slot as="h2" className="slot--iwt-title" data-reveal>{STORY_BLOCK.title}</Slot>
        {STORY_BLOCK.paragraphs.map((t) => <Slot as="p" className="slot--iwt-p" data-reveal key={t}>{t}</Slot>)}
      </div>
    </section>
  );
}

export function Brands() {
  return (
    <section className="brands">
      <div className="brands__inner">
        <Slot as="h2" className="headline slot--headline" data-reveal>{BRANDS.headline}</Slot>
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
export function BgVideo({ small = false, photo = BGVIDEO.photo, eyebrow = BGVIDEO.eyebrow, title = BGVIDEO.title }) {
  return (
    <section className={`bgvideo${small ? ' bgvideo--sm' : ''}`}>
      <Media className="media--fill bgvideo__bg" photo={photo} />
      <div className="bgvideo__shade" />
      <div className="bgvideo__inner" data-reveal>
        <Slot as="p" className="slot--eyebrow-w">{eyebrow}</Slot>
        <Slot as="h2" className="slot--bgv-title">{title}</Slot>
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
