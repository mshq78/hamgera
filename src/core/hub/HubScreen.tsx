import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Lock } from 'lucide-react';
import { Button } from '../components/Button';
import { Countdown } from '../components/Countdown';
import { ErrorStateView, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../auth/AuthContext';
import { useTests } from './TestsContext';
import { hasDraft } from '../runtime/TestRuntime';
import { CORE } from '../content/ui.fa';
import { formatTehran } from '../utils/jalali';
import { REGISTRY } from '@/tests/registry';
import type { ParticipantTest } from '../services/api';

const t = CORE.hub;

const Badge: React.FC<{ tone: 'open' | 'soon' | 'muted' | 'done'; children: React.ReactNode }> = ({ tone, children }) => {
  const tones = {
    open: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/70 dark:border-amber-800',
    soon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    muted: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    done: 'bg-slate-900 text-amber-100 dark:bg-slate-700 border-slate-800 dark:border-slate-600',
  };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tones[tone]}`}>{children}</span>;
};

const TestCard: React.FC<{ info: ParticipantTest; mobile: string }> = ({ info, mobile }) => {
  const def = REGISTRY[info.id];
  const { clockOffsetMs, refresh } = useTests();
  const Icon = def.icon;
  const isOpen = info.status === 'open';
  const canTake = isOpen && (!info.completed || info.allowRetake);
  const canSeeResult = info.completed && info.showResult && !!def.ResultView;
  const draft = !info.completed && hasDraft(info.id, mobile);

  return (
    <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-slate-900 text-amber-300 dark:bg-slate-800 flex items-center justify-center">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-amber-100 leading-tight">{def.meta.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{def.meta.tagline}</p>
        </div>
        {info.completed ? (
          <Badge tone="done"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />{t.statusDone}</Badge>
        ) : info.status === 'open' ? (
          <Badge tone="open">{t.statusOpen}</Badge>
        ) : info.status === 'upcoming' ? (
          <Badge tone="soon"><Clock className="w-3.5 h-3.5" aria-hidden="true" />{t.statusUpcoming}</Badge>
        ) : (
          <Badge tone="muted"><Lock className="w-3.5 h-3.5" aria-hidden="true" />{t.statusEnded}</Badge>
        )}
      </header>

      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" aria-hidden="true" />{def.meta.duration}</p>
        {info.completed && info.completedAt && <p>{t.doneAt} {formatTehran(info.completedAt, false)}</p>}
        {!info.completed && info.status === 'upcoming' && info.opensAt && (
          <p>
            {t.opensAt}: {formatTehran(info.opensAt)}
            <span className="block mt-1 text-base font-bold text-slate-800 dark:text-amber-100">
              <Countdown target={info.opensAt} clockOffsetMs={clockOffsetMs} onElapsed={refresh} />
            </span>
          </p>
        )}
        {!info.completed && isOpen && info.closesAt && <p>{t.closesAt}: {formatTehran(info.closesAt)}</p>}
      </div>

      {(canTake || canSeeResult) && (
        <div className="flex flex-wrap gap-2">
          {canTake && (
            <Link to={`/t/${info.id}`} className="no-underline">
              <Button variant="primary" size="md">{info.completed ? t.again : draft ? t.resume : t.start}</Button>
            </Link>
          )}
          {canSeeResult && (
            <Link to={`/t/${info.id}`} className="no-underline">
              <Button variant="secondary" size="md">{t.viewResult}</Button>
            </Link>
          )}
        </div>
      )}
    </article>
  );
};

export const HubScreen: React.FC = () => {
  const { user } = useAuth();
  const { tests, loading, failed, refresh } = useTests();
  if (!user) return null;

  return (
    <div className="w-full flex flex-col gap-5 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-amber-100">{t.hello} {user.firstName}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.intro}</p>
      </header>

      {loading ? (
        <LoadingSkeleton lines={2} />
      ) : failed && tests.length === 0 ? (
        <ErrorStateView title={t.loadFailed} description="" onRetry={refresh} />
      ) : tests.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-10 leading-loose">{t.none}</p>
      ) : (
        tests.map((info) => <TestCard key={info.id} info={info} mobile={user.mobile} />)
      )}
    </div>
  );
};
