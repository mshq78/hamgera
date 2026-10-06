import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, NavigateOptions, NavigateProps, To, useNavigate } from 'react-router-dom';
import type { TestId } from '../../../shared/tests';
import { useAuth } from '../auth/AuthContext';
import { api, SubmitFailure } from '../services/api';
import { useTests } from '../hub/TestsContext';

/** What a running test gets from the platform: who the participant is, where to keep drafts, how to submit. */

export interface DraftStore {
  read<T>(name: string, fallback: T): T;
  write(name: string, value: unknown): void;
  remove(name: string): void;
}

export interface TestRuntimeValue {
  testId: TestId;
  user: { mobile: string; firstName: string; lastName: string };
  drafts: DraftStore;
  isOffline: boolean;
  newSessionId(): string;
  /** Stores the finished session on the server. `result` is null when the admin does not show results. */
  submit(args: { sessionId: string; startedAt: string; payload: unknown }): Promise<{ ok: true; result: any | null } | { ok: false; reason: SubmitFailure }>;
  /** Leaves the test and returns to the hub. */
  exit(): void;
}

const TestRuntimeContext = createContext<TestRuntimeValue | null>(null);

function draftStore(testId: TestId, mobile: string): DraftStore {
  // Drafts are per person and per test, so people sharing a device never see each other's answers.
  const key = (name: string) => `hamgera:${testId}:${mobile}:${name}`;
  return {
    read(name, fallback) {
      try {
        const raw = localStorage.getItem(key(name));
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    write(name, value) {
      try {
        localStorage.setItem(key(name), JSON.stringify(value));
      } catch (e) {
        console.error('Draft could not be saved', e);
      }
    },
    remove(name) {
      try {
        localStorage.removeItem(key(name));
      } catch {
        /* ignore */
      }
    },
  };
}

/** True when the participant has an unfinished draft of this test on this device (hub shows «ادامه»). */
export function hasDraft(testId: TestId, mobile: string): boolean {
  const prefix = `hamgera:${testId}:${mobile}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith(prefix)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function newSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'sess_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const TestRuntimeProvider: React.FC<{ testId: TestId; children: React.ReactNode }> = ({ testId, children }) => {
  const { user, logout } = useAuth();
  const { refresh } = useTests();
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const token = user?.token ?? '';
  const mobile = user?.mobile ?? '';
  const drafts = useMemo(() => draftStore(testId, mobile), [testId, mobile]);

  const submit = useCallback<TestRuntimeValue['submit']>(
    async ({ sessionId, startedAt, payload }) => {
      const res = await api.submit(token, { testId, sessionId, startedAt, payload });
      if (res.ok) refresh(); // the hub now shows the test as completed
      else if (res.reason === 'unauthorized') logout();
      return res;
    },
    [token, testId, refresh, logout]
  );

  const exit = useCallback(() => navigate('/'), [navigate]);

  const value = useMemo<TestRuntimeValue | null>(
    () => (user ? { testId, user: { mobile: user.mobile, firstName: user.firstName, lastName: user.lastName }, drafts, isOffline, newSessionId, submit, exit } : null),
    [user, testId, drafts, isOffline, submit, exit]
  );
  if (!value) return null;
  return <TestRuntimeContext.Provider value={value}>{children}</TestRuntimeContext.Provider>;
};

export function useTestRuntime(): TestRuntimeValue {
  const ctx = useContext(TestRuntimeContext);
  if (!ctx) throw new Error('useTestRuntime must be used within TestRuntimeProvider');
  return ctx;
}

// ---- navigation inside a test --------------------------------------------------------------

const withBase = (testId: TestId, to: To): To => {
  if (typeof to === 'string') return to.startsWith('/') ? `/t/${testId}${to === '/' ? '' : to}` : to;
  return to.pathname?.startsWith('/') ? { ...to, pathname: `/t/${testId}${to.pathname === '/' ? '' : to.pathname}` } : to;
};

/** Like useNavigate, but absolute paths ("/q/3") are relative to the running test ("#/t/<id>/q/3"). */
export function useTestNavigate() {
  const navigate = useNavigate();
  const { testId } = useTestRuntime();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => (typeof to === 'number' ? navigate(to) : navigate(withBase(testId, to), options)),
    [navigate, testId]
  );
}

/** Like <Navigate>, with the same test-relative paths as useTestNavigate. */
export const TestNavigate: React.FC<NavigateProps> = ({ to, ...rest }) => {
  const { testId } = useTestRuntime();
  return <Navigate to={withBase(testId, to)} {...rest} />;
};
