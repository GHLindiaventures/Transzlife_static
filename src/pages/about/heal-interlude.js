// About: the "Cure ≠ Heal" interlude between the prologue and chapter 01.
// Ported from Tranz-life/src/features/about/heal-interlude.js. Changes for this site: it works inside `root`,
// takes the sticky header's height (`top`) so the pinned part's progress is measured under the header, and
// returns a destroy() that removes its listeners, observers and animation frame.
// Wide screens: pinned, every part follows the scroll position (eased, so a flick of the wheel glides), so it
// reverses exactly. Phones: stacked; the parts come in one after another (CSS transitions) as it scrolls into view.
// Reduced motion: shown complete (CSS).
import { $, clamp, reduce } from './util.js';

const band = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const sm = x => x * x * (3 - 2 * x);
const SETTLE = 2.6;   // how quickly it catches up with the scroll (per second), as in the chapters below
const PARTS = [['--q', 0, .14], ['--a', .12, .22], ['--c', .2, .34], ['--h', .32, .62], ['--lb', .46, .7], ['--e', .72, .86]];

export function initHealInterlude(root, { top: offset = () => 0 } = {}){
  const sec = $('#heal', root);
  if (!sec || reduce) return () => {};
  const ac = new AbortController();
  const wide = matchMedia('(min-width: 900px)');
  const set = p => PARTS.forEach(([v, a, b]) => sec.style.setProperty(v, sm(band(p, a, b)).toFixed(3)));
  let pinned = false, raf = 0, near = false, shown = -1, last = 0, dead = false;

  // progress: starts as the section comes up the screen, so the question is already rising while the section
  // fills the view (Tranz-life started at 35 % from the top, which left the screen an empty panel until then)
  const target = () => {
    const off = offset(), r = sec.getBoundingClientRect(), vh = window.innerHeight - off, lead = vh * .85;
    return clamp((lead - (r.top - off)) / Math.max(1, r.height - vh + lead), 0, 1);
  };
  function frame(now){
    raf = 0;
    if (dead || !pinned || !near) return;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const goal = target();
    shown = shown < 0 ? goal : shown + (goal - shown) * (1 - Math.exp(-dt * SETTLE));
    if (Math.abs(goal - shown) < .0005) shown = goal;
    set(shown);
    raf = requestAnimationFrame(frame);
  }
  const nearIO = new IntersectionObserver(([e]) => {
    near = e.isIntersecting;
    if (near && pinned && !raf && !dead){ last = 0; raf = requestAnimationFrame(frame); }
  }, { rootMargin: '100px 0px' });
  nearIO.observe(sec);

  // phones: everything at once as it comes into view; the CSS staggers it
  const reveal = new IntersectionObserver(([e]) => { if (e.isIntersecting && !pinned){ set(1); reveal.disconnect(); } }, { threshold: .2 });

  function setMode(){
    pinned = wide.matches;
    sec.classList.toggle('is-pinned', pinned); sec.classList.toggle('is-static', !pinned);
    shown = -1;
    if (pinned){ set(target()); if (near && !raf){ last = 0; raf = requestAnimationFrame(frame); } }
    else { set(0); reveal.observe(sec); }
  }
  wide.addEventListener('change', setMode, { signal: ac.signal });
  setMode();

  return function destroy(){
    dead = true;
    ac.abort();
    nearIO.disconnect();
    reveal.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}
