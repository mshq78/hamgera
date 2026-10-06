import React, { useEffect, useRef, useState } from 'react';
import { toPersianDigits } from '../utils/number';
import { CORE } from '../content/ui.fa';

interface Props {
  /** ISO instant to count down to. */
  target: string;
  clockOffsetMs: number;
  /** Called once when the countdown reaches zero. */
  onElapsed?: () => void;
  className?: string;
}

const two = (n: number) => String(n).padStart(2, '0');

/** «۲ روز و ۰۳:۱۴:۰۵» — ticks every second against server time. */
export const Countdown: React.FC<Props> = ({ target, clockOffsetMs, onElapsed, className = '' }) => {
  const targetMs = Date.parse(target);
  const remaining = () => Math.max(0, targetMs - (Date.now() + clockOffsetMs));
  const [left, setLeft] = useState(remaining);
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    setLeft(remaining());
    const id = window.setInterval(() => {
      const r = remaining();
      setLeft(r);
      if (r === 0 && !fired.current) {
        fired.current = true;
        onElapsed?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, clockOffsetMs]);

  const total = Math.floor(left / 1000);
  const days = Math.floor(total / 86400);
  const clock = `${two(Math.floor((total % 86400) / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
  return (
    <span dir="ltr" className={`tabular-nums ${className}`} aria-label={CORE.hub.startsIn}>
      {days > 0 ? `${toPersianDigits(days)} ${CORE.hub.days} · ` : ''}
      {toPersianDigits(clock)}
    </span>
  );
};
