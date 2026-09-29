import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem('session');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((token, profile, role) => {
    const next = { token, profile, role };
    localStorage.setItem('authToken', token);
    localStorage.setItem('session', JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('session');
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
