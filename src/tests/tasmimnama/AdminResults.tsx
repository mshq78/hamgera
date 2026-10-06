import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { AdminResultsProps } from '../types';
import type { StoredSession } from '@/core/services/api';
import { SessionData, TasmimnamaResult } from './types';
import { CHARACTER_CODES } from './content/characters.codes';
import { charactersData } from './content/characters.fa';
import { toPersianDigits, toEnglishDigits } from '@/core/utils/number';
import { formatTehran } from '@/core/utils/jalali';

type Session = StoredSession<SessionData, TasmimnamaResult>;
const fullName = (s: Session) => `${s.firstName} ${s.lastName}`.trim() || s.mobile;

/** Admin results of تصمیم‌نما: how many people landed on each character, and every session. */
export default function AdminResults({ sessions: raw }: AdminResultsProps) {
  const sessions = raw as Session[];
  const [search, setSearch] = useState('');

  const counts = useMemo(
    () => Object.fromEntries(CHARACTER_CODES.map((c) => [c, sessions.filter((s) => s.result?.characterCode === c).length])) as Record<string, number>,
    [sessions]
  );
  const max = Math.max(1, ...Object.values(counts));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sessions.filter((s) => fullName(s).toLowerCase().includes(q) || s.mobile.includes(toEnglishDigits(q)) || (s.data.trackingCode ?? '').includes(q)) : sessions;
  }, [sessions, search]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-amber-100">توزیع شخصیت‌ها · {toPersianDigits(sessions.length)} جلسه</h2>
        <ul className="space-y-2">
          {CHARACTER_CODES.map((c) => (
            <li key={c} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-slate-700 dark:text-slate-200">{charactersData[c].name}</span>
              <span className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(counts[c] / max) * 100}%` }} />
              </span>
              <span className="w-8 text-left tabular-nums text-slate-600 dark:text-slate-300">{toPersianDigits(counts[c])}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جست‌وجوی نام، شماره یا کد پیگیری…"
          aria-label="جست‌وجو"
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">زمان ثبت</th>
              <th className="px-3 py-2 font-medium">نام</th>
              <th className="px-3 py-2 font-medium">شماره تماس</th>
              <th className="px-3 py-2 font-medium">شخصیت</th>
              <th className="px-3 py-2 font-medium">تساوی‌شکن</th>
              <th className="px-3 py-2 font-medium">کد پیگیری</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.sessionId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap">{formatTehran(s.data.finishedAt, false)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fullName(s)}</td>
                <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{s.mobile}</td>
                <td className="px-3 py-2 whitespace-nowrap font-medium">{s.result ? charactersData[s.result.characterCode].name : '—'}</td>
                <td className="px-3 py-2">{s.data.tiebreakAnswer ? 'بله' : '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{s.data.trackingCode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
