import type { Link } from '@calwebtech/shared';
import { reveal } from '../ui/primitives';
import type { Ground } from './section';

/**
 * A section's heading, optional introduction and "see all" link, in the homepage's type
 * scale. On content pages write `title` as the question a buyer types (CLAUDE.md, SEO).
 */
export function SectionHeading({
  id,
  title,
  intro,
  link,
  ground = 'light',
  level = 2,
  size = 'large',
  className = 'mb-12',
}: {
  /** Set it and pass the same id as the section's `labelledBy`. */
  id?: string;
  title: string;
  intro?: string | null;
  link?: Link | null;
  ground?: Ground;
  level?: 2 | 3;
  size?: 'large' | 'medium';
  className?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const dark = ground === 'dark';
  const scale = size === 'large' ? 'text-[34px] lg:text-[42px]' : 'text-[26px] lg:text-[32px]';
  return (
    <div className={`flex flex-wrap items-end justify-between gap-6 ${className}`} {...reveal()}>
      <div className="max-w-[64ch]">
        <Heading
          id={id}
          className={`max-w-[24ch] font-display leading-[1.1] font-extrabold ${scale} ${dark ? '' : 'text-ink'}`}
        >
          {title}
        </Heading>
        {intro ? (
          <p className={`mt-4 text-[17px] leading-relaxed ${dark ? 'text-white/75' : ''}`}>{intro}</p>
        ) : null}
      </div>
      {link ? (
        <a
          href={link.href}
          className={
            dark
              ? 'inline-block py-1 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white'
              : 'inline-block py-1 font-semibold text-primary hover:text-primaryd'
          }
        >
          {link.label}
        </a>
      ) : null}
    </div>
  );
}
