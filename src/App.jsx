import { lazy as reactLazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
// Science page is switched off for now (route redirects to /blogs); the file stays for later.
import Faq from './pages/Faq.jsx';
import Contact from './pages/Contact.jsx';
import Sustainability from './pages/Sustainability.jsx';
import { CartProvider } from './store/context/CartContext';
import { AuthProvider } from './store/context/AuthContext';
import { loadCatalog } from './store/lib/catalog';
import { loadSiteContent } from './store/lib/siteContent';

loadCatalog();   // live products from the database (shows built-in data until it arrives)
loadSiteContent();   // announcement bar + homepage sections from the dashboard
import RequireAuth from './store/components/RequireAuth';
import { TooltipProvider } from './store/components/ui/tooltip';
import StoreLayout, { StoreOverlays } from './store/StoreLayout.jsx';
import { STORE_ID } from './content/site.js';

/*
 * Lazy pages that can be fetched ahead of time. Without this, the first click on a menu link
 * downloads that page's code while the page area sits empty for a moment (the "white flash").
 * preload() starts the download AND settles React.lazy's internal state, so the next render of
 * that page is instant instead of showing the loading fallback for a frame.
 */
const preloads = [];
function lazy(factory) {
  const C = reactLazy(factory);
  preloads.push(() => {
    try { C._init?.(C._payload); } catch (pending) { pending?.then?.(() => {}, () => {}); }
  });
  return C;
}
/** Fetch every page chunk once the browser is idle after the first page has loaded (admin excluded). */
function usePreloadPages() {
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    const run = () => preloads.forEach((p) => p());
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback || clearTimeout;
    let id;
    const start = () => { id = idle(run, { timeout: 4000 }); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
    return () => { window.removeEventListener('load', start); if (id) cancel(id); };
  }, []);
}

/* Store pages (copied from the Tranz-Life-Vishnu-Personal project), each its own chunk */
const Shop = lazy(() => import('./store/pages/Shop'));
const Product = lazy(() => import('./store/pages/Product'));
const Concern = lazy(() => import('./store/pages/Concern'));
const ConcernsIndex = lazy(() => import('./store/pages/Concern').then((m) => ({ default: m.ConcernsIndex })));
const Ingredients = lazy(() => import('./store/pages/Ingredients'));
const content = (name) => lazy(() => import('./store/pages/Content').then((m) => ({ default: m[name] })));
const Journal = content('Journal');
const Article = content('Article');
const ArticlePreview = content('ArticlePreview');
const Policy = content('Policy');
const checkout = (name) => lazy(() => import('./store/pages/Checkout').then((m) => ({ default: m[name] })));
const Cart = checkout('Cart');
const Checkout = checkout('Checkout');
const OrderSuccess = lazy(() => import('./store/pages/OrderDetails'));   // order details + confirmation
const Login = lazy(() => import('./store/pages/Login'));
const Account = lazy(() => import('./store/pages/Account'));
const TrackOrder = lazy(() => import('./store/pages/TrackOrder'));
/* Staff dashboard: its own chunk, outside the site layout (no header, footer or chat) */
const AdminApp = reactLazy(() => import('./admin/AdminApp'));
const NotFound = lazy(() => import('./store/pages/NotFound'));

const page = (el) => <Suspense fallback={<div className="page-loading" aria-busy="true" />}>{el}</Suspense>;

/** Old /product/<id> links point at the store's product pages. */
function OldProductLink() {
  const { id } = useParams();
  return <Navigate to={STORE_ID[id] ? `/products/${STORE_ID[id]}` : '/shop'} replace />;
}

/** Old /journal/<id> links (the journal is now Blogs). */
function OldJournalLink() {
  const { id } = useParams();
  return <Navigate to={`/blogs/${id}`} replace />;
}

export default function App() {
  usePreloadPages();
  return (
    <AuthProvider>
    <CartProvider>
      <TooltipProvider delayDuration={250}>
        <Routes>
          <Route path="admin/*" element={page(<AdminApp />)} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="science" element={<Navigate to="/blogs" replace />} />
            <Route path="sustainability" element={<Sustainability />} />
            <Route path="faq" element={<Faq />} />
            <Route path="blog" element={<Navigate to="/blogs" replace />} />
            <Route path="journal" element={<Navigate to="/blogs" replace />} />
            <Route path="journal/:id" element={<OldJournalLink />} />
            <Route path="contact" element={<Contact />} />
            <Route path="products" element={<Navigate to="/shop" replace />} />
            <Route path="certifications" element={<Navigate to="/about" replace />} />
            <Route path="product/:id" element={<OldProductLink />} />
            <Route element={<StoreLayout />}>
              <Route path="shop" element={page(<Shop />)} />
              <Route path="products/:id" element={page(<Product />)} />
              <Route path="concerns" element={page(<ConcernsIndex />)} />
              <Route path="concerns/:id" element={page(<Concern />)} />
              <Route path="ingredients" element={page(<Ingredients />)} />
              <Route path="blogs" element={page(<Journal />)} />
              <Route path="blogs/:id" element={page(<Article />)} />
              <Route path="blog-preview/:id" element={page(<ArticlePreview />)} />
              <Route path="policies/:id" element={page(<Policy />)} />
              <Route path="cart" element={page(<Cart />)} />
              <Route path="login" element={page(<Login />)} />
              {/* signed-in only: signed-out visitors go to /login and come straight back */}
              <Route path="checkout" element={<RequireAuth>{page(<Checkout />)}</RequireAuth>} />
              <Route path="order/:id" element={<RequireAuth>{page(<OrderSuccess />)}</RequireAuth>} />
              <Route path="account" element={<RequireAuth>{page(<Account />)}</RequireAuth>} />
              <Route path="track" element={page(<TrackOrder />)} />
              <Route path="track/:id" element={page(<TrackOrder />)} />
              {/* unknown URLs: a real 404 page (the server also answers these with status 404) */}
              <Route path="*" element={page(<NotFound />)} />
            </Route>
          </Route>
        </Routes>
        <StoreOverlays />
      </TooltipProvider>
    </CartProvider>
    </AuthProvider>
  );
}
