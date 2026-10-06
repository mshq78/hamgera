import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { api, StoredSession } from '../services/api';
import { ADMIN } from '../content/admin.fa';
import { ErrorStateView, LoadingSkeleton } from '../components/StateViews';
import { TEST_IDS, TestId } from '../../../shared/tests';
import { REGISTRY } from '@/tests/registry';

const t = ADMIN.results;

export const ResultsPanel: React.FC<{ adminPassword: string }> = ({ adminPassword }) => {
  const [testId, setTestId] = useState<TestId>(TEST_IDS[0]);
  const [sessions, setSessions] = useState<StoredSession[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await api.adminSessions(adminPassword, testId);
    if (res.ok) {
      setSessions(res.data.sessions);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [adminPassword, testId]);

  useEffect(() => {
    setSessions(null);
    setFailed(false);
    load();
  }, [load]);

  const AdminResults = REGISTRY[testId].AdminResults;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t.pickTest} className="flex flex-wrap gap-2">
        {TEST_IDS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={testId === id}
            onClick={() => setTestId(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition cursor-pointer ${
              testId === id
                ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'
            }`}
          >
            {REGISTRY[id].meta.title}
          </button>
        ))}
      </div>

      {failed ? (
        <ErrorStateView title={t.loadFailed} description="" onRetry={load} />
      ) : sessions === null ? (
        <LoadingSkeleton lines={3} />
      ) : sessions.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-10">{t.empty}</p>
      ) : (
        <Suspense fallback={<LoadingSkeleton lines={3} />}>
          <AdminResults key={testId} adminPassword={adminPassword} sessions={sessions} reload={load} />
        </Suspense>
      )}
    </div>
  );
};
