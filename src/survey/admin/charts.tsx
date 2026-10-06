import React from 'react';
import { toPersianDigits } from '@/core/utils/number';
import { ReactionStatus, REACTION_STATUS, round1 } from '../../../shared/reaction/metrics';
import { AlertTriangle, CheckCircle2, Info, TrendingDown } from 'lucide-react';
import './viz.css';

/** Plain HTML/CSS chart pieces for the reaction dashboard (no chart library; each is also readable as text). */

export const fa1 = (x: number): string => (Number.isFinite(x) ? toPersianDigits(round1(x).toFixed(1).replace(/\.0$/, '')) : '—');
export const faInt = (x: number): string => (Number.isFinite(x) ? toPersianDigits(Math.round(x)) : '—');

const STATUS_STYLE: Record<ReactionStatus, { color: string; icon: React.ReactNode }> = {
  excellent: { color: 'var(--viz-good)', icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> },
  good: { color: 'var(--viz-bar)', icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> },
  attention: { color: 'var(--viz-warn)', icon: <Info className="w-3.5 h-3.5" aria-hidden="true" /> },
  improve: { color: 'var(--viz-critical)', icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> },
};

/** Status is always an icon + a word, never colour alone. */
export const StatusBadge: React.FC<{ status: ReactionStatus }> = ({ status }) => {
  const meta = REACTION_STATUS.find((s) => s.status === status)!;
  const style = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--viz-ink)' }}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: style.color, color: status === 'attention' ? '#0b0b0b' : '#fff' }}>{style.icon}</span>
      {meta.label}
    </span>
  );
};

/** A change since the compared event: arrow and signed number, in ink colour (the arrow carries direction). */
export const Delta: React.FC<{ value: number; suffix?: string; whole?: boolean }> = ({ value, suffix = '', whole = false }) => {
  if (!Number.isFinite(value)) return null;
  const v = whole ? Math.round(value) : round1(value);
  const up = v > 0;
  return (
    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--viz-ink-2)' }} dir="ltr">
      {v === 0 ? '＝' : up ? '▲' : <TrendingDown className="w-3 h-3" aria-hidden="true" />}
      {v === 0 ? '' : (up ? '+' : '−') + toPersianDigits(Math.abs(v)) }{suffix}
    </span>
  );
};

/** Horizontal bars of one measure (0–100), sorted by the caller. Value labels sit at the bar ends. */
export const BarList: React.FC<{ rows: { id: string; label: string; value: number }[]; max?: number; unit?: string; labelWidth?: string }> = ({ rows, max = 100, unit = '٪', labelWidth = '11rem' }) => (
  <ul className="space-y-2" role="list">
    {rows.map((r) => (
      <li key={r.id} className="flex items-center gap-3 text-[13px]">
        <span className="shrink-0 truncate" style={{ width: labelWidth, color: 'var(--viz-ink-2)' }} title={r.label}>{r.label}</span>
        <span className="relative flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--viz-grid)' }} aria-hidden="true">
          <span className="absolute inset-y-0 right-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (r.value / max) * 100))}%`, background: 'var(--viz-bar)' }} />
        </span>
        <span className="w-14 shrink-0 text-left tabular-nums font-semibold" style={{ color: 'var(--viz-ink)' }} dir="ltr">{fa1(r.value)}{unit}</span>
      </li>
    ))}
  </ul>
);

/** One 100 % bar split in three (low / middle / high) with a 2 px gap between fills and labelled segments. */
export const StackedBar: React.FC<{ parts: { label: string; value: number; color: string }[]; height?: number }> = ({ parts, height = 14 }) => (
  <div>
    <div className="flex w-full overflow-hidden rounded-full" style={{ height, gap: 2, background: 'var(--viz-surface)' }} role="img" aria-label={parts.map((p) => `${p.label} ${fa1(p.value)}٪`).join('، ')}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.label} style={{ width: `${p.value}%`, background: p.color }} />
      ))}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5" role="list">
      {parts.map((p) => (
        <li key={p.label} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--viz-ink-2)' }}>
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
          {p.label} <strong className="tabular-nums" style={{ color: 'var(--viz-ink)' }}>{fa1(p.value)}٪</strong>
        </li>
      ))}
    </ul>
  </div>
);

/** Vertical columns for a 0–10 distribution. */
export const Histogram: React.FC<{ counts: number[]; labels: string[] }> = ({ counts, labels }) => {
  const max = Math.max(1, ...counts);
  return (
    <div role="img" aria-label={counts.map((c, i) => `${labels[i]}: ${c}`).join('، ')}>
      <div className="flex items-end gap-1.5 h-32">
        {counts.map((c, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] tabular-nums mb-0.5" style={{ color: 'var(--viz-ink-2)' }}>{c > 0 ? faInt(c) : ''}</span>
            <span className="w-full rounded-t-md" style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 3 : 0, background: 'var(--viz-bar)' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center text-[11px]" style={{ color: 'var(--viz-ink-3)' }}>{l}</span>)}
      </div>
    </div>
  );
};

/** A heatmap cell: intensity is a mix of the bar blue into the surface, the number always printed on top. */
export const heatStyle = (pct: number): React.CSSProperties => {
  const t = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const mix = Math.round(8 + (t / 100) * 78);
  return { background: `color-mix(in srgb, var(--viz-bar) ${mix}%, var(--viz-surface))`, color: mix > 66 ? '#ffffff' : 'var(--viz-ink)' };
};

export const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode; className?: string }> = ({ title, hint, children, className = '' }) => (
  <section className={`viz-card rounded-2xl border p-4 sm:p-5 space-y-3 ${className}`} style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-grid)', color: 'var(--viz-ink)' }}>
    <header>
      <h3 className="text-sm font-bold" style={{ color: 'var(--viz-ink)' }}>{title}</h3>
      {hint && <p className="text-[12px] mt-0.5" style={{ color: 'var(--viz-ink-3)' }}>{hint}</p>}
    </header>
    {children}
  </section>
);
