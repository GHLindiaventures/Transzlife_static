import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html from './science/science-page.html?raw';
import { initSciencePage } from './science/science-script.js';
import './science/science-live.css';

const TITLE = 'Science & Innovation | TranzLife Biosciences — Where Plant Intelligence Meets Precision Molecular Science';

/**
 * The Science page — cinematic, larger-than-life design.
 * Full self-contained HTML/CSS/JS rendered inside the existing
 * site header + footer, mirroring the About.jsx pattern.
 */
export default function Science() {
  const ref = useRef(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const root = ref.current;
    const previousTitle = document.title;
    document.title = TITLE;

    // Links to other pages go through the router instead of reloading
    const onClick = (e) => {
      const a = e.target.closest('a[href^="/"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(a.getAttribute('href'));
    };
    root.addEventListener('click', onClick);

    // Initialise all science page interactive features
    const destroy = initSciencePage(root);

    return () => {
      destroy();
      root.removeEventListener('click', onClick);
      document.title = previousTitle;
    };
  }, [navigate]);

  return (
    <div
      className="science-page"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
