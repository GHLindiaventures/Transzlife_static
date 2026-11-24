import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

/** Who is signed in. `customer` is null when signed out; `ready` is false until the first check. */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { customer: c } = await api('/api/auth/me');
      setCustomer(c);
      return c;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* signed out locally anyway */ }
    setCustomer(null);
  }, []);

  const value = useMemo(() => ({ customer, ready, setCustomer, refresh, logout }), [customer, ready, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Only allow redirects to pages on this site (no "//evil.com" or "https://…"). */
export const safeNext = (next, fallback = '/') =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
