import type { Link, TimedStep } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CheckIcon } from '../ui/icons';
import { CheckBullet, reveal } from '../ui/primitives';
import type { Ground } from './section';

/**
 * Shown in place of a list while no records are published, so index pages and linked
 * sections still render against the placeholder database. Say what will appear and, where
 * useful, where to go instead.
 */
export function EmptyState({
  children,
  action,
  ground = 'light',
  className = '',
}: {
  children: string;
  action?: Link | null;
  ground?: Ground;
  className?: string;
}) {
  const dark = ground === 'dark';
  return (
    <div
      className={` border border-dashed px-6 py-10 text-center text-[15px] ${dark ? 'border-ink-invert/15 text-ink-invert-muted' : 'border-hairline bg-canvas-raised text-ink-muted'} ${className}`}
    >
      <p>{children}</p>
      {action ? (
        <a
          href={action.href}
          className={`mt-4 inline-block py-1 font-semibold ${dark ? 'text-ink-invert underline underline-offset-4' : 'text-gold-ink hover:text-gold-600'}`}
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

/** Deliverables and inclusions with affirmative check marks. */
export function CheckList({
  items,
  ground = 'light',
  columns = 1,
}: {
  items: readonly string[];
  ground?: Ground;
  columns?: 1 | 2;
}) {
  if (items.length === 0) return null;
  const layout = `grid gap-x-10 gap-y-4 text-[16px] ${columns === 2 ? 'sm:grid-cols-2' : ''}`;
  if (ground === 'dark') {
    return (
      <ul className={layout}>
        {items.map((item) => (
          <CheckBullet key={item}>{item}</CheckBullet>
        ))}
      </ul>
    );
  }
  return (
    <ul className={layout}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3.5 text-ink">
          <span
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-ink/15 text-gold-ink"
            aria-hidden="true"
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const STEP_COLUMNS: Record<number, string> = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

/** Process steps with how long each takes, in order. */
export function StepList({ steps, ground = 'light' }: { steps: readonly TimedStep[]; ground?: Ground }) {
  if (steps.length === 0) return null;
  const dark = ground === 'dark';
  return (
    <ol className={`grid gap-6 md:grid-cols-2 ${STEP_COLUMNS[steps.length] ?? 'lg:grid-cols-3'}`}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className={`border-t-2 pt-5 ${index === 0 ? (dark ? 'border-white' : 'border-ink') : dark ? 'border-ink-invert/15' : 'border-hairline'}`}
          {...reveal(index)}
        >
          <p className={`font-display text-[15px] font-extrabold ${dark ? '' : 'text-ink'}`}>{`Step ${String(index + 1)}`}</p>
          <h3 className={`mt-1.5 font-display text-[19px] font-bold ${dark ? '' : 'text-ink'}`}>{step.title}</h3>
          <p className={`mt-2.5 text-[15px] leading-relaxed ${dark ? 'text-ink-invert-muted' : ''}`}>{step.body}</p>
          <p className={`mt-3 text-[13.5px] font-medium ${dark ? 'text-ink-invert-muted' : ''}`}>{step.duration}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Long-form copy such as the legal pages: headings, paragraphs, lists and links styled from
 * the parent, at a readable measure.
 */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`max-w-[72ch] text-[17px] leading-relaxed [&_a]:font-semibold [&_a]:text-gold-ink [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-gold-600 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-[28px] [&_h2]:leading-tight [&_h2]:font-extrabold [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&>:first-child]:mt-0 ${className}`}
    >
      {children}
    </div>
  );
}
