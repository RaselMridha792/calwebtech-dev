import { caseStudyPath, type CaseStudyCard as CaseStudy, type Image, type TestimonialView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { byline } from '@/lib/text';
import { Stars, reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import type { Ground } from './section';

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
} as const;

/** A responsive list of cards. Children are `<li>` cards from this file. */
export function CardGrid({
  columns = 3,
  className = '',
  children,
}: {
  columns?: keyof typeof COLUMNS;
  className?: string;
  children: ReactNode;
}) {
  return <ul className={`grid gap-5 lg:gap-6 ${COLUMNS[columns]} ${className}`}>{children}</ul>;
}

/**
 * A card that links to a page: services, industries, locations, company pages. The title
 * is the link, stretched over the card, so the card is one target with one accessible name.
 */
export function LinkCard({
  href,
  title,
  body,
  eyebrow,
  image,
  meta,
  linkLabel,
  level = 3,
  step = 0,
}: {
  href: string;
  title: string;
  body?: string | null;
  eyebrow?: string | null;
  image?: Image | null;
  meta?: string | null;
  /** A visual cue such as "See the service"; the title already names the link. */
  linkLabel?: string | null;
  level?: 2 | 3;
  /** Position in the grid, for the staggered reveal. */
  step?: number;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <li className="lift relative flex flex-col overflow-hidden border border-hairline bg-canvas-raised" {...reveal(step)}>
      {image ? (
        <div className="relative aspect-video bg-canvas-sunken">
          <ResponsiveImage
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-7">
        {eyebrow ? <p className="text-[13px] font-medium">{eyebrow}</p> : null}
        <Heading className={`${eyebrow ? 'mt-1.5 ' : ''}font-display text-[20px] leading-snug font-bold text-ink`}>
          <a href={href} className="after:absolute after:inset-0 hover:text-gold-ink">
            {title}
          </a>
        </Heading>
        {body ? <p className="mt-2.5 text-[15px] leading-relaxed">{body}</p> : null}
        {meta ? <p className="mt-4 text-[13.5px]">{meta}</p> : null}
        {linkLabel ? (
          <span className="mt-auto pt-5 font-semibold text-gold-ink" aria-hidden="true">
            {linkLabel}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** A case study card: cover image, tags, client, one-line summary and up to three figures. */
export function CaseStudyCard({
  study,
  linkLabel = 'Read the case study',
  level = 3,
  step = 0,
}: {
  study: CaseStudy;
  linkLabel?: string;
  level?: 2 | 3;
  step?: number;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <li className="lift relative flex flex-col overflow-hidden border border-hairline bg-canvas-raised" {...reveal(step)}>
      {study.image ? (
        <div className="relative aspect-video bg-canvas-sunken">
          <ResponsiveImage
            src={study.image.src}
            alt={study.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-7">
        {study.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-[12.5px] font-medium">
            {study.tags.map((tag) => (
              <li key={tag} className="bg-canvas-sunken px-2.5 py-1 text-ink">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <Heading className="mt-4 font-display text-[23px] font-extrabold text-ink">{study.clientName}</Heading>
        <p className="mt-2.5 text-[15px] leading-relaxed">{study.summary}</p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-hairline pt-5">
          {study.metrics.slice(0, 3).map((metric) => (
            <div key={metric.label} className="flex flex-col-reverse justify-end">
              <dt className="mt-1.5 text-[12.5px]">{metric.label}</dt>
              <dd className="font-display text-[22px] leading-none font-extrabold whitespace-nowrap text-gold-ink sm:text-[26px]">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        <a
          href={caseStudyPath(study.slug)}
          className="mt-auto self-start pt-6 font-semibold text-gold-ink after:absolute after:inset-0 hover:text-gold-600"
        >
          {linkLabel}
          <span className="sr-only">{`: ${study.clientName}`}</span>
        </a>
      </div>
    </li>
  );
}

/** A client quote with name, role and company, on a light or dark ground. */
export function TestimonialCard({
  testimonial,
  ground = 'light',
  showRating = false,
}: {
  testimonial: TestimonialView;
  ground?: Ground;
  showRating?: boolean;
}) {
  const dark = ground === 'dark';
  const who = byline(testimonial.role, testimonial.company);
  return (
    <figure className={`flex h-full flex-col  p-7 ${dark ? 'glass' : 'border border-hairline bg-canvas-raised'}`}>
      {showRating ? <Stars rating={testimonial.rating} className="mb-4 text-[15px]" /> : null}
      <blockquote className={`flex-1 text-[16px] leading-relaxed ${dark ? '' : 'text-ink'}`}>
        {`"${testimonial.quote}"`}
      </blockquote>
      <figcaption className={`mt-6 flex items-center gap-3 border-t pt-5 ${dark ? 'border-ink-invert/15' : 'border-hairline'}`}>
        {testimonial.avatar ? (
          <ResponsiveImage
            src={testimonial.avatar.src}
            alt=""
            width={44}
            height={44}
            sizes="44px"
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : null}
        <span className="text-[14px]">
          <b className={`block ${dark ? '' : 'text-ink'}`}>{testimonial.clientName}</b>
          {who ? <span className={dark ? 'text-ink-invert-muted' : ''}>{who}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}
