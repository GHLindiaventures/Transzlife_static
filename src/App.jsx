import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Science from './pages/Science.jsx';
import Faq from './pages/Faq.jsx';
import Contact from './pages/Contact.jsx';
import Sustainability from './pages/Sustainability.jsx';
import { CartProvider } from './store/context/CartContext';
import { AuthProvider } from './store/context/AuthContext';
import RequireAuth from './store/components/RequireAuth';
import { TooltipProvider } from './store/components/ui/tooltip';
import StoreLayout, { StoreOverlays } from './store/StoreLayout.jsx';
import { STORE_ID } from './content/site.js';

/* Store pages (copied from the Tranz-Life-Vishnu-Personal project), each its own chunk */
const Shop = lazy(() => import('./store/pages/Shop'));
const Product = lazy(() => import('./store/pages/Product'));
const Concern = lazy(() => import('./store/pages/Concern'));
const ConcernsIndex = lazy(() => import('./store/pages/Concern').then((m) => ({ default: m.ConcernsIndex })));
const Ingredients = lazy(() => import('./store/pages/Ingredients'));
const content = (name) => lazy(() => import('./store/pages/Content').then((m) => ({ default: m[name] })));
const Journal = content('Journal');
const Article = content('Article');
const Policy = content('Policy');
const checkout = (name) => lazy(() => import('./store/pages/Checkout').then((m) => ({ default: m[name] })));
const Cart = checkout('Cart');
const Checkout = checkout('Checkout');
const OrderSuccess = checkout('OrderSuccess');
const Login = lazy(() => import('./store/pages/Login'));
const Account = lazy(() => import('./store/pages/Account'));
/* Staff dashboard: its own chunk, outside the site layout (no header, footer or chat) */
const AdminApp = lazy(() => import('./admin/AdminApp'));

const page = (el) => <Suspense fallback={<div className="page-loading" aria-busy="true" />}>{el}</Suspense>;

/** Old /product/<id> links point at the store's product pages. */
function OldProductLink() {
  const { id } = useParams();
  return <Navigate to={STORE_ID[id] ? `/products/${STORE_ID[id]}` : '/shop'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
    <CartProvider>
      <TooltipProvider delayDuration={250}>
        <Routes>
          <Route path="admin/*" element={page(<AdminApp />)} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="science" element={<Science />} />
            <Route path="sustainability" element={<Sustainability />} />
            <Route path="faq" element={<Faq />} />
            <Route path="blog" element={<Navigate to="/journal" replace />} />
            <Route path="contact" element={<Contact />} />
            <Route path="products" element={<Navigate to="/shop" replace />} />
            <Route path="certifications" element={<Navigate to="/science#sc-certs" replace />} />
            <Route path="product/:id" element={<OldProductLink />} />
            <Route element={<StoreLayout />}>
              <Route path="shop" element={page(<Shop />)} />
              <Route path="products/:id" element={page(<Product />)} />
              <Route path="concerns" element={page(<ConcernsIndex />)} />
              <Route path="concerns/:id" element={page(<Concern />)} />
              <Route path="ingredients" element={page(<Ingredients />)} />
              <Route path="journal" element={page(<Journal />)} />
              <Route path="journal/:id" element={page(<Article />)} />
              <Route path="policies/:id" element={page(<Policy />)} />
              <Route path="cart" element={page(<Cart />)} />
              <Route path="login" element={page(<Login />)} />
              {/* signed-in only: signed-out visitors go to /login and come straight back */}
              <Route path="checkout" element={<RequireAuth>{page(<Checkout />)}</RequireAuth>} />
              <Route path="order/:id" element={<RequireAuth>{page(<OrderSuccess />)}</RequireAuth>} />
              <Route path="account" element={<RequireAuth>{page(<Account />)}</RequireAuth>} />
            </Route>
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
        <StoreOverlays />
      </TooltipProvider>
    </CartProvider>
    </AuthProvider>
  );
}
