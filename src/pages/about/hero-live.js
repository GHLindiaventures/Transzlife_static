// About hero: drifting gold dust on the right and a gentle parallax that follows the pointer and the scroll.
// Ported from initAboutHeroLive() in Tranz-life/src/about.js; returns a destroy() for the React page.
import { reduce } from './util.js';

export function initHeroLive(root){
  const hero = root.querySelector('#hero');
  const particles = root.querySelector('#aboutParticles');
  if (!hero || reduce) return () => {};
  const ac = new AbortController(), passive = { passive: true, signal: ac.signal };

  // A. subtle drifting golden dust, concentrated on the right side (58–94 % across, 20–75 % down)
  if (particles){
    particles.replaceChildren();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 18; i++){
      const dot = document.createElement('span');
      dot.className = 'about-gold-dot';
      dot.style.left = `${58 + Math.random() * 36}%`;
      dot.style.top = `${20 + Math.random() * 55}%`;
      const size = (2 + Math.random() * 3.5).toFixed(1);
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.setProperty('--dur', `${(4.5 + Math.random() * 4).toFixed(1)}s`);
      dot.style.setProperty('--del', `${(Math.random() * 5).toFixed(1)}s`);
      dot.style.setProperty('--drift-x', `${(-15 + Math.random() * 30).toFixed(0)}px`);
      frag.appendChild(dot);
    }
    particles.appendChild(frag);
  }

  // B. gentle foliage micro-parallax on pointer move and scroll
  let ticking = false, raf = 0, targetMx = 0, targetMy = 0, mx = 0, my = 0, scrollY = window.scrollY;
  function update(){
    mx += (targetMx - mx) * 0.1;
    my += (targetMy - my) * 0.1;
    hero.style.setProperty('--about-mx', mx.toFixed(4));
    hero.style.setProperty('--about-my', my.toFixed(4));
    hero.style.setProperty('--about-sy', scrollY.toFixed(1));
    if (Math.abs(targetMx - mx) > 0.001 || Math.abs(targetMy - my) > 0.001) raf = requestAnimationFrame(update);
    else { ticking = false; raf = 0; }
  }
  window.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    targetMx = (e.clientX / window.innerWidth) * 2 - 1;
    targetMy = (e.clientY / window.innerHeight) * 2 - 1;
    if (!ticking){ ticking = true; raf = requestAnimationFrame(update); }
  }, passive);
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    if (scrollY < window.innerHeight * 1.5) hero.style.setProperty('--about-sy', scrollY.toFixed(1));
  }, passive);

  return function destroy(){
    ac.abort();
    if (raf) cancelAnimationFrame(raf);
    if (particles) particles.replaceChildren();
  };
}
