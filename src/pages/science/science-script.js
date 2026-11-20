/* ==========================================================
   SCIENCE PAGE — Particle + Simulator JS
   Runs on mount, destroyed on unmount (returns a cleanup fn)
   ========================================================== */

/**
 * initSciencePage(root)
 * Initialises all science page JavaScript: particle canvas, DNA animations,
 * absorption simulator tab switcher, scroll reveals.
 * Returns a destroy() function.
 */
export function initSciencePage(root) {
  const cleanups = [];

  // ── Scroll-reveal for .sc-reveal elements ─────────────────────
  const revealEls = root.querySelectorAll('.sc-reveal, [data-reveal]');
  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          revealObs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
  );
  revealEls.forEach((el) => revealObs.observe(el));
  cleanups.push(() => revealObs.disconnect());

  // ── Hero particle canvas ───────────────────────────────────────
  const heroCanvas = root.querySelector('#scParticleCanvas');
  if (heroCanvas) cleanups.push(initParticles(heroCanvas, 'hero'));

  // ── CTA particle canvas ────────────────────────────────────────
  const ctaCanvas = root.querySelector('#scCtaCanvas');
  if (ctaCanvas) cleanups.push(initParticles(ctaCanvas, 'cta'));

  // ── Absorption simulator ───────────────────────────────────────
  cleanups.push(initSimulator(root));

  return () => cleanups.forEach((fn) => fn && fn());
}

/* ─── PARTICLE CANVAS ──────────────────────────────────────────── */
function initParticles(canvas, type) {
  const ctx = canvas.getContext('2d');
  let raf, w, h;
  const COUNT = type === 'hero' ? 80 : 40;
  const particles = [];

  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
  };

  const color = type === 'hero'
    ? () => `rgba(224,168,38,${(Math.random() * 0.4 + 0.05).toFixed(2)})`
    : () => `rgba(224,168,38,${(Math.random() * 0.3 + 0.05).toFixed(2)})`;

  const reset = (p) => {
    p.x = Math.random() * w;
    p.y = Math.random() * h;
    p.r = Math.random() * 2 + 0.5;
    p.vx = (Math.random() - 0.5) * 0.4;
    p.vy = -Math.random() * 0.5 - 0.1;
    p.alpha = Math.random() * 0.5 + 0.1;
    p.life = 0;
    p.maxLife = Math.random() * 300 + 150;
    p.c = color();
    return p;
  };

  for (let i = 0; i < COUNT; i++) reset({});
  for (let i = 0; i < COUNT; i++) particles.push(reset({}));
  // stagger starting positions
  particles.forEach((p) => { p.life = Math.random() * p.maxLife; });

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      const t = p.life / p.maxLife;
      const alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c.replace(/[\d.]+\)$/, `${(p.alpha * alpha).toFixed(2)})`);
      ctx.fill();

      if (p.life >= p.maxLife || p.y < -10 || p.x < -10 || p.x > w + 10) reset(p);
    });

    // Draw faint connecting lines between nearby particles
    if (type === 'hero') {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(224,168,38,${((1 - dist / 100) * 0.08).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    raf = requestAnimationFrame(draw);
  };

  resize();
  draw();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

/* ─── ABSORPTION SIMULATOR ─────────────────────────────────────── */
function initSimulator(root) {
  const DATA = {
    crude: {
      perm: 18, ret: 12, onset: 15,
      permLabel: '18% Intestinal Transport',
      retLabel: '12% Retained Active',
      onsetLabel: '15% Cellular Rate',
      title: 'Crude Herb Powder',
      desc: 'Raw plant material retains fibre and cellulose that blocks active compound diffusion. Gastric acid degrades polyphenols before absorption, leaving very little bioavailable compound in circulation.',
      bio: '8% – 22%', tmax: '90–180 mins', half: '1.2 hrs', gastric: '< 25%',
    },
    solvent: {
      perm: 42, ret: 35, onset: 38,
      permLabel: '42% Intestinal Transport',
      retLabel: '35% Retained Active',
      onsetLabel: '38% Cellular Rate',
      title: 'Standard Solvent Extract',
      desc: 'Ethanol or petroleum-based extraction concentrates some actives, but residues and large molecular weights still limit cellular uptake. Hepatic first-pass significantly reduces circulating concentration.',
      bio: '30% – 48%', tmax: '45–90 mins', half: '3.5 hrs', gastric: '< 55%',
    },
    phytosome: {
      perm: 92, ret: 94, onset: 95,
      permLabel: '92% Intestinal Transport',
      retLabel: '94% Retained Active',
      onsetLabel: '95% Cellular Rate',
      title: 'TranzLife Bio-Phytosome Delivery Platform',
      desc: 'Botanical actives are molecularly complexed within non-GMO sunflower phosphatidylcholine bi-layers. Resists gastric acid, transits mucosal barriers intact, and achieves rapid 20-minute cellular delivery.',
      bio: '88% – 94%', tmax: '20 mins', half: '8.5 hrs', gastric: '> 96%',
    },
  };

  const tabs = root.querySelectorAll('.sc-sim__tab');
  const barPerm = root.querySelector('#scBarPerm');
  const barRet = root.querySelector('#scBarRet');
  const barOnset = root.querySelector('#scBarOnset');
  const valPerm = root.querySelector('#scValPerm');
  const valRet = root.querySelector('#scValRet');
  const valOnset = root.querySelector('#scValOnset');
  const simTitle = root.querySelector('#scSimTitle');
  const simDesc = root.querySelector('#scSimDesc');
  const specBio = root.querySelector('#scSpecBio');
  const specTmax = root.querySelector('#scSpecTmax');
  const specHalf = root.querySelector('#scSpecHalf');
  const specGastric = root.querySelector('#scSpecGastric');

  if (!tabs.length) return;

  const apply = (mode) => {
    const d = DATA[mode];
    if (!d) return;

    // Update bars with a slight delay for animation
    requestAnimationFrame(() => {
      if (barPerm) barPerm.style.width = d.perm + '%';
      if (barRet) barRet.style.width = d.ret + '%';
      if (barOnset) barOnset.style.width = d.onset + '%';
      if (valPerm) valPerm.textContent = d.permLabel;
      if (valRet) valRet.textContent = d.retLabel;
      if (valOnset) valOnset.textContent = d.onsetLabel;
      if (simTitle) simTitle.textContent = d.title;
      if (simDesc) simDesc.textContent = d.desc;
      if (specBio) specBio.textContent = d.bio;
      if (specTmax) specTmax.textContent = d.tmax;
      if (specHalf) specHalf.textContent = d.half;
      if (specGastric) specGastric.textContent = d.gastric;
    });

    tabs.forEach((t) => {
      const isActive = t.dataset.mode === mode;
      t.classList.toggle('sc-sim__tab--active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  };

  const handleClick = (e) => {
    const tab = e.target.closest('.sc-sim__tab');
    if (tab && tab.dataset.mode) apply(tab.dataset.mode);
  };

  root.addEventListener('click', handleClick);
  return () => root.removeEventListener('click', handleClick);
}
