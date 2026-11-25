import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Pages that need a signed-in customer (checkout, account, orders).
 * Signed out -> /login?next=<this page>; after sign-in the customer lands back here, where they were.
 * Signed in but no name yet (brand-new account) -> the login page's "your name" step first.
 */
export default function RequireAuth({ children }) {
  const { customer, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="page-loading" aria-busy="true" />;
  if (!customer || !customer.name) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
