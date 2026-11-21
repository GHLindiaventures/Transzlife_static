import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
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
import './styles/ayurveda.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
