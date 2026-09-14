import type { Link } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { reveal } from '../ui/primitives';

export const h2Dark = 'font-display text-[34px] leading-[1.1] font-extrabold text-ink lg:text-[42px]';
export const h2Light = 'font-display text-[34px] leading-[1.1] font-extrabold lg:text-[42px]';

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
  const colours = tone === 'dark' ? 'border-white/25 text-white/75' : 'border-line bg-white text-body';
  return (
    <p className={`rounded-2xl border border-dashed px-6 py-10 text-center text-[15px] ${colours} ${className}`}>
      {children}
    </p>
  );
}

export function TextLink({ link, className = '' }: { link: Link; className?: string }) {
  return (
    <a href={link.href} className={`font-semibold text-primary hover:text-primaryd ${className}`}>
      {link.label}
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
