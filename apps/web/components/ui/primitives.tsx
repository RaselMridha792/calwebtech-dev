import type { CSSProperties, ReactNode } from 'react';
import { CheckIcon } from './icons';

/** Glass pill with a status dot, used above hero and section headings on dark ground. */
export function PillBadge({ children }: { children: ReactNode }) {
  return (
    <p className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-result" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Check bullet on dark ground. */
export function CheckBullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-result/20 text-result"
        aria-hidden="true"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Star glyphs for a rating. Pass `announce={false}` when the figure is already
 * written out beside the stars.
 */
export function Stars({
  rating,
  className = '',
  announce = true,
}: {
  rating: number;
  className?: string;
  announce?: boolean;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <>
      <span className={`text-star ${className}`} aria-hidden="true">
        {'★'.repeat(filled)}
      </span>
      {announce ? <span className="sr-only">{`Rated ${rating} out of 5`}</span> : null}
    </>
  );
}

/**
 * Props that opt an element into the scroll reveal. `step` staggers siblings in
 * groups of four, matching the approved landing page.
 */
export function reveal(step = 0): { 'data-reveal': ''; style: CSSProperties } {
  return { 'data-reveal': '', style: { '--reveal-step': step % 4 } as CSSProperties };
}
