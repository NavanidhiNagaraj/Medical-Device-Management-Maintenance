import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('medwave_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('medwave_token')));

  const logout = useCallback(() => {
    localStorage.removeItem('medwave_token');
    localStorage.removeItem('medwave_user');
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('medwave_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getProfile()
      .then((profile) => {
        setUser(profile);
        localStorage.setItem('medwave_user', JSON.stringify(profile));
      })
      .catch(() => {
        logout();
      })
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('medwave:unauthorized', onUnauthorized);
    return () => window.removeEventListener('medwave:unauthorized', onUnauthorized);
  }, [logout]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    localStorage.setItem('medwave_token', res.access_token);
    localStorage.setItem('medwave_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const register = async (payload) => {
    const res = await api.register(payload);
    localStorage.setItem('medwave_token', res.access_token);
    localStorage.setItem('medwave_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const refreshProfile = async () => {
    const profile = await api.getProfile();
    setUser(profile);
    localStorage.setItem('medwave_user', JSON.stringify(profile));
    return profile;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
