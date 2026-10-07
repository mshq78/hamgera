import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Search, Star, X } from 'lucide-react';
import { toPersianDigits } from '@/core/utils/number';
import { downloadBlob } from '@/core/utils/download';
import { reactionStatus, roundNps, top2Status } from '../../../shared/reaction/metrics';
import { HP_DIMENSIONS, HP_JOURNEY, HP_LIKERT, HP_OPEN } from '../../../shared/hampayam/questions';
import { MIN_GROUP, HpSummary, strengthsAndOpportunities, summarizeHp } from '../../../shared/hampayam/metrics';
import { BarList, Card, Delta, StackedBar, StatusBadge, fa1, faInt, heatStyle } from './charts';
import { LIGHT, SCREEN, journeySvg, kpiCardSvg, svgToPng } from './hpSvg';
import type { RxStoredResponse } from './rxApi';

/** The HamPayam dashboard (spec §11): KPI row, six indices, journey, distributions, heatmap, participants' voice. Doubles as the printed report. */

export const STAR = '★ منتخب';

interface Props {
  responses: RxStoredResponse[];
  baseline: RxStoredResponse[] | null;
  baselineTitle: string | null;
  title: string;
  printMode?: boolean;
  onSetTags?: (responseId: string, questionId: string, tags: string[]) => void;
}

const box = 'viz-card rounded-2xl border p-4 space-y-1';
const Kpi: React.FC<{ label: string; value: string; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className={box} style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-grid)' }}>
    <div className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>{label}</div>
    <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--viz-ink)' }} dir="ltr">{value}</div>
    {sub && <div className="min-h-[1.25rem]">{sub}</div>}
  </div>
);

export const HpDashboard: React.FC<Props> = ({ responses, baseline, baselineTitle, title, printMode = false, onSetTags }) => {
  const s = useMemo(() => summarizeHp(responses), [responses]);
  const base: HpSummary | null = useMemo(() => (baseline && baseline.length >= MIN_GROUP ? summarizeHp(baseline) : null), [baseline]);
  const sw = useMemo(() => strengthsAndOpportunities(s.items), [s.items]);
  const [openQ, setOpenQ] = useState(HP_OPEN[0].id);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [png, setPng] = useState(false);

  if (s.n === 0) return <p className="text-center text-sm py-10" style={{ color: 'var(--viz-ink-3)' }}>برای این فیلترها هنوز پاسخ نهایی‌ای نیست.</p>;
  const delta = (cur: number, prev: number | undefined) => (base && prev !== undefined ? cur - prev : NaN);
  const stamp = new Date().toISOString().slice(0, 10);
  const exportPng = async (what: 'journey' | 'kpi') => {
    setPng(true);
    try {
      const [svg, w, h] = what === 'journey' ? [journeySvg(s, LIGHT), 760, 330] : [kpiCardSvg(s, title), 900, 520];
      downloadBlob(await svgToPng(svg, w, h), `hampayam_${what}_${stamp}.png`);
    } finally {
      setPng(false);
    }
  };

  const answersOf = responses
    .filter((r) => typeof r.answers[openQ] === 'string')
    .filter((r) => !search || String(r.answers[openQ]).includes(search))
    .filter((r) => !tagFilter || (r.tags[openQ] ?? []).includes(tagFilter))
    .sort((a, b) => Number((b.tags[openQ] ?? []).includes(STAR)) - Number((a.tags[openQ] ?? []).includes(STAR)));
  const allTags = [...new Set(responses.flatMap((r) => r.tags[openQ] ?? []))].filter((t) => t !== STAR);
  const starred = responses.flatMap((r) => HP_OPEN.filter((q) => (r.tags[q.id] ?? []).includes(STAR) && typeof r.answers[q.id] === 'string').map((q) => ({ id: `${r.id}${q.id}`, q, text: String(r.answers[q.id]) })));
  const qLabel = (id: string) => `${toPersianDigits(id)}. ${HP_LIKERT.find((q) => q.id === id)!.text}`;
  const npsText = Number.isFinite(s.nps.score) ? `${roundNps(s.nps.score) > 0 ? '+' : ''}${faInt(roundNps(s.nps.score))}` : '—';

  return (
    <div className="viz-root space-y-5" style={{ color: 'var(--viz-ink)' }}>
      {/* row 1: KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi label="Experience Index (۰ تا ۱۰۰)" value={fa1(s.experienceIndex)} sub={<span className="inline-flex items-center gap-2"><StatusBadge status={reactionStatus(s.experienceIndex)} /><Delta value={delta(s.experienceIndex, base?.experienceIndex)} /></span>} />
        <Kpi label="Overall Rating — Q25 (۰ تا ۱۰)" value={fa1(s.overall.mean)} sub={<span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>میانه {fa1(s.overall.median)}</span>} />
        <Kpi label="NPS — Q26" value={npsText} sub={<Delta value={delta(s.nps.score, base?.nps.score)} whole />} />
        <Kpi label="پاسخ نهایی" value={faInt(s.n)} sub={s.fast > 0 && <span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>{faInt(s.fast)} پاسخ زیر ۳۰ ثانیه (علامت‌خورده)</span>} />
        <Kpi label="بالاترین ایستگاه (Peak)" value={s.peak ? fa1(s.peak.mean) : '—'} sub={<span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>{s.peak?.text}</span>} />
        <Kpi label="پایین‌ترین ایستگاه (Friction)" value={s.friction ? fa1(s.friction.mean) : '—'} sub={<span className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>{s.friction?.text}</span>} />
      </div>
      <p className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>
        رویداد با لینک عمومی و گمنام اجرا می‌شود و دعوت‌نامهٔ شخصی ندارد؛ بنابراین «نرخ پاسخ» قابل محاسبه نیست و تعداد پاسخ نهایی نمایش داده می‌شود.
        {base && baselineTitle && ` تغییرها نسبت به «${baselineTitle}» (${faInt(base.n)} پاسخ) است.`}
      </p>

      {/* row 2: six indices */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {HP_DIMENSIONS.map((d) => {
          const v = s.dimensions[d.key];
          return (
            <div key={d.key} className={box} style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-grid)' }}>
              <div className="text-[12px] font-semibold" style={{ color: 'var(--viz-ink-2)' }}>{d.title}</div>
              <div className="text-[11px]" style={{ color: 'var(--viz-ink-3)' }} dir="ltr">{d.key} · {d.en}</div>
              <div className="text-2xl font-extrabold tabular-nums" dir="ltr">{fa1(v.score)}</div>
              <div className="text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>Top-2: {fa1(v.top2)}٪ · N {faInt(v.n)}</div>
              <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={reactionStatus(v.score)} /><Delta value={delta(v.score, base?.dimensions[d.key].score)} /></div>
            </div>
          );
        })}
      </div>
      {!printMode && (
        <div className="flex flex-wrap gap-2 no-print">
          <button type="button" disabled={png} onClick={() => exportPng('kpi')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink-2)' }}><ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />PNG کارت شاخص‌ها</button>
        </div>
      )}

      {/* row 3: journey */}
      <Card title="مسیر تجربه — میانگین امتیاز هر ایستگاه (۱ تا ۵)" hint="گزینهٔ «قابل ارزیابی نیست» از مخرج میانگین حذف می‌شود. این نمودار کیفیت ادراک‌شدهٔ ایستگاه‌ها را مقایسه می‌کند؛ اختلاف‌های جزئی را معنادار تلقی نکنید.">
        <div dangerouslySetInnerHTML={{ __html: journeySvg(s, SCREEN) }} />
        {!printMode && (
          <div className="no-print"><button type="button" disabled={png} onClick={() => exportPng('journey')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink-2)' }}><ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />PNG نمودار مسیر</button></div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-right border-separate" style={{ borderSpacing: 2 }}>
            <thead style={{ color: 'var(--viz-ink-3)' }}><tr><th className="px-2 py-1 font-medium">ایستگاه</th><th className="px-2 py-1 font-medium text-center">میانگین</th><th className="px-2 py-1 font-medium text-center">Top-2</th><th className="px-2 py-1 font-medium text-center">Bottom-2</th><th className="px-2 py-1 font-medium text-center">N معتبر</th><th className="px-2 py-1 font-medium text-center">N/A</th></tr></thead>
            <tbody>
              {s.journey.map((j, i) => (
                <tr key={j.id}>
                  <td className="px-2 py-1" style={{ color: 'var(--viz-ink-2)' }}><span className="font-semibold" style={{ color: 'var(--viz-ink)' }}>{toPersianDigits(i + 1)}.</span> {HP_JOURNEY[i].text}{s.peak?.id === j.id && <strong> · Peak</strong>}{s.friction?.id === j.id && <strong> · Friction</strong>}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-semibold rounded" style={heatStyle(((j.mean - 1) / 4) * 100)} dir="ltr">{fa1(j.mean)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(j.top2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(j.bottom2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums">{faInt(j.n)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" style={{ color: 'var(--viz-ink-3)' }}>{faInt(j.na)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* NPS */}
      <Card title="Net Promoter Score (Q26)" hint="Promoter ۹–۱۰ · Passive ۷–۸ · Detractor ۰–۶؛ NPS = درصد Promoter منهای درصد Detractor. N گروه‌ها در کنار درصد آمده است.">
        <div className="text-3xl font-extrabold tabular-nums" dir="ltr">{npsText}</div>
        <StackedBar parts={[{ label: `Promoter (${toPersianDigits(Math.round((s.nps.promoters * s.nps.n) / 100))})`, value: s.nps.promoters, color: 'var(--viz-top)' }, { label: `Passive (${toPersianDigits(Math.round((s.nps.passives * s.nps.n) / 100))})`, value: s.nps.passives, color: 'var(--viz-neutral)' }, { label: `Detractor (${toPersianDigits(Math.round((s.nps.detractors * s.nps.n) / 100))})`, value: s.nps.detractors, color: 'var(--viz-bottom)' }]} />
        <p className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>ارزش آینده (Q27): میانگین {fa1(s.future.mean)} از ۱۰</p>
      </Card>

      {/* distributions per index */}
      <Card title="توزیع پاسخ هر شاخص (Bottom-2 / خنثی / Top-2)">
        <div className="space-y-4">
          {HP_DIMENSIONS.map((d) => {
            const items = s.items.filter((i) => HP_LIKERT.find((q) => q.id === i.id)!.dim === d.key);
            const avg = (f: (i: (typeof items)[number]) => number) => items.reduce((a, i) => a + f(i), 0) / items.length;
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between mb-1"><span className="text-[13px] font-semibold">{d.title}</span><StatusBadge status={top2Status(avg((i) => i.top2))} /></div>
                <StackedBar parts={[{ label: 'Top-2', value: avg((i) => i.top2), color: 'var(--viz-top)' }, { label: 'خنثی', value: avg((i) => i.neutral), color: 'var(--viz-neutral)' }, { label: 'Bottom-2', value: avg((i) => i.bottom2), color: 'var(--viz-bottom)' }]} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* heatmap */}
      <Card title="ماتریس سؤال‌ها (Q01–Q24)" hint="رنگ شدت را نشان می‌دهد؛ عدد همیشه نوشته شده است. Mean، Median، SD، Valid N و Missing N برای هر سؤال.">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-right border-separate" style={{ borderSpacing: 2 }}>
            <thead style={{ color: 'var(--viz-ink-3)' }}>
              <tr>{['سؤال', 'میانگین', 'امتیاز ۰–۱۰۰', 'میانه', 'SD', 'Top-2', 'خنثی', 'Bottom-2', 'N', 'Missing'].map((h, i) => <th key={h} className={`px-2 py-1 font-medium ${i ? 'text-center' : ''}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-2 py-1" style={{ color: 'var(--viz-ink-2)' }}>{qLabel(i.id)}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-semibold rounded" style={heatStyle(i.score)} dir="ltr">{fa1(i.mean)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(i.score)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(i.median)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(i.sd)}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-semibold rounded" style={heatStyle(i.top2)} dir="ltr">{fa1(i.top2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(i.neutral)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{fa1(i.bottom2)}٪</td>
                  <td className="px-2 py-1 text-center tabular-nums">{faInt(i.n)}</td>
                  <td className="px-2 py-1 text-center tabular-nums" style={{ color: 'var(--viz-ink-3)' }}>{faInt(s.n - i.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* strengths and opportunities */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="نقاط قوت ادراک‌شده" hint="پنج سؤال با بالاترین Top-2 Box — صرفاً توصیفی."><BarList rows={sw.strengths.map((i) => ({ id: i.id, label: qLabel(i.id), value: i.top2 }))} labelWidth="min(15rem, 55%)" /></Card>
        <Card title="فرصت‌های بررسی" hint="پنج سؤال با پایین‌ترین Top-2 Box — صرفاً توصیفی."><BarList rows={sw.opportunities.map((i) => ({ id: i.id, label: qLabel(i.id), value: i.top2 }))} labelWidth="min(15rem, 55%)" /></Card>
      </div>

      {/* participants' voice */}
      {starred.length > 0 && (
        <Card title="منتخب‌های مدیریتی (★)" hint="پاسخ‌هایی که ادمین برای گزارش علامت زده است.">
          <ul className="space-y-2" role="list">{starred.map((x) => <li key={x.id} className="rounded-xl border p-3 text-[14px] leading-relaxed" style={{ borderColor: 'var(--viz-grid)' }}><span className="text-[11px]" style={{ color: 'var(--viz-ink-3)' }}>{x.q.label}</span><p className="whitespace-pre-wrap break-words">{x.text}</p></li>)}</ul>
        </Card>
      )}
      {!printMode && (
      <Card title="صدای شرکت‌کنندگان" hint="پاسخ‌های تشریحی بدون تحلیل خودکار؛ جست‌وجو، برچسب‌گذاری دستی و ★ برای گزارش.">
        <div className="flex flex-wrap items-center gap-2 no-print">
          {HP_OPEN.map((q) => (
            <button key={q.id} type="button" aria-pressed={openQ === q.id} onClick={() => { setOpenQ(q.id); setTagFilter(''); }} className="px-3 py-1 rounded-lg text-[12px] border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', background: openQ === q.id ? 'var(--viz-bar)' : 'transparent', color: openQ === q.id ? '#fff' : 'var(--viz-ink-2)' }}>
              {q.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] font-semibold">{HP_OPEN.find((q) => q.id === openQ)!.text}</p>
        {!printMode && (
          <div className="flex flex-wrap gap-2 no-print">
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--viz-ink-3)' }} aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در پاسخ‌ها" aria-label="جست‌وجو در پاسخ‌ها" className="w-full pr-9 pl-3 py-2 rounded-xl border text-[13px] bg-transparent" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }} />
            </div>
            {allTags.length > 0 && (
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="فیلتر برچسب" className="px-3 py-2 rounded-xl border text-[13px] bg-transparent" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }}>
                <option value="">همهٔ برچسب‌ها</option>{allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}
        <p className="text-[12px]" style={{ color: 'var(--viz-ink-3)' }}>{faInt(answersOf.length)} پاسخ</p>
        <ul className="space-y-2" role="list">
          {answersOf.map((r) => {
            const tags = r.tags[openQ] ?? [];
            const isStar = tags.includes(STAR);
            return (
              <li key={r.id} className="rounded-xl border p-3 text-[14px] leading-relaxed" style={{ borderColor: 'var(--viz-grid)' }}>
                <p className="whitespace-pre-wrap break-words">{String(r.answers[openQ])}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {tags.filter((t) => t !== STAR).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--viz-grid)', color: 'var(--viz-ink)' }}>
                      {t}
                      {!printMode && onSetTags && <button type="button" aria-label={`حذف برچسب ${t}`} className="cursor-pointer no-print" onClick={() => onSetTags(r.id, openQ, tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>}
                    </span>
                  ))}
                  {!printMode && onSetTags && (
                    <>
                      <button type="button" aria-pressed={isStar} aria-label="علامت منتخب" className="no-print inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border cursor-pointer" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink-2)' }} onClick={() => onSetTags(r.id, openQ, isStar ? tags.filter((x) => x !== STAR) : [...tags, STAR])}>
                        <Star className="w-3 h-3" fill={isStar ? 'currentColor' : 'none'} aria-hidden="true" />{isStar ? 'منتخب' : 'منتخب‌کردن'}
                      </button>
                      <input aria-label="افزودن برچسب" placeholder="+ برچسب" maxLength={30} className="no-print text-[11px] px-2 py-0.5 rounded-full border bg-transparent w-20" style={{ borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }}
                        onKeyDown={(e) => { const el = e.currentTarget; if (e.key === 'Enter' && el.value.trim()) { onSetTags(r.id, openQ, [...tags, el.value.trim()]); el.value = ''; } }} />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      )}
    </div>
  );
};
