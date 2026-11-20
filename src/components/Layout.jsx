import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Announcement from './Announcement.jsx';
import Header from './Header.jsx';
import Drawer from './Drawer.jsx';
import Footer from './Footer.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef(null);
  const footerRef = useRef(null);

  // new page -> start at the top, close the drawer
  useEffect(() => {
    window.scrollTo(0, 0);
    setDrawerOpen(false);
  }, [pathname]);

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
      <a className="skip-link" href="#main" />
      <Announcement />
      <div className="sticky-threshold" />
      <Header onBurger={() => setDrawerOpen(true)} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main id="main" className="main" ref={mainRef}>
        <Outlet />
      </main>

      <Footer ref={footerRef} />

      {/* floating chat widget placeholder */}
      <a className="float-widget" href="#" onClick={(e) => e.preventDefault()} aria-label="Chat">
        <span className="float-widget__icon" />
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1l3 3 3-3" /></svg>
      </a>
    </>
  );
}
