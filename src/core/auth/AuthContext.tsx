import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../services/api';

export interface AuthUser {
  mobile: string;
  firstName: string;
  lastName: string;
  token: string;
}

export type LoginOutcome = 'ok' | 'invalid' | 'locked' | 'offline' | 'unavailable';

interface AuthContextValue {
  user: AuthUser | null;
  login: (mobile: string, nationalId: string) => Promise<LoginOutcome>;
  logout: () => void;
}

const KEY = 'hamgera:auth';
const AuthContext = createContext<AuthContextValue | null>(null);

function load(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    const u = raw ? (JSON.parse(raw) as AuthUser) : null;
    return u && u.mobile && u.token ? u : null;
  } catch {
    return null;
  }
}

/** Who is logged in on this device. The national ID is never stored — only the server-issued token. */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(load);

  const login = useCallback(async (mobile: string, nationalId: string): Promise<LoginOutcome> => {
    const res = await api.login(mobile, nationalId);
    if (!res.ok) {
      if (res.offline) return 'offline';
      if (res.status === 429) return 'locked';
      if (res.status === 400 || res.status === 401) return 'invalid';
      return 'unavailable';
    }
    const next: AuthUser = { ...res.data };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: the session simply lasts until the tab closes */
    }
    setUser(next);
    return 'ok';
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
