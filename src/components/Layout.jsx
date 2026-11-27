import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { initChat, openChat } from '../features/chat/chat-widget.js';
import Announcement from './Announcement.jsx';
import Header from './Header.jsx';
import Drawer from './Drawer.jsx';
import Footer from './Footer.jsx';
import ConsentBanner from './ConsentBanner.jsx';
import LiveVisitors from './LiveVisitors.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { installTracking, track } from '../store/lib/track.js';
import { useSiteContent } from '../store/lib/siteContent.js';

const loadedTags = new Set();
function setVerifyMeta(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.name = name; document.head.appendChild(tag); }
  tag.content = content;
}

function loadMarketingTags(m) {
  if (!m) return;
  setVerifyMeta('google-site-verification', m.gscVerification);
  setVerifyMeta('facebook-domain-verification', m.metaDomainVerification);
  const run = () => {
    if (m.gtmId && /^GTM-[A-Z0-9]+$/i.test(m.gtmId) && !loadedTags.has(`gtm:${m.gtmId}`)) {
      loadedTags.add(`gtm:${m.gtmId}`);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(m.gtmId)}`;
      document.head.appendChild(s);
    }
    if (m.ga4Id && /^G-[A-Z0-9]+$/i.test(m.ga4Id) && !loadedTags.has(`ga4:${m.ga4Id}`)) {
      loadedTags.add(`ga4:${m.ga4Id}`);
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', m.ga4Id);
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(m.ga4Id)}`;
      document.head.appendChild(s);
    }
    if (m.metaPixelId && /^\d{6,25}$/.test(m.metaPixelId) && !loadedTags.has(`px:${m.metaPixelId}`)) {
      loadedTags.add(`px:${m.metaPixelId}`);
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      s.onload = () => {
        if (window.fbq) { window.fbq('init', m.metaPixelId); window.fbq('track', 'PageView'); }
      };
      document.head.appendChild(s);
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 300);
}

export default function Layout() {
  const { pathname, hash, key } = useLocation();
  const siteContent = useSiteContent();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef(null);
  const footerRef = useRef(null);
  const lastPath = useRef(pathname);
  const navigate = useNavigate();

  // Tulsi chat (Gemini first, Ollama fallback on the server). Mounted once; safe under StrictMode.
  useEffect(() => { initChat({ navigate }); }, [navigate]);

  // first-party analytics: one page view per page (see src/store/lib/track.js for consent rules)
  useEffect(() => { installTracking(); }, []);
  useEffect(() => { track('page_view'); }, [pathname]);
  useEffect(() => { loadMarketingTags(siteContent?.marketing); }, [siteContent?.marketing]);

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
      // not on phones: the URL bar resizing innerHeight would flip fixed/normal mid-scroll
      const canFix = h <= window.innerHeight && window.innerWidth > 640;
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
        {/* a crash in one page shows a friendly message, not a blank screen; a new page starts fresh */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <Footer ref={footerRef} />
      <ConsentBanner />
      <LiveVisitors />
    </>
  );
}
