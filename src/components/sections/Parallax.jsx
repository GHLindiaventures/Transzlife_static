import { useEffect, useRef, useState } from 'react';
import { Media, Slot } from '../ui.jsx';
import { SCENES, PHOTOS } from '../../content/site.js';

const BASE = import.meta.env.BASE_URL;

/**
 * Pinned scroll scenes over a full-width landscape video.
 * The stage sticks while you scroll through the section; the video drifts and zooms (parallax),
 * the text drifts upward inside each scene, and the scenes swap as you scroll.
 */
export default function Parallax() {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const bgRef = useRef(null);
  const videoRef = useRef(null);
  const [scene, setScene] = useState(0);

  // the muted video only loads and plays while the section is on screen (and never with reduced motion)
  useEffect(() => {
    const v = videoRef.current, sec = sectionRef.current;
    if (!v || !sec) return undefined;
    v.muted = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const apply = () => {
      if (visible && !reduce.matches) {
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else v.pause();
    };
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; apply(); }, { rootMargin: '200px 0px' })
      : null;
    if (io) io.observe(sec); else { visible = true; apply(); }
    reduce.addEventListener('change', apply);
    return () => { if (io) io.disconnect(); reduce.removeEventListener('change', apply); };
  }, []);

  // the arrow moves on to the next scene (or past the section after the last one)
  const next = () => {
    const sec = sectionRef.current, st = stickyRef.current;
    if (!sec || !st) return;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const total = sec.offsetHeight - st.offsetHeight;
    const y = scene < 2 ? top + (total * (scene + 1)) / 3 + 2 : top + sec.offsetHeight;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };

  // scroll-linked parallax
  useEffect(() => {
    const onScroll = () => {
      const sec = sectionRef.current, st = stickyRef.current, bg = bgRef.current;
      if (!sec || !st || !bg) return;
      const total = sec.offsetHeight - st.offsetHeight;
      const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / total));
      const idx = Math.min(2, Math.floor(p * 3));
      setScene(idx);
      st.style.setProperty('--sp', (p * 3 - idx).toFixed(3)); // progress inside the current scene, 0..1
      bg.style.transform = `scale(${1.18 - p * 0.12}) translateY(${p * -5}%)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  const cls = (n) => `parallax__scene${scene === n ? ' is-active' : ''}`;

  return (
    <section className="parallax" id="parallax" ref={sectionRef}>
      <div className="parallax__sticky" ref={stickyRef}>
        <Media className="media--fill parallax__bg" id="parallaxBg" ref={bgRef} photo={PHOTOS.parallax}>
          {/* landscape background video (your own file in /public/assets/video) */}
          <video
            ref={videoRef}
            className="parallax__video"
            data-src={`${BASE}assets/video/forest-parallax.mp4`}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          />
        </Media>
        <div className="parallax__scrim" />

        <div className={cls(0)}>
          <div className="parallax__center">
            <Slot as="h2" className="slot--par-title">{SCENES[0].title}</Slot>
            <Slot as="p" className="slot--par-p">{SCENES[0].text}</Slot>
          </div>
        </div>
        <div className={cls(1)}>
          <div className="parallax__split">
            <Media className="media--par-side" photo={PHOTOS.parallaxSide[0]} />
            <div className="parallax__split-text"><Slot as="h2" className="slot--par-title-sm">{SCENES[1].title}</Slot><Slot as="p" className="slot--par-p-sm">{SCENES[1].text}</Slot></div>
          </div>
        </div>
        <div className={cls(2)}>
          <div className="parallax__split parallax__split--rev">
            <Media className="media--par-side" photo={PHOTOS.parallaxSide[1]} />
            <div className="parallax__split-text"><Slot as="h2" className="slot--par-title-sm">{SCENES[2].title}</Slot><Slot as="p" className="slot--par-p-sm">{SCENES[2].text}</Slot></div>
          </div>
        </div>
        <button className="parallax__arrow" type="button" aria-label={scene < 2 ? 'Next scene' : 'Continue'} onClick={next}>
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M1 1l9 9 9-9" /></svg>
        </button>
      </div>
    </section>
  );
}
