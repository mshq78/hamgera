import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FileSpreadsheet, FileText, Plus, Pencil, Printer, Check } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { ErrorStateView, LoadingSkeleton } from '@/core/components/StateViews';
import { JalaliDateTimeInput } from '@/core/components/JalaliDateTimeInput';
import { downloadText } from '@/core/utils/download';
import { dayToInstant, formatTehran, formatTehranDate, instantToDay } from '@/core/utils/jalali';
import { toPersianDigits } from '@/core/utils/number';
import { RxEvent, RxStoredResponse, rxApi, surveyLink, RxAuditEntry } from './rxApi';
import { EventForm } from './EventForm';
import { RxDashboard } from './RxDashboard';
import { ResponsesTable } from './ResponsesTable';
import { buildCsv, buildSheets } from './exports';
import { HpDashboard } from './HpDashboard';
import { HpResponsesTable } from './HpResponsesTable';
import { hpCsv, hpOpenCsv, hpSheets } from './hpExports';
import { MIN_GROUP, ProfileKey, profileGroups } from '../../../shared/hampayam/metrics';

/** The «ارزیابی واکنش» tab of the admin panel: events and their links, the dashboard, raw responses, the audit log. */

type View = 'dashboard' | 'raw' | 'audit';
const STATUS_TEXT: Record<RxEvent['status'], string> = { open: 'باز', upcoming: 'منتظر شروع', ended: 'پایان یافته', closed: 'بسته' };
const select = 'px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm';

const dayOf = (iso: string) => instantToDay(iso);

export const ReactionPanel: React.FC<{ adminPassword: string }> = ({ adminPassword }) => {
  const [events, setEvents] = useState<RxEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [responses, setResponses] = useState<RxStoredResponse[]>([]);
  const [baselineId, setBaselineId] = useState('');
  const [baselineResponses, setBaselineResponses] = useState<RxStoredResponse[]>([]);
  const [editing, setEditing] = useState<RxEvent | 'new' | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [cohort, setCohort] = useState('');
  const [segment, setSegment] = useState('');
  const [profile, setProfile] = useState<Record<ProfileKey, string>>({ P01: '', P02: '', P03: '' });
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [copied, setCopied] = useState('');
  const [audit, setAudit] = useState<RxAuditEntry[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadEvents = useCallback(async () => {
    const res = await rxApi.events(adminPassword);
    if (res.ok) {
      setEvents(res.data.events);
      setFailed(false);
      setSelected((cur) => (cur.length ? cur.filter((id) => res.data.events.some((e) => e.id === id)) : res.data.events[0] ? [res.data.events[0].id] : []));
    } else setFailed(true);
  }, [adminPassword]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadResponses = useCallback(async () => {
    if (selected.length === 0) return setResponses([]);
    const res = await rxApi.responses(adminPassword, selected, true);
    if (res.ok) setResponses(res.data.responses);
  }, [adminPassword, selected]);
  useEffect(() => { loadResponses(); }, [loadResponses]);

  useEffect(() => {
    if (!baselineId) return setBaselineResponses([]);
    rxApi.responses(adminPassword, [baselineId], false).then((res) => setBaselineResponses(res.ok ? res.data.responses : []));
  }, [adminPassword, baselineId]);

  useEffect(() => {
    if (view !== 'audit') return;
    rxApi.audit(adminPassword, selected.length === 1 ? selected[0] : undefined).then((res) => res.ok && setAudit(res.data.audit));
  }, [view, adminPassword, selected]);

  const chosen = useMemo(() => (events ?? []).filter((e) => selected.includes(e.id)), [events, selected]);
  const kind = chosen[0]?.kind ?? 'tt';
  const isHp = kind === 'hampayam';
  // Filter values are offered only for groups with at least MIN_GROUP final responses (privacy rule).
  const groups = useMemo(() => ({ P01: profileGroups(responses.filter((r) => !r.deleted), 'P01'), P02: profileGroups(responses.filter((r) => !r.deleted), 'P02'), P03: profileGroups(responses.filter((r) => !r.deleted), 'P03') }), [responses]);
  const cohorts = useMemo(() => [...new Set(chosen.map((e) => e.cohort).filter(Boolean) as string[])], [chosen]);
  const segments = useMemo(() => [...new Set(chosen.flatMap((e) => e.segments))], [chosen]);
  const compatibleBaselines = (events ?? []).filter((e) => !selected.includes(e.id) && chosen.length > 0 && e.surveyVersion === chosen[0].surveyVersion && e.kind === chosen[0].kind);

  const filtered = useMemo(
    () =>
      responses.filter((r) => {
        if (r.deleted) return false;
        if (cohort && events?.find((e) => e.id === r.eventId)?.cohort !== cohort) return false;
        if (segment && r.segment !== segment) return false;
        for (const k of ['P01', 'P02', 'P03'] as ProfileKey[]) if (profile[k] && r.answers[k] !== profile[k]) return false;
        if (from && dayOf(r.submittedAt) < dayOf(from)) return false;
        if (to && dayOf(r.submittedAt) > dayOf(to)) return false;
        return true;
      }),
    [responses, cohort, segment, profile, from, to, events]
  );
  const baseline = useMemo(() => baselineResponses.filter((r) => (!segment || r.segment === segment) && (['P01', 'P02', 'P03'] as ProfileKey[]).every((k) => !profile[k] || r.answers[k] === profile[k])), [baselineResponses, segment, profile]);

  const filterNote = [cohort && `گروه: ${cohort}`, segment && `زیرگروه: ${segment}`, profile.P01 && `شرکت/واحد: ${profile.P01}`, profile.P02 && `سطح مسئولیت: ${profile.P02}`, profile.P03 && `سابقه: ${profile.P03}`, from && `از ${formatTehranDate(from, false)}`, to && `تا ${formatTehranDate(to, false)}`].filter(Boolean).join(' · ') || 'بدون فیلتر';

  const copy = async (e: RxEvent) => {
    try {
      await navigator.clipboard.writeText(surveyLink(e.code));
    } catch {
      /* the link is also shown as text */
    }
    setCopied(e.id);
    setTimeout(() => setCopied(''), 2000);
  };

  const setTags = async (responseId: string, questionId: string, tags: string[]) => {
    await rxApi.setTags(adminPassword, responseId, questionId, tags);
    await loadResponses();
  };

  const stamp = () => new Date().toISOString().slice(0, 10);
  const tagMap = () => Object.fromEntries(filtered.map((r) => [r.id, r.tags]));
  const exportCsv = () => {
    if (isHp) {
      downloadText(hpCsv(chosen, filtered), 'text/csv;charset=utf-8;', `hampayam_closed_${stamp()}.csv`);
      setTimeout(() => downloadText(hpOpenCsv(chosen, filtered, tagMap()), 'text/csv;charset=utf-8;', `hampayam_open_${stamp()}.csv`), 300);
    } else downloadText(buildCsv(chosen, filtered), 'text/csv;charset=utf-8;', `reaction_${stamp()}.csv`);
  };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      if (isHp) {
        const h = hpSheets(chosen, filtered, filterNote);
        await writeExcelFile([
          { data: h.summary as any, sheet: 'Summary', rightToLeft: true },
          { data: h.questions as any, sheet: 'Questions', stickyRowsCount: 1, rightToLeft: true },
          { data: h.journey as any, sheet: 'Journey', stickyRowsCount: 1, rightToLeft: true },
          { data: h.openFeedback as any, sheet: 'Open Feedback', stickyRowsCount: 1, rightToLeft: true },
          { data: h.metadata as any, sheet: 'Metadata', rightToLeft: true },
          { data: h.raw as any, sheet: 'Raw Responses', stickyRowsCount: 1, rightToLeft: true },
        ]).toFile(`hampayam_${stamp()}.xlsx`);
        return;
      }
      const sheets = buildSheets(chosen, filtered, filterNote);
      await writeExcelFile([
        { data: sheets.raw as any, sheet: 'Raw Responses', stickyRowsCount: 1, rightToLeft: true },
        { data: sheets.summary as any, sheet: 'Summary', rightToLeft: true },
        { data: sheets.items as any, sheet: 'Item Analysis', stickyRowsCount: 1, rightToLeft: true },
      ]).toFile(`reaction_${stamp()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  if (failed) return <ErrorStateView title="بارگذاری ارزیابی‌ها انجام نشد." description="" onRetry={loadEvents} />;
  if (!events) return <LoadingSkeleton lines={3} />;

  const saveEvent = async (input: Parameters<typeof rxApi.createEvent>[1]): Promise<string | null> => {
    const res = editing === 'new' || !editing ? await rxApi.createEvent(adminPassword, input) : await rxApi.updateEvent(adminPassword, editing.id, input);
    if (!res.ok) return res.error;
    if (editing === 'new' && res.data && 'id' in res.data) setSelected([(res.data as { id: string }).id]);
    setEditing(null);
    await loadEvents();
    return null;
  };

  const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

  return (
    <div className="space-y-5">
      {/* events */}
      <section className={`${card} p-4 space-y-3 no-print`}>
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-amber-100">رویدادها و لینک‌ها</h2>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing('new')}>رویداد جدید</Button>
        </header>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">برای هر رویداد یک لینک عمومی ساخته می‌شود. شرکت‌کننده بدون ورود و بدون ثبت هیچ اطلاعات هویتی پاسخ می‌دهد؛ فقط ادمین نتایج را می‌بیند.</p>
        {events.length === 0 ? (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">هنوز رویدادی ساخته نشده است.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={selected.includes(e.id)} onChange={(ev) => { setProfile({ P01: '', P02: '', P03: '' }); setSegment(''); setCohort(''); setSelected((cur) => (ev.target.checked ? [...cur.filter((id) => events.find((x) => x.id === id)?.kind === e.kind), e.id] : cur.filter((x) => x !== e.id))); }} aria-label={`انتخاب ${e.title}`} />
                    {e.title}
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {e.eventDate ? formatTehranDate(dayToInstant(e.eventDate), false) : '—'}{e.cohort ? ` · ${e.cohort}` : ''}{e.location ? ` · ${e.location}` : ''}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">{STATUS_TEXT[e.status]}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{e.kind === 'hampayam' ? 'تجربه هم‌پیام' : 'واکنش ۳ت'}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{toPersianDigits(e.responses)} پاسخ</span>
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(e)}>ویرایش</Button>
                </div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="flex-1 min-w-0 truncate text-[11px] px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{surveyLink(e.code)}</code>
                  <Button variant="secondary" size="sm" leftIcon={copied === e.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} onClick={() => copy(e)}>{copied === e.id ? 'کپی شد' : 'کپی لینک'}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {chosen.length > 0 && (
        <>
          {/* filters */}
          <section className={`${card} p-4 space-y-3 no-print`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-amber-100">فیلترها</h2>
            <div className="flex flex-wrap items-end gap-3">
              {cohorts.length > 0 && (
                <label className="text-xs space-y-1 block">گروه / دوره
                  <select className={`${select} block`} value={cohort} onChange={(e) => setCohort(e.target.value)}><option value="">همه</option>{cohorts.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
              )}
              {isHp && ([['P01', 'شرکت/واحد'], ['P02', 'سطح مسئولیت'], ['P03', 'سابقه حضور']] as [ProfileKey, string][]).map(([k, label]) => (
                <label key={k} className="text-xs space-y-1 block">{label}
                  <select className={`${select} block`} value={profile[k]} onChange={(e) => setProfile((p) => ({ ...p, [k]: e.target.value }))} disabled={groups[k].length === 0}>
                    <option value="">همه</option>{groups[k].map((g) => <option key={g.value} value={g.value}>{g.value} ({toPersianDigits(g.n)})</option>)}
                  </select>
                </label>
              ))}
              {!isHp && segments.length > 0 && (
                <label className="text-xs space-y-1 block">زیرگروه
                  <select className={`${select} block`} value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">همه</option>{segments.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
              )}
              <label className="text-xs space-y-1 block">مقایسه با رویداد
                <select className={`${select} block`} value={baselineId} onChange={(e) => setBaselineId(e.target.value)} disabled={compatibleBaselines.length === 0}>
                  <option value="">بدون مقایسه</option>
                  {compatibleBaselines.map((e) => <option key={e.id} value={e.id}>{e.title}{e.eventDate ? ` — ${formatTehranDate(dayToInstant(e.eventDate), false)}` : ''}</option>)}
                </select>
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <JalaliDateTimeInput label="از تاریخ ارسال (اختیاری)" value={from} dateOnly optional onChange={setFrom} />
              <JalaliDateTimeInput label="تا تاریخ ارسال (اختیاری)" value={to} dateOnly optional onChange={setTo} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">مقایسه فقط بین رویدادهای هم‌نوع و دارای نسخهٔ یکسان پرسشنامه ممکن است.{isHp && ` فیلتر گروهی فقط برای گروه‌های دارای دست‌کم ${toPersianDigits(MIN_GROUP)} پاسخ فعال می‌شود.`}</p>
          </section>

          {/* views */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div role="tablist" className="flex gap-2">
              {([['dashboard', 'داشبورد'], ['raw', 'پاسخ‌های خام'], ['audit', 'لاگ تغییرات']] as [View, string][]).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`px-4 py-2 rounded-xl text-sm font-medium border cursor-pointer transition ${view === id ? 'bg-slate-900 text-amber-100 border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400'}`}>{label}</button>
              ))}
            </div>
            <span className="flex-1" />
            <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />} onClick={exportCsv} disabled={filtered.length === 0}>CSV</Button>
            <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />} isLoading={exporting} onClick={exportExcel} disabled={filtered.length === 0}>Excel</Button>
            <Button variant="secondary" size="sm" leftIcon={<Printer className="w-3.5 h-3.5" />} onClick={() => window.print()} disabled={filtered.length === 0}>گزارش چاپی / PDF</Button>
          </div>

          {/* the printed report starts with its own heading */}
          <div className="print-only" style={{ marginBottom: 12 }}>
            <img src="/logo.png" alt="" style={{ width: 44, height: 44, float: 'left' }} />
            <p style={{ fontSize: 11 }}>هم‌گرا · پردیس نوآوری گرا</p>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{isHp ? 'گزارش ارزیابی تجربه هم‌پیام' : 'گزارش ارزیابی واکنش'} — {chosen.map((e) => e.title).join('، ')}</h1>
            <p style={{ fontSize: 12 }}>{filterNote} · تهیه‌شده در {formatTehran(new Date().toISOString(), false)}</p>
          </div>

          {view === 'dashboard' && isHp && (
            <HpDashboard responses={filtered} baseline={baselineId ? baseline : null} baselineTitle={events.find((e) => e.id === baselineId)?.title ?? null} title={chosen.map((e) => e.title).join('، ')} onSetTags={setTags} />
          )}
          {view === 'dashboard' && !isHp && (
            <RxDashboard responses={filtered} baseline={baselineId ? baseline : null} baselineTitle={events.find((e) => e.id === baselineId)?.title ?? null} onSetTags={setTags} />
          )}
          {view === 'raw' && (
            <div className="space-y-2 no-print">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> نمایش پاسخ‌های حذف‌شده</label>
              {isHp ? <HpResponsesTable adminPassword={adminPassword} events={events} responses={responses.filter((r) => showDeleted || !r.deleted)} reload={async () => { await loadResponses(); await loadEvents(); }} /> : <ResponsesTable adminPassword={adminPassword} events={events} responses={responses.filter((r) => showDeleted || !r.deleted)} reload={async () => { await loadResponses(); await loadEvents(); }} />}
            </div>
          )}
          {view === 'audit' && (
            <div className={`${card} overflow-x-auto no-print`}>
              {audit.length === 0 ? <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">هنوز تغییری ثبت نشده است.</p> : (
                <table className="w-full text-xs sm:text-sm text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-2 font-medium">زمان</th><th className="px-3 py-2 font-medium">عمل</th><th className="px-3 py-2 font-medium">قبل</th><th className="px-3 py-2 font-medium">بعد</th></tr></thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{formatTehran(a.at, false)}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]" dir="ltr">{a.action}</td>
                        <td className="px-3 py-2 text-[11px] max-w-[18rem] break-words" dir="ltr">{a.before === null ? '—' : JSON.stringify(a.before)}</td>
                        <td className="px-3 py-2 text-[11px] max-w-[18rem] break-words" dir="ltr">{a.after === null ? '—' : JSON.stringify(a.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {editing && <EventForm event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveEvent} />}
    </div>
  );
};
