import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import DnaLoader from './components/DnaLoader.jsx';
import { loadSiteDocs } from './content/docs.js';
import { loadCatalog } from './store/lib/catalog';
import './styles/styles.css';
import './styles/pages.css';
import './styles/slider.css';
import './styles/theme.css';
import './styles/glass.css';
import './styles/content.css';
import './styles/golden.css';
import './styles/showcase.css';
import './styles/product.css';
import './styles/polish.css';
import './styles/refine.css';
import './styles/phi-enhance.css';
import './styles/chat.css';
import './styles/ingredients-carousel.css';
import './styles/menu-and-mobile.css';

/** Shows the site only after its text has loaded from the database (the dashboard at /admin does not need it). */
function Boot() {
  const needs = !window.location.pathname.startsWith('/admin');
  const [state, setState] = useState(needs ? 'loading' : 'ready');
  const load = () => { setState('loading'); Promise.all([loadSiteDocs(), loadCatalog()]).then(() => setState('ready'), (e) => { console.error(e); setState('failed'); }); };
  useEffect(() => { if (needs) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === 'ready') return <BrowserRouter><App /></BrowserRouter>;
  if (state === 'loading') return <DnaLoader variant="overlay" />;
  return (
    <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: '#fcfaf1', color: '#0f2f1d', fontFamily: 'system-ui, sans-serif' }}>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>We could not load the website just now.</p>
        <p>Please check your connection and try again.</p>
        <button type="button" onClick={load} style={{ marginTop: 12, padding: '12px 24px', borderRadius: 999, border: 0, background: '#173f24', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>
);
