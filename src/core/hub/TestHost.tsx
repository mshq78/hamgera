import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Lock } from 'lucide-react';
import { Button } from '../components/Button';
import { Countdown } from '../components/Countdown';
import { ErrorStateView, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../auth/AuthContext';
import { TestRuntimeProvider } from '../runtime/TestRuntime';
import { useShell } from '../shell/ShellContext';
import { useTests } from './TestsContext';
import { api } from '../services/api';
import { CORE } from '../content/ui.fa';
import { formatTehran } from '../utils/jalali';
import { isTestId } from '../../../shared/tests';
import { REGISTRY } from '@/tests/registry';

const g = CORE.gate;

const Notice: React.FC<{ icon: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="w-full py-14 flex flex-col items-center text-center gap-3">
    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300">
      {icon}
    </div>
    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-amber-100">{title}</h1>
    <div className="text-sm text-slate-600 dark:text-slate-300 leading-loose max-w-md">{children}</div>
    <a href="#/" className="mt-2 no-underline"><Button variant="outline" size="md">{CORE.common.backToHub}</Button></a>
  </div>
);

/** Shows the stored result of a test the participant already completed (if the admin lets them see it). */
const CompletedView: React.FC<{ testId: Parameters<typeof api.mySession>[1]; showResult: boolean }> = ({ testId, showResult }) => {
  const { user } = useAuth();
  const def = REGISTRY[testId];
  const [state, setState] = useState<{ loading: boolean; result: any | null }>({ loading: showResult && !!def.ResultView, result: null });

  useEffect(() => {
    if (!showResult || !def.ResultView || !user) return;
    let alive = true;
    api.mySession(user.token, testId).then((res) => {
      if (alive) setState({ loading: false, result: res.ok ? res.data.session?.result ?? null : null });
    });
    return () => { alive = false; };
  }, [testId, showResult, def.ResultView, user]);

  if (state.loading) return <LoadingSkeleton lines={4} />;
  if (state.result && def.ResultView) {
    const ResultView = def.ResultView;
    return (
      <Suspense fallback={<LoadingSkeleton lines={4} />}>
        <ResultView result={state.result} />
      </Suspense>
    );
  }
  return (
    <Notice icon={<CheckCircle2 className="w-8 h-8" aria-hidden="true" />} title={g.doneTitle}>
      <p>{g.doneBody}</p>
      {!showResult && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{g.resultHidden}</p>}
    </Notice>
  );
};

/**
 * Route /t/:testId/* — decides whether the participant may enter: open and not done, or done (shows the result),
 * or not available yet (countdown) / over. Once the test flow is showing it stays mounted even if the schedule
 * changes meanwhile; the server decides at submission.
 */
export const TestHost: React.FC = () => {
  const { testId } = useParams();
  const { tests, loading, failed, refresh, clockOffsetMs } = useTests();
  const { set } = useShell();
  const info = tests.find((t) => t.id === testId);
  /** Decided when the participant arrives and never revisited, so submitting does not swap the flow for the result view. */
  const arrivedCompleted = useRef<boolean | null>(null);
  const flowShown = useRef(false);

  useEffect(() => {
    if (isTestId(testId)) set({ testTitle: REGISTRY[testId].meta.title });
    return () => set({ testTitle: null, progress: null, sync: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  if (!isTestId(testId)) return <Notice icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={g.unknown} />;
  if (loading) return <LoadingSkeleton lines={4} />;
  if (!info) {
    // Not listed = closed for this participant.
    if (failed) return <ErrorStateView title={g.loadFailed} description="" onRetry={refresh} />;
    return <Notice icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={g.closedTitle}><p>{g.closedBody}</p></Notice>;
  }

  if (arrivedCompleted.current === null) arrivedCompleted.current = info.completed && !(info.allowRetake && info.status === 'open');
  if (arrivedCompleted.current) return <CompletedView testId={testId} showResult={info.showResult} />;

  if (!flowShown.current) {
    if (info.status === 'upcoming' && info.opensAt) {
      return (
        <Notice icon={<Clock className="w-8 h-8" aria-hidden="true" />} title={g.upcomingTitle}>
          <p>{g.upcomingBody} {formatTehran(info.opensAt)}</p>
          <p className="mt-2 text-lg font-bold text-slate-800 dark:text-amber-100">
            <Countdown target={info.opensAt} clockOffsetMs={clockOffsetMs} onElapsed={refresh} />
          </p>
        </Notice>
      );
    }
    if (info.status === 'ended') return <Notice icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={g.endedTitle}><p>{g.endedBody}</p></Notice>;
    if (info.status !== 'open') return <Notice icon={<Lock className="w-8 h-8" aria-hidden="true" />} title={g.closedTitle}><p>{g.closedBody}</p></Notice>;
    flowShown.current = true;
  }

  const Root = REGISTRY[testId].Root;
  return (
    <TestRuntimeProvider testId={testId}>
      <Suspense fallback={<LoadingSkeleton lines={5} />}>
        <Root />
      </Suspense>
    </TestRuntimeProvider>
  );
};
