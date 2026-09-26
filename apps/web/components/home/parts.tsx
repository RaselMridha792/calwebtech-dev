import type { Link } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { ArrowIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';

/** A section opener on cream, and the same on a dark ground. One display size per section. */
export const h2Dark = 'display-lg text-ink';
export const h2Light = 'display-lg text-ink-invert';

/**
 * Shown in place of a section's records while none are published. The section itself
 * still renders, so every navigation anchor that points at it lands.
 */
export function EmptyNote({
  children,
  tone = 'light',
  className = 'mt-10',
}: {
  children: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  // A rule, not a dashed box: the brand separates with lines and never rings a group.
  const colours = tone === 'dark' ? 'border-ink-invert/25 text-ink-invert-muted' : 'border-hairline text-ink-muted';
  return <p className={`body-base border-t py-10 text-center ${colours} ${className}`}>{children}</p>;
}

/**
 * The brand's link form: a label and an arrow that travels 6px, over a rule that grows
 * from the left. This is what replaces the "read more" that used to sit inside a card.
 */
export function TextLink({
  link,
  tone = 'light',
  className = '',
}: {
  link: Link;
  /** The ground it sits on. Champagne is unreadable on cream, so each has its own. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const colour = tone === 'dark' ? 'text-gold-500 after:bg-gold-500' : 'text-gold-ink after:bg-gold-ink';
  return (
    <a
      href={link.href}
      className={`button-label group relative inline-flex items-center gap-2 pb-1.5 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:transition-transform after:duration-[420ms] after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:after:scale-x-100 motion-reduce:after:transition-none ${colour} ${className}`}
    >
      {link.label}
      <ArrowIcon className="w-4 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:translate-x-1.5" />
    </a>
  );
}

/**
 * The brand's filled action: its label in the button face, and an arrow that steps 4px on
 * hover. `navy` is for cream grounds; `cream` is the same action on a dark one.
 */
export function ActionLink({
  link,
  tone = 'navy',
  size = 'md',
  className = '',
}: {
  link: Link;
  tone?: 'navy' | 'cream';
  /** `lg` for an action that closes a band on its own. */
  size?: 'md' | 'lg';
  className?: string;
}) {
  const colours =
    tone === 'navy'
      ? 'bg-navy-900 text-ink-invert hover:bg-navy-700 focus-visible:outline-focus'
      : 'bg-canvas-raised text-ink hover:bg-canvas-sunken focus-visible:outline-focus-invert';
  return (
    <a
      href={link.href}
      className={`group/action button-label inline-flex items-center gap-3 transition-colors ${size === 'lg' ? 'h-14 px-7' : 'h-12 px-6'} duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${colours} ${className}`}
    >
      {link.label}
      <ArrowIcon className="w-4 transition-transform duration-420 ease-out-quint motion-safe:group-hover/action:translate-x-1" />
    </a>
  );
}

/** A section's heading block, with its "see all" link at the right when one is set. */
export function SectionHead({
  link,
  className = '',
  children,
}: {
  link: Link | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-6 ${className}`} {...reveal()}>
      <div>{children}</div>
      {link ? <TextLink link={link} /> : null}
    </div>
  );
}

export { asPhrase, byline } from '@/lib/text';
