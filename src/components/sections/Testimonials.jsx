import { useLayoutEffect, useRef, useState } from 'react';
import { Media, Slot, range } from '../ui.jsx';

const COUNT = 3;

export default function Testimonials() {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef(null);
  const go = (i) => setIdx((i + COUNT) % COUNT);

  // slide the track so the active quote is centred; recompute on resize
  useLayoutEffect(() => {
    const place = () => {
      const track = trackRef.current;
      if (!track) return;
      const slide = track.children[idx];
      const shift = slide.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft);
      track.style.transform = `translateX(${-shift}px)`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [idx]);

  return (
    <section className="testi">
      <div className="testi__viewport">
        <div className="testi__track" id="testiTrack" ref={trackRef}>
          {range(COUNT).map((n) => (
            <figure className={`testi__slide${n === idx ? ' is-active' : ''}`} key={n}>
              <Media className="media--avatar" />
              <Slot as="blockquote" className="slot--quote" />
              <Slot as="figcaption" className="slot--name" />
            </figure>
          ))}
        </div>
      </div>
      <div className="testi__nav">
        <button className="testi__arrow" type="button" aria-label="Previous" onClick={() => go(idx - 1)}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 1L1 7l6 6" /></svg>
        </button>
        <div className="testi__dots">
          {range(COUNT).map((n) => (
            <button key={n} className={`dot${n === idx ? ' is-active' : ''}`} type="button" aria-label={String(n + 1)} onClick={() => go(n)} />
          ))}
        </div>
        <button className="testi__arrow" type="button" aria-label="Next" onClick={() => go(idx + 1)}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l6 6-6 6" /></svg>
        </button>
      </div>
    </section>
  );
}
