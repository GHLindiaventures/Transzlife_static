import { Outlet } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useCart } from './context/CartContext';
import CartDrawer from './components/CartDrawer';
import './styles/tailwind.css';
import './styles/store.css';
import './styles/host.css';
import './styles/phi.css';   // golden-ratio layout + spacing (loaded last)

/*
 * The TranzLife store pages (shop, product pages, cart, checkout, concerns, ingredients, journal),
 * copied from the Tranz-Life-Vishnu-Personal project. Everything renders inside `.tl-store`,
 * where the store's own (scoped) stylesheet applies; this site's header and footer wrap it.
 */
export default function StoreLayout() {
  return (
    <div className="tl-store">
      <Outlet />
    </div>
  );
}

function Toast() {
  const { toast } = useCart();
  return (
    <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">
      {toast && <><Check size={16} /> {toast}</>}
    </div>
  );
}

/** Cart drawer + "added to cart" toast, available on every page (the header bag opens the drawer). */
export function StoreOverlays() {
  return (
    <div className="tl-store tl-store--overlay">
      <CartDrawer />
      <Toast />
    </div>
  );
}
