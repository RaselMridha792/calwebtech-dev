import type { Link } from '@calwebtech/shared';

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

/** "Role, Company" when either is known. */
export function byline(role: string | null, company: string | null): string {
  return [role, company].filter((part): part is string => Boolean(part)).join(', ');
}
