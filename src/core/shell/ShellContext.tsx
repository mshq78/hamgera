import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ShellState {
  /** Calm progress bar under the header (null = hidden). */
  progress: { current: number; total: number } | null;
  sync: SyncStatus;
  /** Name of the test being taken, shown next to the platform name. */
  testTitle: string | null;
}

interface ShellContextValue extends ShellState {
  set: (patch: Partial<ShellState>) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ShellState>({ progress: null, sync: 'idle', testTitle: null });
  const value = useMemo<ShellContextValue>(() => ({ ...state, set: (patch) => setState((s) => ({ ...s, ...patch })) }), [state]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}

/** Shows a progress bar for as long as the calling screen is mounted. `current` is 1-based. */
export function useShellProgress(current: number, total: number) {
  const { set } = useShell();
  useEffect(() => {
    set({ progress: { current, total } });
    return () => set({ progress: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total]);
}

export function useShellSync(status: SyncStatus) {
  const { set } = useShell();
  useEffect(() => {
    set({ sync: status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}
