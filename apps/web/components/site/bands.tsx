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
      ? 'font-display text-[36px] leading-none font-extrabold text-result lg:text-[46px]'
      : `font-display text-[36px] leading-none font-extrabold lg:text-[46px] ${dark ? 'text-white' : 'text-ink'}`;
  return (
    <Section id={id} tone={tone} backdrop={backdrop} labelledBy={headingId}>
      {heading ? <SectionHeading id={headingId} title={heading} intro={intro} ground={ground} /> : null}
      <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 ${METRIC_COLUMNS[metrics.length] ?? 'lg:grid-cols-4'}`}>
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex flex-col-reverse border-t pt-5 ${dark ? 'border-white/15' : 'border-line'}`}
            {...reveal(index)}
          >
            <dt className={`mt-2.5 text-[14.5px] leading-snug ${dark ? 'text-white/70' : ''}`}>{metric.label}</dt>
            <dd className={figure}>{metric.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className={`mt-10 max-w-[70ch] text-[14px] ${dark ? 'text-white/65' : ''}`}>{note}</p> : null}
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
      className={`content-auto relative overflow-hidden ${band ? 'band-gradient py-16 text-white lg:py-20' : 'border-y border-line bg-white py-14 lg:py-16'}`}
    >
      {band ? (
        <div className="absolute inset-0" aria-hidden="true">
          <div className="grid-lines-light absolute inset-0" />
          <div className="absolute -right-20 -bottom-40 h-[520px] w-[520px] rounded-full bg-glow-teal-20 blur-3xl" />
        </div>
      ) : null}
      <div className="shell relative flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-[60ch]">
          {eyebrow ? <p className={`text-[14px] ${band ? 'text-white/75' : ''}`}>{eyebrow}</p> : null}
          <h2
            id={`${id}-heading`}
            className={`${eyebrow ? 'mt-2 ' : ''}font-display text-[28px] leading-tight font-extrabold lg:text-[36px] ${band ? '' : 'text-ink'}`}
          >
            {heading}
          </h2>
          {body ? <p className={`mt-3 text-[16.5px] leading-relaxed ${band ? 'text-white/75' : ''}`}>{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={primaryCta.href}
            className={
              band
                ? 'inline-flex h-14 items-center rounded-xl bg-white px-7 text-[16px] font-semibold text-ink hover:bg-mist'
                : 'inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white hover:bg-primaryd'
            }
          >
            {primaryCta.label}
          </a>
          {secondaryCta ? (
            <a
              href={secondaryCta.href}
              className={
                band
                  ? 'glass inline-flex h-14 items-center rounded-xl px-7 text-[16px] font-semibold text-white hover:bg-white/15'
                  : 'inline-flex h-14 items-center rounded-xl border border-line px-7 text-[16px] font-semibold text-ink hover:border-ink hover:bg-mist2'
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
