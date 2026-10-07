import { round1, roundNps } from '../../../shared/reaction/metrics';
import { HP_DIMENSIONS } from '../../../shared/hampayam/questions';
import type { HpSummary } from '../../../shared/hampayam/metrics';

/** SVG builders for the Journey chart and the headline KPI card: shown on screen and exported as PNG. */

export interface Palette {
  bg: string;
  ink: string;
  ink2: string;
  grid: string;
  bar: string;
  good: string;
  bad: string;
}
export const SCREEN: Palette = { bg: 'transparent', ink: 'var(--viz-ink)', ink2: 'var(--viz-ink-2)', grid: 'var(--viz-grid)', bar: 'var(--viz-bar)', good: 'var(--viz-good)', bad: 'var(--viz-critical)' };
export const LIGHT: Palette = { bg: '#ffffff', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', bar: '#2a78d6', good: '#0ca30c', bad: '#d03b3b' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const f1 = (x: number) => (Number.isFinite(x) ? fa(round1(x).toFixed(1).replace(/\.0$/, '')) : '—');

/** Ten stations in time order on a 1–5 line; the peak is marked green, the friction point red (always with a label). */
export function journeySvg(s: HpSummary, p: Palette, w = 760, h = 330): string {
  const padL = 36, padR = 16, padT = 28, padB = 62;
  const iw = w - padL - padR, ih = h - padT - padB;
  const n = s.journey.length;
  // RTL: station 1 on the right
  const x = (i: number) => padL + iw - (iw * i) / (n - 1);
  const y = (v: number) => padT + ih - ((v - 1) / 4) * ih;
  const pts = s.journey.map((j, i) => (j.n > 0 ? { i, x: x(i), y: y(j.mean), j } : null));
  const line = pts.filter(Boolean).map((q, k) => `${k ? 'L' : 'M'}${q!.x.toFixed(1)},${q!.y.toFixed(1)}`).join(' ');
  const grid = [1, 2, 3, 4, 5].map((v) => `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}" stroke="${p.grid}"/><text x="${padL - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="${p.ink2}">${fa(v)}</text>`).join('');
  const dots = pts
    .map((q) => {
      if (!q) return '';
      const mark = s.peak?.id === q.j.id ? p.good : s.friction?.id === q.j.id ? p.bad : p.bar;
      const tag = s.peak?.id === q.j.id ? 'Peak' : s.friction?.id === q.j.id ? 'Friction' : '';
      return `<circle cx="${q.x}" cy="${q.y}" r="${tag ? 6 : 4.5}" fill="${mark}" stroke="${p.bg === 'transparent' ? 'var(--viz-surface)' : p.bg}" stroke-width="2"/><text x="${q.x}" y="${q.y - 11}" font-size="11" font-weight="700" text-anchor="middle" fill="${p.ink}">${f1(q.j.mean)}</text>${tag ? `<text x="${q.x}" y="${q.y + 20}" font-size="10" text-anchor="middle" fill="${mark}" font-weight="700">${tag}</text>` : ''}`;
    })
    .join('');
  const labels = s.journey.map((j, i) => `<text x="${x(i)}" y="${h - padB + 18}" font-size="11" text-anchor="middle" fill="${p.ink2}">${fa(i + 1)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc('میانگین امتیاز هر ایستگاه مسیر تجربه')}" style="max-width:100%;height:auto" font-family="Vazirmatn, Tahoma, sans-serif">
<rect width="${w}" height="${h}" fill="${p.bg}"/>${grid}<path d="${line}" fill="none" stroke="${p.bar}" stroke-width="2.5"/>${dots}${labels}
<text x="${w / 2}" y="${h - 8}" font-size="11" text-anchor="middle" fill="${p.ink2}">${esc('شماره ایستگاه (به ترتیب زمان)')}</text></svg>`;
}

/** The six indices and headline numbers as one image card for presentations. */
export function kpiCardSvg(s: HpSummary, title: string, p: Palette = LIGHT, w = 900, h = 520): string {
  const nps = Number.isFinite(s.nps.score) ? `${roundNps(s.nps.score) > 0 ? '+' : ''}${fa(roundNps(s.nps.score))}` : '—';
  const head = [['Experience Index', f1(s.experienceIndex)], ['Overall (۰–۱۰)', f1(s.overall.mean)], ['NPS', nps], [`${'N'}`, fa(s.n)]];
  const tiles = head.map(([l, v], i) => `<g transform="translate(${w - 40 - (i + 1) * 205 + 15},96)"><rect width="190" height="96" rx="12" fill="none" stroke="${p.grid}"/><text x="95" y="34" font-size="13" text-anchor="middle" fill="${p.ink2}">${esc(l)}</text><text x="95" y="76" font-size="34" font-weight="800" text-anchor="middle" fill="${p.ink}">${v}</text></g>`).join('');
  const bars = HP_DIMENSIONS.map((d, i) => {
    const v = s.dimensions[d.key].score;
    const yy = 240 + i * 42;
    const bw = 460;
    return `<text x="${w - 40}" y="${yy + 14}" font-size="14" text-anchor="end" fill="${p.ink}">${esc(d.key + ' · ' + d.title)}</text><rect x="${w - 40 - 230 - bw}" y="${yy}" width="${bw}" height="16" rx="8" fill="${p.grid}"/><rect x="${w - 40 - 230 - (Number.isFinite(v) ? (bw * v) / 100 : 0)}" y="${yy}" width="${Number.isFinite(v) ? (bw * v) / 100 : 0}" height="16" rx="8" fill="${p.bar}"/><text x="${w - 40 - 230 - bw - 10}" y="${yy + 14}" font-size="14" font-weight="700" text-anchor="end" fill="${p.ink}">${f1(v)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Vazirmatn, Tahoma, sans-serif"><rect width="${w}" height="${h}" fill="${p.bg}"/><text x="${w - 40}" y="52" font-size="24" font-weight="800" text-anchor="end" fill="${p.ink}">${esc(title)}</text>${tiles}${bars}</svg>`;
}

/** Rasterises an SVG string to a PNG blob (2× for sharpness). */
export function svgToPng(svg: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h * 2;
      const ctx = c.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg'));
    };
    img.src = url;
  });
}
