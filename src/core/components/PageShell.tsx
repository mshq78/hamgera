import React from 'react';
import { Cloud, CloudCheck, LogOut } from 'lucide-react';
import { BrandLockup } from './BrandLockup';
import { ThemeToggle } from './ThemeToggle';
import { ProgressRule } from './ProgressRule';
import { OfflineBanner } from './StateViews';
import { CORE } from '../content/ui.fa';
import { useAuth } from '../auth/AuthContext';
import { useShell } from '../shell/ShellContext';

interface PageShellProps {
  children: React.ReactNode;
  compactHeader?: boolean;
  /** Wider column for admin tables. */
  wide?: boolean;
  /** Anonymous pages (event surveys): no account controls and no link to the admin panel. */
  minimal?: boolean;
}

function useOnline() {
  const [online, setOnline] = React.useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export const PageShell: React.FC<PageShellProps> = ({ children, compactHeader = false, wide = false, minimal = false }) => {
  const { user, logout } = useAuth();
  const { progress, sync, testTitle } = useShell();
  const online = useOnline();
  const width = wide ? 'max-w-[1080px]' : 'max-w-[720px]';

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-amber-400/40 text-slate-800 dark:text-slate-100">
      {!online && <OfflineBanner />}

      <header className="no-print w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40 px-4 py-2.5 transition-colors">
        <div className={`${width} mx-auto flex items-center justify-between gap-3`}>
          <BrandLockup testTitle={testTitle} compact={compactHeader || !!testTitle} />

          <div className="flex items-center gap-2.5">
            <div
              aria-live="polite"
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all select-none ${
                sync === 'saving'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : sync === 'saved'
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : 'opacity-0'
              }`}
            >
              {sync === 'saving' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
                  <span>{CORE.common.syncing}</span>
                </>
              ) : (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{CORE.common.synced}</span>
                </>
              )}
            </div>

            {user && !minimal && (
              <button
                type="button"
                onClick={logout}
                title={CORE.common.logout}
                aria-label={CORE.common.logout}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-amber-300 hover:border-amber-400 transition cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>

        {progress && <ProgressRule currentStepIndex={progress.current - 1} totalSteps={progress.total} />}
      </header>

      <main className={`flex-1 w-full ${width} mx-auto px-4 py-4 sm:py-6`}>{children}</main>

      <footer className="w-full py-4 px-4 text-center text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 no-print">
        <div className={`${width} mx-auto flex items-center justify-between`}>
          <span>{CORE.brand.name} · {CORE.brand.campus}</span>
          {!minimal && (
            <a href="#/admin" className="hover:text-amber-500 dark:hover:text-amber-300 transition-colors">
              {CORE.common.adminLogin}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
};
