import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { toPersianDigits } from '@/core/utils/number';
import {
  DIMENSIONS, FAST_SECONDS, MIN_GROUP, RxResponse, Summary, bySegment, reactionStatus, roundNps, summarize, top2Status, wordFrequency,
} from '../../../shared/reaction/metrics';
import { LIKERT_QUESTIONS, OPEN_QUESTIONS, questionText } from '../../../shared/reaction/questions';
import { BarList, Card, Delta, Histogram, StackedBar, StatusBadge, fa1, faInt, heatStyle } from './charts';
import type { RxStoredResponse } from './rxApi';

/**
 * The reaction dashboard: an overview first, then the details (spec §7). The same component is the printable
 * report: `printMode` hides the editing controls.
 */

interface Props {
  responses: RxStoredResponse[];
  /** Responses of the event this one is compared with (same survey version), if chosen. */
  baseline: RxResponse[] | null;
  baselineTitle: string | null;
  printMode?: boolean;
  onSetTags?: (responseId: string, questionId: string, tags: string[]) => void;
}

const kpi = 'viz-card rounded-2xl border p-4 space-y-1';

const Kpi: React.FC<{ label: string; value: string; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className={kpi} style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-grid)' }}>
    <div className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>{label}</div>
    <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--viz-ink)' }} dir="ltr">{value}</div>
    {sub && <div className="min-h-[1.25rem]">{sub}</div>}
  </div>
);

const DIM_TITLES: Record<string, string> = {
  design_relevance: 'طراحی و ارتباط با کار',
  engagement: 'درگیری و مشارکت',
  facilitation_delivery: 'تسهیلگری و اجرا',
  overall_satisfaction: 'رضایت کلی',
};

export const RxDashboard: React.FC<Props> = ({ responses, baseline, baselineTitle, printMode = false, onSetTags }) => {
  const s = useMemo(() => summarize(responses), [responses]);
  const base: Summary | null = useMemo(() => (baseline && baseline.length ? summarize(baseline) : null), [baseline]);
  const segments = useMemo(() => bySegment(responses), [responses]);
  const words = useMemo(() => wordFrequency(responses), [responses]);
  const [sortWeakFirst, setSortWeakFirst] = useState(true);
  const [showWords, setShowWords] = useState(true);
  const [openQ, setOpenQ] = useState(OPEN_QUESTIONS[0].id);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  if (s.n === 0) return <p className="text-center text-sm py-10" style={{ color: 'var(--viz-ink-3)' }}>برای این فیلترها هنوز پاسخ نهایی‌ای نیست.</p>;

  const delta = (cur: number, prev: number | undefined) => (base && prev !== undefined ? cur - prev : NaN);
  const top2Rows = [...s.items]
    .map((i) => ({ id: i.id, label: `${toPersianDigits(i.id.slice(1))}. ${LIKERT_QUESTIONS.find((q) => q.id === i.id)!.text}`, value: i.top2 }))
    .sort((a, b) => (sortWeakFirst ? a.value - b.value : b.value - a.value));

  const answersOf = responses
    .filter((r) => typeof r.answers[openQ] === 'string')
    .filter((r) => !search || String(r.answers[openQ]).includes(search))
    .filter((r) => !tagFilter || (r.tags[openQ] ?? []).includes(tagFilter));
  const allTags = [...new Set(responses.flatMap((r) => r.tags[openQ] ?? []))];

  const maxWord = Math.max(1, ...words.map((w) => w.count));

  return (
    <div className="viz-root space-y-5" style={{ color: 'var(--viz-ink)' }}>
      {/* 1. KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="پاسخ نهایی" value={faInt(s.n)} sub={s.fast > 0 && <span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>{faInt(s.fast)} پاسخ زیر {toPersianDigits(FAST_SECONDS)} ثانیه (علامت‌خورده)</span>} />
        <Kpi label="Reaction Index (۰ تا ۱۰۰)" value={fa1(s.reactionIndex)} sub={<span className="inline-flex items-center gap-2"><StatusBadge status={reactionStatus(s.reactionIndex)} /><Delta value={delta(s.reactionIndex, base?.reactionIndex)} /></span>} />
        <Kpi label="Overall Rating (۰ تا ۱۰)" value={fa1(s.overall.mean)} sub={<span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>میانه {fa1(s.overall.median)} <Delta value={delta(s.overall.mean, base?.overall.mean)} /></span>} />
        <Kpi label="NPS (−۱۰۰ تا +۱۰۰)" value={Number.isFinite(s.nps.score) ? `${roundNps(s.nps.score) > 0 ? '+' : ''}${faInt(roundNps(s.nps.score))}` : '—'} sub={<Delta value={delta(s.nps.score, base?.nps.score)} whole />} />
      </div>
      {base && baselineTitle && <p className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>تغییرها نسبت به «{baselineTitle}» ({faInt(base.n)} پاسخ) است.</p>}

      {/* 2. Four dimension cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DIMENSIONS.map((d) => {
          const score = s.dimensions[d.key];
          return (
            <div key={d.key} className={kpi} style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-grid)' }}>
              <div className="text-[12px] font-semibold" style={{ color: 'var(--viz-ink-2)' }}>{DIM_TITLES[d.key]}</div>
              <div className="text-[11px]" style={{ color: 'var(--viz-ink-3)' }} dir="ltr">{d.title}</div>
              <div className="text-2xl font-extrabold tabular-nums" dir="ltr">{fa1(score)}</div>
              <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={reactionStatus(score)} /><Delta value={delta(score, base?.dimensions[d.key])} /></div>
            </div>
          );
        })}
      </div>

      {/* 3. Top-2 box by question */}
      <Card title="درصد پاسخ‌های «موافقم» و «کاملاً موافقم» (Top-2 Box) به تفکیک سؤال" hint="عدد بالاتر یعنی واکنش مطلوب‌تر. هیچ سؤالی وارونه نمره‌گذاری نمی‌شود.">
        {!printMode && (
          <div className="flex gap-2 no-print" role="group" aria-label="ترتیب">
            {[true, false].map((weak) => (
              <button key={String(weak)} type="button" aria-pressed={sortWeakFirst === weak} onClick={() => setSortWeakFirst(weak)} className="px-3 py-1 rounded-lg text-[12px] border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', background: sortWeakFirst === weak ? 'var(--viz-bar)' : 'transparent', color: sortWeakFirst === weak ? '#fff' : 'var(--viz-ink-2)' }}>
                {weak ? 'از ضعیف‌ترین' : 'از قوی‌ترین'}
              </button>
            ))}
          </div>
        )}
        <BarList rows={top2Rows} labelWidth="min(16rem, 40%)" />
      </Card>

      {/* 4. Item heatmap */}
      <Card title="تحلیل آیتم‌ها (Q01–Q20)" hint="رنگ هر خانه شدت درصد را نشان می‌دهد؛ عدد همیشه نوشته شده است.">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-right border-separate" style={{ borderSpacing: 2 }}>
            <thead style={{ color: 'var(--viz-ink-3)' }}>
              <tr>
                <th className="px-2 py-1 font-medium">سؤال</th>
                <th className="px-2 py-1 font-medium text-center">میانگین</th>
                <th className="px-2 py-1 font-medium text-center">Top-2</th>
                <th className="px-2 py-1 font-medium text-center">خنثی</th>
                <th className="px-2 py-1 font-medium text-center">Bottom-2</th>
                <th className="px-2 py-1 font-medium text-center">N</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-2 py-1" style={{ color: 'var(--viz-ink-2)' }}><span className="font-semibold" style={{ color: 'var(--viz-ink)' }}>{toPersianDigits(i.id)}</span> {LIKERT_QUESTIONS.find((q) => q.id === i.id)!.text}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-semibold rounded" style={heatStyle(((i.mean - 1) / 4) * 100)} dir="ltr">{fa1(i.mean)}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-semibold rounded" style={heatStyle(i.top2)} dir="ltr">{fa1(i.top2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums rounded" style={{ color: 'var(--viz-ink-2)' }} dir="ltr">{fa1(i.neutral)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums rounded" style={{ color: 'var(--viz-ink-2)' }} dir="ltr">{fa1(i.bottom2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums" style={{ color: 'var(--viz-ink-3)' }}>{faInt(i.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5 + 6. Overall rating and NPS */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="توزیع امتیاز کلی (Q21)" hint={`میانگین ${fa1(s.overall.mean)} · میانه ${fa1(s.overall.median)} · ${faInt(s.overall.n)} پاسخ`}>
          <Histogram counts={s.overall.distribution} labels={s.overall.distribution.map((_, i) => toPersianDigits(i))} />
        </Card>
        <Card title="Net Promoter Score (Q22)" hint="Promoter ۹–۱۰ · Passive ۷–۸ · Detractor ۰–۶؛ NPS = درصد Promoter منهای درصد Detractor">
          <div className="text-3xl font-extrabold tabular-nums" dir="ltr">{Number.isFinite(s.nps.score) ? `${roundNps(s.nps.score) > 0 ? '+' : ''}${faInt(roundNps(s.nps.score))}` : '—'}</div>
          <StackedBar
            parts={[
              { label: 'Promoter', value: s.nps.promoters, color: 'var(--viz-top)' },
              { label: 'Passive', value: s.nps.passives, color: 'var(--viz-neutral)' },
              { label: 'Detractor', value: s.nps.detractors, color: 'var(--viz-bottom)' },
            ]}
          />
        </Card>
      </div>

      {/* Top-2 / neutral / bottom-2 per dimension */}
      <Card title="توزیع واکنش در هر بُعد" hint="میانگین درصدها روی آیتم‌های هر بُعد">
        <div className="space-y-4">
          {DIMENSIONS.map((d) => {
            const items = s.items.filter((i) => d.ids.includes(i.id));
            const avg = (f: (i: (typeof items)[number]) => number) => items.reduce((a, i) => a + f(i), 0) / items.length;
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold">{DIM_TITLES[d.key]}</span>
                  <StatusBadge status={top2Status(avg((i) => i.top2))} />
                </div>
                <StackedBar parts={[{ label: 'Top-2', value: avg((i) => i.top2), color: 'var(--viz-top)' }, { label: 'خنثی', value: avg((i) => i.neutral), color: 'var(--viz-neutral)' }, { label: 'Bottom-2', value: avg((i) => i.bottom2), color: 'var(--viz-bottom)' }]} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* 7. Segments (privacy rule) */}
      {segments.length > 0 && (
        <Card title="مقایسهٔ گروه‌ها" hint={`گروهی که کمتر از ${toPersianDigits(MIN_GROUP)} پاسخ دارد برای حفظ گمنامی نمایش داده نمی‌شود.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-right">
              <thead style={{ color: 'var(--viz-ink-3)' }}>
                <tr><th className="px-2 py-1 font-medium">گروه</th><th className="px-2 py-1 font-medium">پاسخ</th><th className="px-2 py-1 font-medium">Reaction Index</th><th className="px-2 py-1 font-medium">NPS</th></tr>
              </thead>
              <tbody>
                {segments.map((g) => (
                  <tr key={g.segment} className="border-t" style={{ borderColor: 'var(--viz-grid)' }}>
                    <td className="px-2 py-1.5 font-medium">{g.segment}</td>
                    <td className="px-2 py-1.5 tabular-nums">{faInt(g.n)}</td>
                    {g.hidden ? (
                      <td colSpan={2} className="px-2 py-1.5" style={{ color: 'var(--viz-ink-3)' }}>نمونهٔ ناکافی</td>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 tabular-nums" dir="ltr">{fa1(g.summary!.reactionIndex)}</td>
                        <td className="px-2 py-1.5 tabular-nums" dir="ltr">{faInt(roundNps(g.summary!.nps.score))}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 8. Open answers */}
      <Card title="بازخورد آزاد" hint="پاسخ‌های متنی بدون تحلیل خودکار احساسات؛ جست‌وجو و برچسب‌گذاری دستی.">
        <div className="flex flex-wrap items-center gap-2 no-print">
          {OPEN_QUESTIONS.map((q) => (
            <button key={q.id} type="button" aria-pressed={openQ === q.id} onClick={() => { setOpenQ(q.id); setTagFilter(''); }} className="px-3 py-1 rounded-lg text-[12px] border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', background: openQ === q.id ? 'var(--viz-bar)' : 'transparent', color: openQ === q.id ? '#fff' : 'var(--viz-ink-2)' }}>
              {toPersianDigits(q.id)}
            </button>
          ))}
        </div>
        <p className="text-[13px] font-semibold">{questionText(openQ)}</p>
        {!printMode && (
          <div className="flex flex-wrap gap-2 no-print">
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--viz-ink-3)' }} aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در پاسخ‌ها" aria-label="جست‌وجو در پاسخ‌ها" className="w-full pr-9 pl-3 py-2 rounded-xl border text-[13px] bg-transparent" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }} />
            </div>
            {allTags.length > 0 && (
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="فیلتر برچسب" className="px-3 py-2 rounded-xl border text-[13px] bg-transparent" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }}>
                <option value="">همهٔ برچسب‌ها</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}
        <p className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>{faInt(answersOf.length)} پاسخ</p>
        <ul className="space-y-2" role="list">
          {answersOf.map((r) => (
            <li key={r.id} className="rounded-xl border p-3 text-[14px] leading-relaxed" style={{ borderColor: 'var(--viz-grid)' }}>
              <p className="whitespace-pre-wrap break-words">{String(r.answers[openQ])}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {r.segment && <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink-3)' }}>{r.segment}</span>}
                {(r.tags[openQ] ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--viz-grid)', color: 'var(--viz-ink)' }}>
                    {t}
                    {!printMode && onSetTags && (
                      <button type="button" aria-label={`حذف برچسب ${t}`} className="cursor-pointer no-print" onClick={() => onSetTags(r.id, openQ, (r.tags[openQ] ?? []).filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                    )}
                  </span>
                ))}
                {!printMode && onSetTags && (
                  <input
                    aria-label="افزودن برچسب"
                    placeholder="+ برچسب"
                    maxLength={30}
                    className="no-print text-[11px] px-2 py-0.5 rounded-full border bg-transparent w-20"
                    style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }}
                    onKeyDown={(e) => {
                      const el = e.currentTarget;
                      if (e.key === 'Enter' && el.value.trim()) {
                        onSetTags(r.id, openQ, [...(r.tags[openQ] ?? []), el.value.trim()]);
                        el.value = '';
                      }
                    }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Q27 words */}
      <Card title="سه کلمه دربارهٔ تجربه (Q27)" hint="تعداد تکرار هر واژه پس از حذف واژه‌های رایج؛ متن خام را جایگزین نمی‌کند.">
        {!printMode && (
          <label className="flex items-center gap-2 text-[12px] no-print" style={{ color: 'var(--viz-ink-2)' }}>
            <input type="checkbox" checked={showWords} onChange={(e) => setShowWords(e.target.checked)} /> نمایش ابر واژگان
          </label>
        )}
        {showWords && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" role="list">
            {words.map((w) => (
              <li key={w.word} className="inline-flex items-baseline gap-1" style={{ fontSize: `${14 + Math.round((w.count / maxWord) * 18)}px`, fontWeight: w.count / maxWord > 0.5 ? 800 : 600, color: 'var(--viz-bar)' }}>
                {w.word}
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--viz-ink-3)', fontWeight: 400 }}>{faInt(w.count)}</span>
              </li>
            ))}
          </ul>
        )}
        <details className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>
          <summary className="cursor-pointer">جدول تکرار واژه‌ها</summary>
          <table className="mt-2 text-right"><tbody>{words.map((w) => <tr key={w.word}><td className="pl-4">{w.word}</td><td className="tabular-nums">{faInt(w.count)}</td></tr>)}</tbody></table>
        </details>
      </Card>
    </div>
  );
};
