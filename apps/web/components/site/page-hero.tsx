import type { DecorativeImage, Link } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import type { Crumb } from '@/lib/seo/json-ld';
import { BackdropImage } from '../ui/brand';
import { PillBadge } from '../ui/primitives';
import { AnswerBlock } from './answer-block';
import { Breadcrumbs } from './breadcrumbs';
import type { Ground } from './section';

export interface PageHeroProps {
  /** After Home; the last crumb is this page. */
  crumbs: readonly Crumb[];
  /** The page's only H1. */
  title: string;
  /** Rendered straight under the H1, before the intro and calls to action. */
  answer?: string | null;
  /** A short label above the H1, such as "Service". */
  eyebrow?: string | null;
  intro?: string | null;
  primaryCta?: Link | null;
  secondaryCta?: Link | null;
  /** A decorative photograph under the dark hero's overlays; preloaded as the LCP image. */
  backdrop?: DecorativeImage | null;
  /** The right-hand column from the large breakpoint: an image, a form, a figure card. */
  aside?: ReactNode;
  /** Under the calls to action, such as a starting price band. */
  children?: ReactNode;
  ground?: Ground;
}

/**
 * The top of every site page: breadcrumbs, the H1, the answer block, then the promotional
 * part. Dark is the homepage's ink hero; light is the tinted gradient for utility and legal
 * pages. Never deferred, because it holds the LCP element.
 */
export function PageHero({
  crumbs,
  title,
  answer,
  eyebrow,
  intro,
  primaryCta,
  secondaryCta,
  backdrop = null,
  aside,
  children,
  ground = 'dark',
}: PageHeroProps) {
  const dark = ground === 'dark';
  return (
    <section
      data-hero={dark ? 'dark' : 'light'}
      className={`relative overflow-hidden ${dark ? 'bg-navy-900 text-ink-invert' : 'border-b border-hairline bg-canvas'}`}
    >
      {dark ? (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <BackdropImage image={backdrop} className="kenburns opacity-[.24]" priority />
          <div className="absolute inset-0 bg-linear-to-r from-navy-900 via-navy-900/95 to-navy-900/70" />
          <div className="absolute inset-0 bg-linear-to-t from-navy-900 via-transparent to-navy-900/60" />
        </div>
      ) : (
        <div className="absolute inset-0" aria-hidden="true">
        </div>
      )}

      <div className="shell relative grid items-center gap-12 pt-8 pb-16 lg:grid-cols-12 lg:gap-16 lg:pt-10 lg:pb-24">
        <div className={aside ? 'lg:col-span-7' : 'lg:col-span-10'}>
          <Breadcrumbs crumbs={crumbs} ground={ground} />
          {eyebrow ? (
            <div className="mt-8">
              {dark ? <PillBadge>{eyebrow}</PillBadge> : <p className="text-[14px] font-semibold text-gold-ink">{eyebrow}</p>}
            </div>
          ) : null}
          <h1
            className={`${eyebrow ? 'mt-5' : 'mt-8'} font-display text-[38px] leading-[1.05] font-extrabold sm:text-[50px] xl:text-[58px] ${dark ? '' : 'text-ink'}`}
          >
            {title}
          </h1>
          {answer ? (
            <AnswerBlock ground={ground} className="mt-7">
              {answer}
            </AnswerBlock>
          ) : null}
          {intro ? (
            <p className={`mt-6 max-w-[58ch] text-[18px] leading-relaxed ${dark ? 'text-ink-invert-muted' : ''}`}>{intro}</p>
          ) : null}
          {primaryCta || secondaryCta ? (
            <div className="mt-9 flex flex-wrap gap-3">
              {primaryCta ? (
                <a
                  href={primaryCta.href}
                  className="inline-flex h-14 items-center bg-navy-900 px-7 text-[16px] font-semibold text-ink-invert  hover:bg-navy-700"
                >
                  {primaryCta.label}
                </a>
              ) : null}
              {secondaryCta ? (
                <a
                  href={secondaryCta.href}
                  className={
                    dark
                      ? 'glass inline-flex h-14 items-center  px-7 text-[16px] font-semibold text-ink-invert hover:bg-navy-900-invert/15'
                      : 'inline-flex h-14 items-center  border border-hairline bg-canvas-raised px-7 text-[16px] font-semibold text-ink hover:border-ink'
                  }
                >
                  {secondaryCta.label}
                </a>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
        {aside ? <div className="lg:col-span-5">{aside}</div> : null}
      </div>
    </section>
  );
}
