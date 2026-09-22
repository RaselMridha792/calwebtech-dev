import type { DecorativeImage, Link, Metric } from '@calwebtech/shared';
import { reveal } from '../ui/primitives';
import { Section, groundOf, type SectionTone } from './section';
import { SectionHeading } from './section-heading';

const METRIC_COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-3',
};

/**
 * Result figures, prominently sized: a case study's outcomes, a sector's numbers. Figures
 * are set in the result colour only when they are outcomes (`outcome`), and never on the
 * colour band, where teal would fail contrast.
 */
export function MetricBand({
  id,
  heading,
  intro,
  metrics,
  note,
  tone = 'ink',
  outcome = true,
  backdrop = null,
}: {
  id: string;
  heading?: string | null;
  intro?: string | null;
  metrics: readonly Metric[];
  /** How the figures were measured, under them. */
  note?: string | null;
  tone?: Exclude<SectionTone, 'tint'>;
  outcome?: boolean;
  backdrop?: DecorativeImage | null;
}) {
  if (metrics.length === 0) return null;
  const ground = groundOf(tone);
  const dark = ground === 'dark';
  const headingId = heading ? `${id}-heading` : undefined;
  const figure =
    outcome && tone !== 'band'
      ? 'font-display text-[36px] leading-none font-extrabold text-gold-ink lg:text-[46px]'
      : `font-display text-[36px] leading-none font-extrabold lg:text-[46px] ${dark ? 'text-ink-invert' : 'text-ink'}`;
  return (
    <Section id={id} tone={tone} backdrop={backdrop} labelledBy={headingId}>
      {heading ? <SectionHeading id={headingId} title={heading} intro={intro} ground={ground} /> : null}
      <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 ${METRIC_COLUMNS[metrics.length] ?? 'lg:grid-cols-4'}`}>
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex flex-col-reverse border-t pt-5 ${dark ? 'border-ink-invert/15' : 'border-hairline'}`}
            {...reveal(index)}
          >
            <dt className={`mt-2.5 text-[14.5px] leading-snug ${dark ? 'text-ink-invert-muted' : ''}`}>{metric.label}</dt>
            <dd className={figure}>{metric.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className={`mt-10 max-w-[70ch] text-[14px] ${dark ? 'text-ink-invert-muted' : ''}`}>{note}</p> : null}
    </Section>
  );
}

/** A call to action between sections: a white strip, or the colour band. */
export function CtaBand({
  id,
  eyebrow,
  heading,
  body,
  primaryCta,
  secondaryCta,
  tone = 'white',
}: {
  id: string;
  eyebrow?: string | null;
  heading: string;
  body?: string | null;
  primaryCta: Link;
  secondaryCta?: Link | null;
  tone?: 'white' | 'band';
}) {
  const band = tone === 'band';
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`content-auto relative overflow-hidden ${band ? 'bg-navy-900 py-16 text-ink-invert lg:py-20' : 'border-y border-hairline bg-canvas-raised py-14 lg:py-16'}`}
    >
      {band ? (
        <div className="absolute inset-0" aria-hidden="true">
        </div>
      ) : null}
      <div className="shell relative flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-[60ch]">
          {eyebrow ? <p className={`text-[14px] ${band ? 'text-ink-invert-muted' : ''}`}>{eyebrow}</p> : null}
          <h2
            id={`${id}-heading`}
            className={`${eyebrow ? 'mt-2 ' : ''}font-display text-[28px] leading-tight font-extrabold lg:text-[36px] ${band ? '' : 'text-ink'}`}
          >
            {heading}
          </h2>
          {body ? <p className={`mt-3 text-[16.5px] leading-relaxed ${band ? 'text-ink-invert-muted' : ''}`}>{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={primaryCta.href}
            className={
              band
                ? 'inline-flex h-14 items-center  bg-canvas-raised px-7 text-[16px] font-semibold text-ink hover:bg-canvas-sunken'
                : 'inline-flex h-14 items-center  bg-navy-900 px-7 text-[16px] font-semibold text-ink-invert hover:bg-navy-700'
            }
          >
            {primaryCta.label}
          </a>
          {secondaryCta ? (
            <a
              href={secondaryCta.href}
              className={
                band
                  ? 'glass inline-flex h-14 items-center  px-7 text-[16px] font-semibold text-ink-invert hover:bg-navy-900-invert/15'
                  : 'inline-flex h-14 items-center  border border-hairline px-7 text-[16px] font-semibold text-ink hover:border-ink hover:bg-canvas-raised'
              }
            >
              {secondaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
