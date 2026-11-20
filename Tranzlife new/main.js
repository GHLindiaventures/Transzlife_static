(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- announcement close ---------- */
  var ann = $('#announcement'), annClose = $('.announcement__close');
  if (annClose) annClose.addEventListener('click', function () { ann.style.display = 'none'; });

  /* ---------- sticky header state ---------- */
  var header = $('#header');
  function onScrollHeader() { header.classList.toggle('is-stuck', window.scrollY > 200); }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- mobile drawer ---------- */
  var drawer = $('#drawer'), overlay = $('#drawerOverlay');
  function toggleDrawer(open) {
    drawer.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  $('#burger').addEventListener('click', function () { toggleDrawer(true); });
  $('#drawerClose').addEventListener('click', function () { toggleDrawer(false); });
  overlay.addEventListener('click', function () { toggleDrawer(false); });
  $$('[data-acc]').forEach(function (b) {
    b.addEventListener('click', function () { b.parentNode.classList.toggle('is-open'); });
  });

  /* ---------- scroll reveal ---------- */
  var items = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- footer reveal effect ---------- */
  var footer = $('#footer'), main = $('#main');
  function layoutFooter() {
    var h = footer.offsetHeight;
    var canFix = h <= window.innerHeight;
    footer.classList.toggle('is-fixed', canFix);
    main.style.marginBottom = canFix ? h + 'px' : '';
  }
  window.addEventListener('resize', layoutFooter);
  window.addEventListener('load', layoutFooter);
  layoutFooter();
})();

/* ---------- navigation fixes ---------- */
(function () {
  'use strict';
  var drawer = document.getElementById('drawer'), overlay = document.getElementById('drawerOverlay');
  function closeDrawer() {
    drawer.classList.remove('is-open'); overlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  }
  // Placeholder links (href="#") must not jump to top or add "#" to the URL.
  // Replace with real URLs and they behave normally.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.getAttribute('href') === '#') e.preventDefault();
    if (a.closest('#drawer')) closeDrawer();
  });
  // Escape closes drawer and any tap-opened mega menu
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeDrawer();
    document.querySelectorAll('.nav__item.is-open').forEach(function (n) { n.classList.remove('is-open'); });
  });
  // Touch devices with the desktop nav: first tap opens the mega menu
  var touch = window.matchMedia('(hover:none)');
  document.querySelectorAll('.nav__item.has-mega > .nav__link').forEach(function (l) {
    l.addEventListener('click', function (e) {
      if (!touch.matches) return;
      var item = l.parentNode;
      if (!item.classList.contains('is-open')) {
        e.preventDefault();
        document.querySelectorAll('.nav__item.is-open').forEach(function (n) { n.classList.remove('is-open'); });
        item.classList.add('is-open');
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav__item')) document.querySelectorAll('.nav__item.is-open').forEach(function (n) { n.classList.remove('is-open'); });
  });
})();

/* ---------- FAQ accordion ---------- */
(function () {
  'use strict';
  document.querySelectorAll('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentNode, open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });
})();
