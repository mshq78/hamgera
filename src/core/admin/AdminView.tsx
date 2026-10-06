import React, { useCallback, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { api, AdminTest, RosterUser } from '../services/api';
import { ADMIN } from '../content/admin.fa';
import { Button } from '../components/Button';
import { SchedulePanel } from './SchedulePanel';
import { UsersPanel } from './UsersPanel';
import { ResultsPanel } from './ResultsPanel';

type Tab = 'tests' | 'users' | 'results';

/** The admin password lives only in this component's memory; closing the tab logs the admin out. */
export const AdminView: React.FC = () => {
  const [password, setPassword] = useState('');
  const [input, setInput] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>('tests');
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async (pw: string) => {
    const [t, u] = await Promise.all([api.adminTests(pw), api.listUsers(pw)]);
    if (t.ok) setTests(t.data.tests);
    if (u.ok) setUsers(u.data.users);
    return t;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginMessage('');
    const res = await loadAll(input);
    setLoggingIn(false);
    if (res.ok) {
      setPassword(input);
      setInput('');
    } else {
      setLoginMessage(
        res.status === 401
          ? ADMIN.invalidPassword
          : res.error === 'admin_password_not_configured'
          ? ADMIN.passwordNotConfigured
          : res.error === 'database_not_configured'
          ? ADMIN.databaseNotConfigured
          : ADMIN.backendUnavailable
      );
    }
  };

  if (!password) {
    return (
      <div className="w-full max-w-sm mx-auto py-10">
        <form onSubmit={handleLogin} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center"><Lock className="w-5 h-5" aria-hidden="true" /></div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-amber-100">{ADMIN.loginTitle}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ADMIN.loginSubtitle}</p>
            </div>
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{ADMIN.passwordLabel}</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ADMIN.passwordPlaceholder}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base text-left focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {loginMessage && <p role="alert" className="text-xs text-rose-500 font-medium">{loginMessage}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loggingIn} disabled={!input}>{ADMIN.loginButton}</Button>
          <a href="#/" className="block text-center text-xs text-slate-500 dark:text-slate-400 hover:text-amber-600">{ADMIN.back}</a>
        </form>
      </div>
    );
  }

  const refresh = async () => {
    setRefreshing(true);
    await loadAll(password);
    setRefreshing(false);
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'tests', label: ADMIN.tabTests },
    { id: 'users', label: ADMIN.tabUsers },
    { id: 'results', label: ADMIN.tabResults },
  ];

  return (
    <div className="w-full space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-amber-100">{ADMIN.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" isLoading={refreshing} leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={refresh}>{ADMIN.refresh}</Button>
          <a href="#/" className="no-underline"><Button variant="ghost" size="sm">{ADMIN.back}</Button></a>
        </div>
      </header>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition cursor-pointer ${
              tab === x.id
                ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'tests' && <SchedulePanel tests={tests} adminPassword={password} onChanged={refresh} />}
      {tab === 'users' && <UsersPanel adminPassword={password} users={users} onChanged={refresh} />}
      {tab === 'results' && <ResultsPanel adminPassword={password} />}
    </div>
  );
};
