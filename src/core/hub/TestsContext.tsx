import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, ParticipantTest } from '../services/api';

interface TestsContextValue {
  tests: ParticipantTest[];
  loading: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
  /** Milliseconds to add to the device clock to get server time (corrects a wrong device clock). */
  clockOffsetMs: number;
}

const TestsContext = createContext<TestsContextValue | null>(null);
const POLL_MS = 60_000;

/** The tests visible to the logged-in participant, kept fresh so a scheduled opening shows up on its own. */
export const TestsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const token = user?.token;
  const [tests, setTests] = useState<ParticipantTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [clockOffsetMs, setOffset] = useState(0);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const mine = ++seq.current;
    const res = await api.listTests(token);
    if (mine !== seq.current) return; // a newer request superseded this one
    if (res.ok) {
      setTests(res.data.tests);
      setOffset(Date.parse(res.data.serverNow) - Date.now());
      setFailed(false);
    } else if (res.status === 401) {
      logout();
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, [token, logout]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!token) return;
    const id = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [token, refresh]);

  const value = useMemo(() => ({ tests, loading, failed, refresh, clockOffsetMs }), [tests, loading, failed, refresh, clockOffsetMs]);
  return <TestsContext.Provider value={value}>{children}</TestsContext.Provider>;
};

export function useTests(): TestsContextValue {
  const ctx = useContext(TestsContext);
  if (!ctx) throw new Error('useTests must be used within TestsProvider');
  return ctx;
}
