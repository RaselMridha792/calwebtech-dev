'use client';

import { useEffect, useRef } from 'react';

const DURATION_MS = 1100;

/**
 * Counts from zero to `value` the first time it is on screen. The server renders
 * the final figure, so the number is correct without script and for crawlers.
 */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const decimals = Number.isInteger(value) ? 0 : (String(value).split('.')[1]?.length ?? 0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          const eased = 1 - (1 - progress) ** 3;
          element.textContent = `${(value * eased).toFixed(decimals)}${suffix}`;
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${value}${suffix}`}
    </span>
  );
}
