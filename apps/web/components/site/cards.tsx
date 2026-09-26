import { caseStudyPath, type CaseStudyCard as CaseStudy, type Image, type TestimonialView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { byline } from '@/lib/text';
import { ArrowIcon } from '../ui/icons';
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
  // Unboxed cards need more air between rows than between columns.
  return <ul className={`grid gap-x-6 gap-y-12 lg:gap-x-8 lg:gap-y-14 ${COLUMNS[columns]} ${className}`}>{children}</ul>;
}

/**
 * A card that links to a page: services, industries, locations, company pages. The title
 * is the link, stretched over the card, so the card is one target with one accessible name.
 *
 * No box (RULES.md, rule 2): a photograph when there is one, a rule when there is not, which
 * draws champagne under the pointer. Hovering slowly pushes into the photograph, underlines
 * the title and steps the arrow of the link cue.
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
    <li
      className="group relative flex flex-col has-focus-visible:outline-2 has-focus-visible:outline-offset-8 has-focus-visible:outline-focus"
      {...reveal(step)}
    >
      {image ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
          <ResponsiveImage
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[1600ms] ease-out-quint motion-safe:group-hover:scale-105"
          />
        </div>
      ) : null}
      <div
        className={`relative flex flex-1 flex-col ${
          image
            ? 'pt-6'
            : 'border-t border-hairline pt-6 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-gold-ink before:transition-transform before:duration-500 before:ease-out-quint group-hover:before:scale-x-100'
        }`}
      >
        {eyebrow ? <p className="meta text-ink-muted uppercase">{eyebrow}</p> : null}
        <Heading className={`${eyebrow ? 'mt-3 ' : ''}heading-md text-ink`}>
          <a
            href={href}
            className="decoration-gold-ink decoration-2 underline-offset-[6px] after:absolute after:inset-0 focus-visible:outline-none group-hover:underline"
          >
            {title}
          </a>
        </Heading>
        {body ? <p className="body-base mt-3 text-ink-muted">{body}</p> : null}
        {meta ? <p className="meta mt-4 text-ink-muted">{meta}</p> : null}
        {linkLabel ? (
          <span className="button-label mt-auto flex items-center gap-2 pt-5 text-gold-ink" aria-hidden="true">
            {linkLabel}
            <ArrowIcon className="w-4 transition-transform duration-420 ease-out-quint motion-safe:group-hover:translate-x-1.5" />
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
    // The homepage's case study form: no box, the photograph slowly zooming and the client's
    // name taking an arrow on hover, the tags one dotted line of meta.
    <li
      className="group relative flex flex-col has-focus-visible:outline-2 has-focus-visible:outline-offset-8 has-focus-visible:outline-focus"
      {...reveal(step)}
    >
      {study.image ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
          <ResponsiveImage
            src={study.image.src}
            alt={study.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[1600ms] ease-out-quint motion-safe:group-hover:scale-105"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col pt-6">
        {study.tags.length > 0 ? (
          <ul className="meta flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-muted uppercase">
            {study.tags.map((tag, index) => (
              <li key={tag} className="flex items-center gap-2.5">
                {index > 0 ? <span aria-hidden className="h-1 w-1 bg-hairline-strong" /> : null}
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <Heading className="heading-lg mt-3 flex items-center justify-between gap-4 text-ink">
          {study.clientName}
          <ArrowIcon className="w-5 shrink-0 text-ink-muted transition duration-420 ease-out-quint group-hover:text-ink motion-safe:group-hover:translate-x-1.5" />
        </Heading>
        <p className="body-base mt-2.5 text-ink-muted">{study.summary}</p>
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
          className="button-label mt-auto self-start pt-6 text-gold-ink after:absolute after:inset-0 focus-visible:outline-none"
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
