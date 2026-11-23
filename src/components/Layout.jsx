import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { initChat, openChat } from '../features/chat/chat-widget.js';
import Announcement from './Announcement.jsx';
import Header from './Header.jsx';
import Drawer from './Drawer.jsx';
import Footer from './Footer.jsx';
import BackToTop from './BackToTop.jsx';

export default function Layout() {
  const { pathname, hash, key } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef(null);
  const footerRef = useRef(null);
  const lastPath = useRef(pathname);
  const navigate = useNavigate();

  // Tulsi chat (Gemini first, Ollama fallback on the server). Mounted once; safe under StrictMode.
  useEffect(() => { initChat({ navigate }); }, [navigate]);

  // new page -> start at the top (or at the #section the link points to), close the drawer
  useEffect(() => {
    const samePage = lastPath.current === pathname;
    lastPath.current = pathname;
    setDrawerOpen(false);
    const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // let the new page lay out first, then go to the section (scroll-margin-top clears the sticky header)
      requestAnimationFrame(() => target.scrollIntoView({ behavior: samePage && !reduce ? 'smooth' : 'auto', block: 'start' }));
    } else if (!samePage || !hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash, key]);

  // lock page scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Escape closes the drawer
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // scroll-reveal for every [data-reveal] element on the current page
  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  // footer "reveal" effect: footer sits fixed behind the page when it fits in the viewport
  useLayoutEffect(() => {
    const layout = () => {
      const footer = footerRef.current, main = mainRef.current;
      if (!footer || !main) return;
      const h = footer.offsetHeight;
      const canFix = h <= window.innerHeight;
      footer.classList.toggle('is-fixed', canFix);
      main.style.marginBottom = canFix ? `${h}px` : '';
    };
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
    return () => {
      window.removeEventListener('resize', layout);
      window.removeEventListener('load', layout);
    };
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); mainRef.current?.scrollIntoView(); }}>Skip to content</a>
      <Announcement />
      <div className="sticky-threshold" />
      <Header onBurger={() => setDrawerOpen(true)} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main id="main" className="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      <Footer ref={footerRef} />

      <BackToTop />

      {/* floating "talk to us" button: opens the Tulsi chat */}
      <button type="button" className="float-widget" onClick={openChat} aria-label="Chat with Tulsi, our wellness assistant" aria-controls="chatPanel">
        <span className="float-widget__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M3 4h14v9H8l-4 3v-3H3z" /></svg>
        </span>
        <span className="float-widget__label">Talk to us</span>
      </button>
    </>
  );
}
