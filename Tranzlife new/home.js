(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- hero slideshow ---------- */
  var hero = $('#hero'), slides = $$('.hero__slide'), dots = $$('.hero__dot'), track = $('.hero__slides', hero), hIdx = 0, hTimer;
  function goHero(i) {
    hIdx = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-100 * hIdx) + '%)';
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === hIdx); });
    dots.forEach(function (d, n) {
      d.classList.remove('is-active');
      if (n === hIdx) { void d.offsetWidth; d.classList.add('is-active'); }
    });
    clearTimeout(hTimer);
    hTimer = setTimeout(function () { goHero(hIdx + 1); }, 6000);
  }
  dots.forEach(function (d, n) { d.addEventListener('click', function () { goHero(n); }); });
  var sx = 0;
  hero.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) goHero(hIdx + (dx < 0 ? 1 : -1));
  });
  goHero(0);

  /* ---------- generic dot sliders (product slider, reels) ---------- */
  var ps = $('#pslider'), psSlides = $$('.pslider__slide', ps), psDots = $$('.dot', ps), psIdx = 0, psTimer;
  function goPs(i) {
    psIdx = (i + psSlides.length) % psSlides.length;
    psSlides.forEach(function (s, n) { s.classList.toggle('is-active', n === psIdx); });
    psDots.forEach(function (d, n) { d.classList.toggle('is-active', n === psIdx); });
    clearTimeout(psTimer);
    psTimer = setTimeout(function () { goPs(psIdx + 1); }, 5000);
  }
  psDots.forEach(function (d, n) { d.addEventListener('click', function () { goPs(n); }); });
  goPs(0);

  var reelStage = $('#reels'), reels = $$('.reel', reelStage), rDots = $$('.reels__dots .dot'), rIdx = 0;
  var classes = ['is-prev2', 'is-prev', 'is-active', 'is-next', 'is-next2'];
  function goReel(i) {
    rIdx = (i + rDots.length) % rDots.length;
    rDots.forEach(function (d, n) { d.classList.toggle('is-active', n === rIdx); });
    // rotate the five visible reels so the active one is always in the middle
    var shift = i - 0;
    classes.forEach(function (c, n) { reels[n].className = 'reel ' + classes[n]; });
  }
  rDots.forEach(function (d, n) { d.addEventListener('click', function () { goReel(n); }); });
  reels.forEach(function (r, n) {
    r.addEventListener('click', function () {
      if (n < 2) goReel(rIdx - 1); else if (n > 2) goReel(rIdx + 1);
    });
  });

  /* ---------- testimonials ---------- */
  var tTrack = $('#testiTrack'), tSlides = $$('.testi__slide', tTrack), tDots = $$('.testi__dots .dot'), tIdx = 0;
  function goTesti(i) {
    tIdx = (i + tSlides.length) % tSlides.length;
    var s = tSlides[tIdx];
    var shift = s.offsetLeft - parseFloat(getComputedStyle(tTrack).paddingLeft);
    tTrack.style.transform = 'translateX(' + (-shift) + 'px)';
    tSlides.forEach(function (x, n) { x.classList.toggle('is-active', n === tIdx); });
    tDots.forEach(function (d, n) { d.classList.toggle('is-active', n === tIdx); });
  }
  $('#testiPrev').addEventListener('click', function () { goTesti(tIdx - 1); });
  $('#testiNext').addEventListener('click', function () { goTesti(tIdx + 1); });
  tDots.forEach(function (d, n) { d.addEventListener('click', function () { goTesti(n); }); });
  window.addEventListener('resize', function () { goTesti(tIdx); });

  /* ---------- pinned parallax scenes ---------- */
  var par = $('#parallax'), parBg = $('#parallaxBg'), scenes = $$('.parallax__scene', par), sticky = $('.parallax__sticky', par);
  function onScrollPar() {
    var r = par.getBoundingClientRect(), total = par.offsetHeight - sticky.offsetHeight;
    var p = Math.min(1, Math.max(0, -r.top / total));
    var idx = Math.min(scenes.length - 1, Math.floor(p * scenes.length));
    scenes.forEach(function (s, n) { s.classList.toggle('is-active', n === idx); });
    parBg.style.transform = 'scale(' + (1.15 - p * 0.15) + ') translateY(' + (p * -4) + '%)';
  }
  window.addEventListener('scroll', onScrollPar, { passive: true });
  window.addEventListener('resize', onScrollPar);
  onScrollPar();

})();
