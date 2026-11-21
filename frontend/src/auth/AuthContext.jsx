import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ApiError, apiRequest, authApi } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const logout = useCallback(() => setSession(null), []);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    setSession({ token: result.token, user: { id: result.id, name: result.name, email: result.email } });
    return result;
  }, []);

  const register = useCallback(async (details) => authApi.register(details), []);

  const api = useMemo(() => ({
    get: (path, options) => apiRequest(path, { ...options, token: session?.token }).catch((error) => {
      if (error instanceof ApiError && error.status === 401) logout();
      throw error;
    }),
    post: (path, body) => apiRequest(path, { method: 'POST', body, token: session?.token }).catch((error) => {
      if (error instanceof ApiError && error.status === 401) logout();
      throw error;
    }),
    patch: (path, body) => apiRequest(path, { method: 'PATCH', body, token: session?.token }).catch((error) => {
      if (error instanceof ApiError && error.status === 401) logout();
      throw error;
    })
  }), [session?.token, logout]);

  const value = useMemo(() => ({ session, user: session?.user, isAuthenticated: Boolean(session), login, register, logout, api }),
    [session, login, register, logout, api]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
