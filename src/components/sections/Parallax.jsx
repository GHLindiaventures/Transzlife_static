import { useEffect, useRef, useState } from 'react';
import { Media, Slot } from '../ui.jsx';

/** Pinned scroll scenes: a sticky stage swaps between 3 scenes while you scroll through the section. */
export default function Parallax() {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const bgRef = useRef(null);
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const sec = sectionRef.current, st = stickyRef.current, bg = bgRef.current;
      if (!sec || !st || !bg) return;
      const total = sec.offsetHeight - st.offsetHeight;
      const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / total));
      setScene(Math.min(2, Math.floor(p * 3)));
      bg.style.transform = `scale(${1.15 - p * 0.15}) translateY(${p * -4}%)`;
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
        <Media className="media--fill parallax__bg" id="parallaxBg" ref={bgRef} />
        <div className={cls(0)}>
          <div className="parallax__center">
            <Slot as="h2" className="slot--par-title" />
            <Slot as="p" className="slot--par-p" />
          </div>
        </div>
        <div className={cls(1)}>
          <div className="parallax__split">
            <Media className="media--par-side" />
            <div className="parallax__split-text"><Slot as="h2" className="slot--par-title-sm" /><Slot as="p" className="slot--par-p-sm" /></div>
          </div>
        </div>
        <div className={cls(2)}>
          <div className="parallax__split parallax__split--rev">
            <Media className="media--par-side" />
            <div className="parallax__split-text"><Slot as="h2" className="slot--par-title-sm" /><Slot as="p" className="slot--par-p-sm" /></div>
          </div>
        </div>
        <button className="parallax__arrow" type="button" aria-label="Scroll">
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l9 9 9-9" /></svg>
        </button>
      </div>
    </section>
  );
}
