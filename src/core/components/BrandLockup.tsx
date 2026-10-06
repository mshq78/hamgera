import React from 'react';
import { CORE } from '../content/ui.fa';

interface BrandLockupProps {
  /** Name of the test being taken; shown after the platform name. */
  testTitle?: string | null;
  compact?: boolean;
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ testTitle, compact = false, className = '' }) => (
  <a href="#/" className={`flex items-center gap-3 select-none no-underline ${className}`} aria-label={CORE.brand.name}>
    <img src="/logo.svg" alt="" aria-hidden="true" className={`shrink-0 object-contain ${compact ? 'w-9 h-9' : 'w-11 h-11'}`} />
    <div className="flex flex-col text-right">
      <span className={`font-extrabold tracking-tight text-slate-900 dark:text-amber-100 leading-tight ${compact ? 'text-sm' : 'text-base'}`}>
        {CORE.brand.name}
        {testTitle && <span className="font-medium text-slate-500 dark:text-slate-400"> · {testTitle}</span>}
      </span>
      {!compact && !testTitle && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{CORE.brand.tagline}</span>
      )}
    </div>
  </a>
);
