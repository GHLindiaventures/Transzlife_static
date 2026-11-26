import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../lib/pageMeta.js';
import html from './about/about-page.html?raw';
import { initHealInterlude } from './about/heal-interlude.js';
import { initAboutStory } from './about/about-story.js';
import { initHeroLive } from './about/hero-live.js';
import './about/about-base.css';
import './about/about-live.css';
import './about/about-fit.css';

const TITLE = 'About Us | TranzLife Biosciences - Nature Meets Scientific Innovation';

/**
 * The About page from the Tranz-life site (Tranz-life/about.html), with its own design and animations,
 * inside this site's header and footer. The markup is static, so React renders it once and the
 * page scripts animate it; they are started on mount and fully removed on unmount.
 */
export default function About() {
  usePageMeta(TITLE, 'The TranzLife Biosciences story: a Chennai company bringing Ayurvedic botanicals and modern science together in everyday wellness products.', { exact: true });
  const ref = useRef(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const root = ref.current;
    const previousTitle = document.title;
    document.title = TITLE;

    // this site's header sticks to the top and takes space (the Tranz-life one floats over the page)
    const headerH = () => document.querySelector('.header')?.offsetHeight ?? 0;
    const setOffsets = () => {
      const ann = document.querySelector('.announcement')?.offsetHeight ?? 0;
      root.style.setProperty('--about-top', `${headerH()}px`);
      root.style.setProperty('--about-cut', `${headerH() + ann}px`);
    };
    setOffsets();
    window.addEventListener('resize', setOffsets);

    // links to other pages go through the router instead of reloading the site
    const onClick = (e) => {
      const a = e.target.closest('a[href^="/"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(a.getAttribute('href'));
    };
    root.addEventListener('click', onClick);

    // the interlude first: it sets its own height, which the story below measures from
    const destroyers = [
      initHealInterlude(root, { top: headerH }),
      initAboutStory(root, { top: headerH }),
      initHeroLive(root),
    ];

    return () => {
      destroyers.forEach((destroy) => destroy());
      window.removeEventListener('resize', setOffsets);
      root.removeEventListener('click', onClick);
      document.title = previousTitle;
    };
  }, [navigate]);

  return <div className="about-page" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
