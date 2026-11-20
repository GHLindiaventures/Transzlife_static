// About page story: the prologue's spotlight, five chapters on one pinned stage, the chapter rail and the epilogue.
// Ported from Tranz-life/src/features/about/about-story.js. Changes for this site:
//  - initAboutStory(root, { top }) works inside `root` and returns a destroy() that removes every listener,
//    observer and animation frame (the React page mounts and unmounts it);
//  - `top` is the height of this site's sticky header: the pinned stage sticks below it, so the scroll maths
//    uses the space under the header instead of the whole window;
//  - the rail's prologue thumbnail is the hero image used here.
//
// Wide screens (pinned): the scroll position g (0..N, in chapters) drives everything, so it reverses exactly and
// never takes the scroll over. For chapter i at u = g - i:
//   u  -.17 .. .17   title card ("01 Roots") and letterbox bars pass; the background cross-fades under them
//   u   0 .. .22     focus in: the scene comes forward out of a blur
//   u  .02 .. .32    its entrance (--en 0 -> 1), different for every chapter
//   u  .32 .. .85    hold: still and readable; the chapter's own scroll detail plays (film strip, compass, steps)
//   u  .85 .. 1      focus out: it blurs and recedes (not the last one)
// g is eased towards the scroll position (SETTLE), so a flick of the wheel becomes a glide rather than a jump.
// Phones, small windows and reduced motion (static): the scenes are stacked; each one's entrance runs once as it
// comes into view (or not at all with reduced motion).
import { $, $$, clamp, lerp, ease, reduce } from './util.js';

const sm = x => x * x * (3 - 2 * x);
const IN = .22, OUT = .15, ENTER = .3, TITLE = .17, LB = .24;
const SETTLE = 2.6;   // how quickly the story catches up with the scroll (per second; lower is softer)
const HERO_THUMB = '/assets/about/about-hero-tree-science.webp';

export function initAboutStory(root, { top: offset = () => 0 } = {}){
  const ast = $('#story', root);
  if (!ast) return () => {};
  const ac = new AbortController(), on = { signal: ac.signal }, passive = { passive: true, signal: ac.signal };
  const observers = [];
  const observe = (cb, opts) => { const o = new IntersectionObserver(cb, opts); observers.push(o); return o; };
  let dead = false;

  const scenes = $$('.ast-scene', ast), N = scenes.length;
  ast.style.setProperty('--n', N);
  const hero = $('#hero', root), cta = $('#cta', root);
  const title = $('#astTitle', root), titleNo = $('.ast-title-no', title), titleName = $('.ast-title-name', title);
  const lb = $('.ast-letterbox', ast), rail = $('#astRail', root), bar = $('.ast-progress', root), barFill = $('#astProgress', root);
  const wide = matchMedia('(min-width: 900px)');
  const S = scenes.map(el => ({ el, body: $('.ast-body', el), bg: $('.ast-bg', el), en: -1, live: null, dark: el.classList.contains('ast-dark') }));
  const byId = Object.fromEntries(scenes.map((el, i) => [el.id, i]));

  // ---------- chapter rail: prologue, the chapters, epilogue
  const thumb = el => ($('.ast-visual img', el) || $('.ast-bg img', el)).getAttribute('src');
  const stops = [
    { id: 'hero', no: '00', name: 'Prologue', img: HERO_THUMB },
    ...scenes.map(el => ({ id: el.id, no: el.dataset.no, name: el.dataset.name, img: thumb(el) })),
    { id: 'cta', no: '06', name: 'Epilogue', img: '' }
  ];
  rail.innerHTML = `<ol>${stops.map((s, i) => `<li><a href="#${s.id}" data-i="${i}"><span class="ar-name">${s.name}</span><span class="ar-thumb"${s.img ? ` style="background-image:url('${s.img}')"` : ' style="background:linear-gradient(160deg,#f6ecd6,#e9c99a)"'}><i>${s.no}</i></span></a></li>`).join('')}</ol>`;
  const railLinks = $$('a', rail), railList = $('ol', rail);

  // ---------- geometry (vh = the stage height: the window under the sticky header)
  let top = 0, H = 1, vh = window.innerHeight, off = 0, pinned = false;
  const measure = () => { off = offset(); vh = window.innerHeight - off; top = ast.getBoundingClientRect().top + window.scrollY; H = ast.offsetHeight; };
  const g = () => clamp((window.scrollY + off - top) / Math.max(1, H - vh), 0, 1) * N;
  const sceneY = i => pinned ? top - off + (i + .5) / N * (H - vh) : scenes[i].getBoundingClientRect().top + window.scrollY - off - 60;
  function targetY(id){
    if (id === 'hero') return 0;
    if (id === 'cta') return cta.getBoundingClientRect().top + window.scrollY - off;
    return id in byId ? sceneY(byId[id]) : null;
  }
  const go = (y, instant) => window.scrollTo({ top: y, behavior: instant || reduce ? 'auto' : 'smooth' });

  // in-page links (the rail, "Begin the story"): land in the middle of a chapter, where it is still and readable
  root.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const y = targetY(id);
    if (y != null){ e.preventDefault(); go(y); return; }
    const t = document.getElementById(id);
    if (t){ e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  }, on);
  // keyboard focus moving into a scene that isn't on screen: bring that scene up
  ast.addEventListener('focusin', e => {
    if (!pinned) return;
    const i = scenes.findIndex(el => el.contains(e.target));
    if (i >= 0 && !S[i].el.classList.contains('is-live')) go(sceneY(i), true);
  }, on);

  // ---------- chapter details
  // 01 roots: ten ingredients orbit the mortar on one ring, evenly spaced: behind it at the back, in front at
  // the front; on the way in they spiral out of it one after another
  const herbs = $$('.ast-orbit li', scenes[byId.roots] || ast);
  const rootsFig = $('.ast-roots-visual', ast);
  function orbit(en, u, t){
    if (!herbs.length || !rootsFig) return;
    // one ring around the bowl's belly, seen slightly from above: wide enough to clear the bowl, flat enough to read
    // as a ring (Tranz-life used .64 / .30, which scattered the herbs well away from the mortar); narrower when
    // stacked (phones), so none goes past the edge. The faint track and the ground shadow (about-fit.css) use the
    // same ellipse, through --orx / --ory / --ocy.
    const w = rootsFig.clientWidth, rx = w * (pinned ? .56 : .46), ry = w * (pinned ? .19 : .17), n = herbs.length;
    const ph = $('.ast-photo', rootsFig), cy = ph.offsetTop + ph.offsetHeight * .62 - rootsFig.clientHeight / 2;   // around the bowl
    if (rootsFig._rx !== rx || rootsFig._cy !== cy){
      rootsFig._rx = rx; rootsFig._cy = cy;
      rootsFig.style.setProperty('--orx', rx.toFixed(1) + 'px');
      rootsFig.style.setProperty('--ory', ry.toFixed(1) + 'px');
      rootsFig.style.setProperty('--ocy', cy.toFixed(1) + 'px');
    }
    const spin = t * .14 + u * .6;
    herbs.forEach((h, k) => {
      const e = clamp(en * 1.8 - k * .08, 0, 1), eo = ease.out(e);
      const a = k / n * Math.PI * 2 + spin + (1 - e) * 1.8;          // equal spacing; spiral out of the centre
      const d = Math.sin(a), sc = (.66 + .34 * (d + 1) / 2) * (.3 + .7 * eo);
      const x = Math.cos(a) * rx * eo, y = d * ry * eo + cy + Math.sin(t * 1.1 + k) * 4;
      h.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${(Math.sin(t * .5 + k) * 8).toFixed(1)}deg) scale(${sc.toFixed(3)})`;
      h.style.opacity = sm(e).toFixed(3);
      h.style.zIndex = d > 0 && e > .5 ? 3 : 1;
      const far = d < -.35;
      if (far !== h._far){ h.classList.toggle('is-far', far); h._far = far; }
    });
  }
  // 02 science: counters and steps
  const counters = $$('[data-count]', ast), steps = $$('.ast-steps li', ast);
  function count(p){ counters.forEach(c => { c.textContent = Math.round(+c.dataset.count * ease.out(clamp(p, 0, 1))); }); }
  function light(p){ steps.forEach((s, k) => s.classList.toggle('is-lit', p > .06 + k * .22)); }
  // 02 science: the lab film plays only while its chapter is on screen (fetched part-way through chapter 01, so it is
  // ready in time); reduced motion and data saver keep its poster
  const labVid = $('#astLabFilm', ast), saveData = !!(navigator.connection && navigator.connection.saveData);
  let labOn = false, labSeen = false, near = false;
  const loadLab = () => { if (labVid && !labVid.getAttribute('src') && !reduce && !saveData){ labVid.src = labVid.dataset.src; labVid.preload = 'auto'; } };
  function labFilm(want){
    want = want && near;
    if (!labVid || want === labOn) return;
    labOn = want;
    if (want){ loadLab(); if (labVid.getAttribute('src')) labVid.play().catch(() => {}); } else labVid.pause();
  }
  if (labVid) observe(([e]) => { labSeen = e.isIntersecting; if (!pinned) labFilm(labSeen); }, { threshold: .25 }).observe(labVid);
  // 03 recognition: the film strip
  const film = $('.ast-film', ast), track = $('.ast-film-track', ast), frames = track ? $$('li', track) : [];
  function roll(p){
    if (!track) return;
    const span = Math.max(0, track.scrollWidth - film.clientWidth), q = sm(clamp(p, 0, 1));
    track.style.setProperty('--tx', (-span * q).toFixed(1) + 'px');
    const now = Math.round(q * (frames.length - 1));
    frames.forEach((f, k) => f.classList.toggle('is-now', k === now));
  }
  // 04 compass: the values turn under the needle
  const dial = $('#astDial', root), values = dial ? $$('.ast-values li', dial) : [], core = dial && $('.ast-dial-core', dial);
  if (dial){
    // ticks every 12°, a major one at each value
    $('.adf-ticks', dial).innerHTML = Array.from({ length: 30 }, (_, k) => {
      const a = k * 12 * Math.PI / 180, major = k % 6 === 0, r1 = major ? 84 : 89;
      return `<line class="${major ? 'major' : ''}" x1="${(100 + Math.sin(a) * r1).toFixed(1)}" y1="${(100 - Math.cos(a) * r1).toFixed(1)}" x2="${(100 + Math.sin(a) * 94).toFixed(1)}" y2="${(100 - Math.cos(a) * 94).toFixed(1)}"/>`;
    }).join('');
  }
  let valueOn = -1;
  function compass(p){
    if (!dial) return;
    const f = clamp(p, 0, 1) * (values.length - 1), at = Math.round(f);
    dial.style.setProperty('--rot', (-f * 72).toFixed(2) + 'deg');
    if (at !== valueOn){
      valueOn = at;
      values.forEach((v, k) => v.classList.toggle('is-on', k === at));
      $('b', core).textContent = $('b', values[at]).textContent;
      $('span', core).textContent = $('span', values[at]).textContent;
      core.classList.remove('swap'); void core.offsetWidth; core.classList.add('swap');
    }
  }
  // 05 frontier: a particle field that gathers into a turning double helix (a band along the foot of the scene)
  const pc = $('.ast-frontier .ast-particles', ast), pctx = pc && pc.getContext('2d');
  const P = Array.from({ length: 140 }, (_, k) => ({ x: Math.random(), y: Math.random(), k, s: .6 + Math.random() * 1.6, ph: Math.random() * 6.28 }));
  let PW = 1, PH = 1;
  function sizeParticles(){ if (!pc) return; const r = pc.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); PW = Math.max(1, r.width); PH = Math.max(1, r.height); pc.width = PW * d; pc.height = PH * d; pctx.setTransform(d, 0, 0, d, 0, 0); }
  function particles(en, t){
    if (!pctx) return;
    pctx.clearRect(0, 0, PW, PH);
    // a horizontal band along the foot of the scene, clear of the text
    const cy = PH * .88, amp = Math.min(PH * .055, 46), x0 = PW * .03, len = PW * .94, e = ease.io(clamp(en, 0, 1));
    P.forEach(q => {
      const strand = q.k % 2, j = Math.floor(q.k / 2) / (P.length / 2);
      const a = j * Math.PI * 6 + t * .6 + strand * Math.PI, z = Math.cos(a);
      const hx = x0 + j * len, hy = cy + Math.sin(a) * amp;
      const fx = (q.x * PW + Math.sin(t * .3 + q.ph) * 20), fy = (q.y * PH + Math.cos(t * .25 + q.ph) * 20);
      const x = lerp(fx, hx, e), y = lerp(fy, hy, e), r = q.s * (1 + .5 * e * (z + 1) / 2);
      pctx.fillStyle = strand ? `rgba(231,198,128,${(.35 + .45 * e * (z + 1) / 2).toFixed(3)})` : `rgba(140,220,200,${(.3 + .45 * e * (z + 1) / 2).toFixed(3)})`;
      pctx.beginPath(); pctx.arc(x, y, r, 0, 6.283); pctx.fill();
    });
    // rungs between the strands once gathered
    if (e > .6){
      pctx.strokeStyle = `rgba(242,247,238,${((e - .6) * .3).toFixed(3)})`; pctx.lineWidth = 1;
      for (let j = 0; j < 1; j += 1 / 22){
        const a = j * Math.PI * 6 + t * .6, x = x0 + j * len;
        pctx.beginPath(); pctx.moveTo(x, cy + Math.sin(a) * amp); pctx.lineTo(x, cy + Math.sin(a + Math.PI) * amp); pctx.stroke();
      }
    }
  }
  const hook = {
    roots: (s, en, u, h, t) => orbit(en, u, t),
    science: (s, en, u, h) => { count((en - .3) / .7); light(h); },
    recognition: (s, en, u, h) => roll((h - .08) / .84),
    compass: (s, en, u, h) => compass((h - .04) / .86),
    frontier: (s, en, u, h, t) => particles(en, t)
  };

  // ---------- the pinned frame
  let tNow = 0, last = performance.now(), raf = 0, titleAt = -1;
  let Gs = -1;   // the eased scroll position
  function pinnedFrame(t, dt){
    const target = g();
    Gs = Gs < 0 || !dt ? target : Gs + (target - Gs) * (1 - Math.exp(-dt * SETTLE));
    if (Math.abs(target - Gs) < .0004) Gs = target;
    const G = Gs;
    if (G > .4) loadLab();   // fetch the lab film part-way through chapter 01, not with the page
    S.forEach((s, i) => {
      const u = G - i, lastOne = i === N - 1;
      const live = u > -TITLE - .02 && (lastOne || u < 1 + .08);
      if (live !== s.live){
        s.live = live; s.el.classList.toggle('is-live', live);
        if (s.el.id === 'science') labFilm(live);
      }
      if (!live) return;
      s.el.style.setProperty('--bg', i === 0 ? 1 : sm(clamp((u + .08) / .18, 0, 1)).toFixed(3));
      const fi = sm(clamp(u / IN, 0, 1)), fo = lastOne ? 0 : sm(clamp((u - (1 - OUT)) / OUT, 0, 1));
      const blur = (1 - fi) * 14 + fo * 16, sc = (1 + (1 - fi) * .08) * (1 - fo * .1);
      s.body.style.opacity = (fi * (1 - fo)).toFixed(3);
      s.body.style.transform = `translate3d(0, ${((1 - fi) * 3 - fo * 3).toFixed(2)}vh, 0) scale(${sc.toFixed(4)})`;
      s.body.style.filter = blur > .2 ? `blur(${blur.toFixed(1)}px)` : '';
      const en = clamp((u - .02) / ENTER, 0, 1);
      if (Math.abs(en - s.en) > .001){ s.en = en; s.el.style.setProperty('--en', en.toFixed(3)); }
      const h = clamp((u - ENTER) / (1 - ENTER - OUT), 0, 1);
      hook[s.el.id]?.(s, en, u, h, t);
    });
    // title card + letterbox around the nearest chapter boundary
    const b = clamp(Math.round(G), 0, N - 1), d = G - b, a = sm(clamp(1 - Math.abs(d) / TITLE, 0, 1));
    if (b !== titleAt){ titleAt = b; titleNo.textContent = scenes[b].dataset.no; titleName.textContent = scenes[b].dataset.name; }
    title.style.opacity = a.toFixed(3);
    title.style.transform = `translate3d(${(-d * 50).toFixed(2)}vw, -50%, 0) scale(${(1 + (1 - a) * .12).toFixed(3)})`;
    lb.style.setProperty('--lb', sm(clamp(1 - Math.abs(d) / LB, 0, 1)).toFixed(3));
  }

  // ---------- stacked (static) mode: entrances once, as each scene comes into view
  const io = observe(es => es.forEach(e => {
    if (!e.isIntersecting || pinned) return;
    const el = e.target; el.classList.add('is-in');
    if (el.id === 'science'){
      if (reduce){ count(1); light(1); return; }
      const t0 = performance.now();
      const run = now => { if (dead) return; const p = (now - t0) / 2400; count(p); light(p * 1.2); if (p < 1) requestAnimationFrame(run); };
      requestAnimationFrame(run);
    }
    if (el.id === 'compass') compass(0);
  }), { threshold: .2 });

  function staticFrame(t){
    // only the living details: the orbit and the particle field, while their scenes are on screen
    const r1 = scenes[byId.roots]?.getBoundingClientRect(), r5 = scenes[byId.frontier]?.getBoundingClientRect();
    const winH = window.innerHeight;
    if (r1 && r1.bottom > 0 && r1.top < winH) orbit(reduce ? 1 : (scenes[byId.roots].classList.contains('is-in') ? 1 : 0), 0, reduce ? 0 : t);
    if (r5 && r5.bottom > 0 && r5.top < winH) particles(scenes[byId.frontier].classList.contains('is-in') ? 1 : 0, reduce ? 0 : t);
  }

  function loop(now){
    raf = 0;
    if (dead || !near) return;
    const dt = Math.min(.05, (now - last) / 1000); tNow += dt; last = now;
    if (pinned) pinnedFrame(tNow, dt); else staticFrame(tNow);
    raf = requestAnimationFrame(loop);
  }
  observe(([e]) => {
    near = e.isIntersecting;
    if (!near) labFilm(false);
    if (near && !raf && !dead){ last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: '200px 0px' }).observe(ast);

  // ---------- rail + progress (on scroll)
  let railOn = -1;
  function onScroll(){
    const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    let i = 0;
    const ctaTop = cta.getBoundingClientRect().top - off;
    if (ctaTop < vh * .55) i = N + 1;
    else if (pinned){ if (y + off >= top - vh * .5) i = 1 + clamp(Math.floor(g() + .14), 0, N - 1); }
    else { scenes.forEach((el, k) => { if (el.getBoundingClientRect().top - off < vh * .5) i = k + 1; }); }
    if (i !== railOn){
      railOn = i;
      railLinks.forEach((a, k) => { a.classList.toggle('is-on', k === i); if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
      rail.classList.toggle('on-dark', i >= 1 && i <= N && S[i - 1].dark);
    }
    const rp = (y / max).toFixed(4);
    railList.style.setProperty('--rp', clamp(i / (stops.length - 1), 0, 1).toFixed(3));
    bar.style.setProperty('--rp', rp);
  }
  window.addEventListener('scroll', onScroll, passive);

  // ---------- modes
  function setMode(){
    const p = wide.matches && !reduce;
    pinned = p; Gs = -1;
    ast.classList.toggle('is-pinned', p); ast.classList.toggle('is-static', !p);
    rail.classList.toggle('is-on', wide.matches); bar.classList.toggle('is-on', !wide.matches);
    S.forEach(s => {
      s.live = null; s.en = -1;
      s.el.classList.remove('is-live');
      ['--en', '--bg'].forEach(v => s.el.style.removeProperty(v));
      ['opacity', 'transform', 'filter'].forEach(v => { s.body.style[v] = ''; });
    });
    if (!p) scenes.forEach(el => io.observe(el)); else scenes.forEach(el => { el.classList.remove('is-in'); io.unobserve(el); });
    measure(); sizeParticles(); onScroll();
    labFilm(false);
    if (p) pinnedFrame(tNow);
    else { labFilm(labSeen); count(reduce ? 1 : 0); light(reduce ? 1 : 0); compass(0); roll(0); }
  }
  wide.addEventListener('change', setMode, on);
  window.addEventListener('resize', () => { measure(); sizeParticles(); onScroll(); }, on);
  window.addEventListener('load', () => { measure(); onScroll(); }, on);
  setMode();
  // images above the story (the hero) can change its position once loaded: measure again then
  root.addEventListener('load', () => { measure(); onScroll(); }, { capture: true, signal: ac.signal });

  // ---------- epilogue: daylight returns
  observe(([e]) => { if (e.isIntersecting) cta.classList.add('is-in'); }, { threshold: .3 }).observe(cta);

  // ---------- prologue spotlight: a clear lens at the pointer; on touch screens it drifts by itself
  let sraf = 0;
  if (hero && !reduce){
    let user = 0, heroOn = true;
    const t0 = performance.now();
    hero.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--sx', (e.clientX - r.left).toFixed(0) + 'px');
      hero.style.setProperty('--sy', (e.clientY - r.top).toFixed(0) + 'px');
      user = performance.now();
    }, on);
    const drift = now => {
      sraf = 0;
      if (dead || !heroOn) return;
      if (now - user > 2500){   // no pointer for a while: the lens wanders slowly on its own
        const t = (now - t0) / 1000;
        hero.style.setProperty('--sx', (50 + Math.cos(t * .35) * 26).toFixed(2) + '%');
        hero.style.setProperty('--sy', (46 + Math.sin(t * .5) * 16).toFixed(2) + '%');
      }
      sraf = requestAnimationFrame(drift);
    };
    observe(([e]) => { heroOn = e.isIntersecting; if (heroOn && !sraf && !dead) sraf = requestAnimationFrame(drift); }).observe(hero);
  }

  return function destroy(){
    dead = true;
    ac.abort();
    observers.forEach(o => o.disconnect());
    if (raf) cancelAnimationFrame(raf);
    if (sraf) cancelAnimationFrame(sraf);
    if (labVid) labVid.pause();
  };
}
