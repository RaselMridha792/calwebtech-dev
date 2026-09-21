import type { LandingPageView, ProcessStepView } from '@calwebtech/shared';
import { BackdropImage } from '../ui/brand';
import { PillBadge, Stars, reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { BeforeAfterSlider } from './before-after-slider';
import { ProcessStepper } from './process-stepper';

type Content = LandingPageView['content'];

const h2Dark = 'font-display text-[32px] leading-[1.1] font-extrabold text-ink lg:text-[42px]';
const h2Light = 'font-display text-[32px] leading-[1.1] font-extrabold lg:text-[42px]';

export function ResultsSection({
  results,
  items,
}: {
  results: Content['results'];
  items: LandingPageView['results'];
}) {
  if (items.length === 0) return null;
  return (
    <section className="content-auto bg-canvas-raised py-20 lg:py-28">
      <div className="shell-narrow">
        <div className="max-w-[60ch]" {...reveal()}>
          <h2 className={h2Dark}>{results.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{results.intro}</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {items.map((item, index) => (
            <article
              key={item.slug}
              className="lift grid overflow-hidden border border-hairline sm:grid-cols-2"
              {...reveal(index)}
            >
              <div className="relative min-h-[220px] bg-canvas-sunken">
                {item.image ? (
                  <ResponsiveImage
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="p-7">
                {item.tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 text-[12px] font-medium">
                    {item.tags.map((tag) => (
                      <li key={tag} className="bg-canvas-sunken px-2.5 py-1 text-ink">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <h3 className="mt-4 font-display text-[21px] font-extrabold text-ink">
                  {item.clientName}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed">{item.summary}</p>
                <dl className="mt-5 space-y-2.5 border-t border-hairline pt-5">
                  {item.metrics.slice(0, 2).map((metric) => (
                    <div key={metric.label} className="flex items-baseline justify-between gap-4">
                      <dt className="order-2 text-right text-[13px]">{metric.label}</dt>
                      <dd className="order-1 font-display text-[24px] font-extrabold text-gold-ink">
                        {metric.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-9 text-center">
          <a
            href="#form"
            className="inline-flex h-13 items-center bg-navy-900 px-7 font-semibold text-ink-invert hover:bg-navy-700"
          >
            {results.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

function StepList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-invert-muted">{label}</p>
      <ul className="space-y-2 text-[14.5px] text-ink-invert-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function StepPanel({ step }: { step: ProcessStepView }) {
  return (
    <>
      <div className="lg:col-span-6">
        <h3 className="font-display text-[26px] leading-tight font-extrabold lg:text-[32px]">
          {step.heading}
        </h3>
        <p className="mt-4 text-[16.5px] leading-relaxed text-ink-invert-muted">{step.body}</p>
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <StepList label="You get" items={step.youGet} />
          <StepList label="We need from you" items={step.weNeed} />
        </div>
      </div>
      {step.image ? (
        <div className="mt-8 lg:col-span-6 lg:mt-0">
          <div className="relative aspect-[16/10] overflow-hidden ring-1 ring-ink-invert/15">
            <ResponsiveImage
              src={step.image.src}
              alt={step.image.alt}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ProcessSection({
  process,
  steps,
}: {
  process: Content['process'];
  steps: LandingPageView['processSteps'];
}) {
  if (steps.length === 0) return null;
  return (
    <section id="process" className="content-auto relative overflow-hidden bg-navy-900 py-20 text-ink-invert lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={process.backgroundImage} className="opacity-[.14]" />
        <div className="absolute inset-0 bg-linear-to-b from-navy-900 via-navy-900/93 to-navy-900" />
      </div>
      <div className="shell-narrow relative">
        <div className="max-w-[58ch]" {...reveal()}>
          <PillBadge>{process.badge}</PillBadge>
          <h2 className={`mt-6 ${h2Light}`}>{process.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-invert-muted">{process.intro}</p>
        </div>
        <div className="mt-12" {...reveal(1)}>
          <ProcessStepper
            tabs={steps.map((step) => ({ title: step.title, timing: step.timing }))}
            panels={steps.map((step) => (
              <StepPanel key={step.title} step={step} />
            ))}
          />
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterSection({
  beforeAfter,
  comparison,
}: {
  beforeAfter: Content['beforeAfter'];
  comparison: LandingPageView['beforeAfter'];
}) {
  if (!comparison) return null;
  const frame = (image: NonNullable<LandingPageView['beforeAfter']>['before']) => (
    <ResponsiveImage
      src={image.src}
      alt={image.alt}
      fill
      sizes="(min-width: 1024px) 60vw, 100vw"
      className="object-cover object-top"
      draggable={false}
    />
  );
  return (
    <section className="content-auto border-b border-hairline bg-canvas-raised py-20 lg:py-28">
      <div className="shell-narrow grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className={h2Dark}>{beforeAfter.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{beforeAfter.intro}</p>
          {comparison.metrics.length > 0 ? (
            <dl className="mt-8 space-y-4 border-t border-hairline pt-7">
              {comparison.metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline justify-between gap-6">
                  <dt className="text-[14px]">{metric.label}</dt>
                  <dd className="font-display font-bold text-ink">
                    {metric.before} <span className="text-ink-muted">to</span>{' '}
                    <span className="font-bold text-gold-ink">{metric.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <a
            href="#form"
            className="mt-8 inline-flex h-12 items-center bg-navy-900 px-6 font-semibold text-ink-invert hover:bg-navy-700"
          >
            {beforeAfter.ctaLabel}
          </a>
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          <BeforeAfterSlider
            before={frame(comparison.before)}
            after={frame(comparison.after)}
            clientName={comparison.clientName}
          />
        </div>
      </div>
    </section>
  );
}

export function PartnersSection({
  partners,
  items,
  technologies,
}: {
  partners: Content['partners'];
  items: LandingPageView['partners'];
  technologies: LandingPageView['technologies'];
}) {
  if (items.length === 0 && technologies.length === 0) return null;
  return (
    <section className="content-auto border-b border-hairline bg-canvas-raised py-18 lg:py-24">
      <div className="shell-narrow">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4" {...reveal()}>
            <h2 className="font-display text-[26px] leading-[1.15] font-extrabold text-ink lg:text-[32px]">
              {partners.heading}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed">{partners.intro}</p>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-8">
            {items.map((partner, index) => (
              <li
                key={partner.name}
                className="lift border border-hairline px-5 py-6 text-center"
                {...reveal(index)}
              >
                <p className="font-display text-[16px] font-bold text-ink">{partner.name}</p>
                {partner.note ? <p className="mt-1 text-[13px]">{partner.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>

        {technologies.length > 0 ? (
          <div className="mt-12 flex flex-wrap items-center gap-x-9 gap-y-4 border-t border-hairline pt-10 text-[15px] text-ink/60">
            <h3 className="text-[14px] font-semibold text-ink-muted" style={{ letterSpacing: 'normal' }}>
              {partners.technologiesLabel}
            </h3>
            <ul className="contents">
              {technologies.map((technology) => (
                <li key={technology.name} className="font-display font-bold">
                  {technology.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TeamSection({ team, members }: { team: Content['team']; members: LandingPageView['team'] }) {
  if (members.length === 0) return null;
  return (
    <section className="content-auto border-b border-hairline bg-canvas-raised py-20 lg:py-28">
      <div className="shell-narrow">
        <div className="max-w-[58ch]" {...reveal()}>
          <h2 className={h2Dark}>{team.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{team.intro}</p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member, index) => (
            <li
              key={member.name}
              className="lift overflow-hidden border border-hairline bg-canvas-raised"
              {...reveal(index)}
            >
              <div className="relative aspect-[4/5] bg-canvas-sunken">
                {member.photo ? (
                  <ResponsiveImage
                    src={member.photo.src}
                    alt={member.photo.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="p-5">
                <h3 className="font-display text-[17px] font-bold text-ink">{member.name}</h3>
                <p className="text-[14px] font-semibold text-gold-ink">{member.role}</p>
                {member.bio ? <p className="mt-2 text-[14px] leading-relaxed">{member.bio}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TestimonialsSection({
  testimonials,
  items,
  reviews,
}: {
  testimonials: Content['testimonials'];
  items: LandingPageView['testimonials'];
  reviews: LandingPageView['reviews'];
}) {
  if (items.length === 0) return null;
  const summary = [
    ...reviews.sources.slice(0, 2).map((source) => ({
      value: source.rating.toFixed(1),
      label: source.platform,
    })),
    ...(reviews.npsScore !== null ? [{ value: reviews.npsScore.toFixed(1), label: 'NPS' }] : []),
  ];

  return (
    <section className="content-auto relative overflow-hidden bg-navy-900 py-20 text-ink-invert lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={testimonials.backgroundImage} className="opacity-[.20]" />
        <div className="absolute inset-0 bg-linear-to-b from-navy-900/95 via-navy-900/90 to-navy-900" />
      </div>
      <div className="shell-narrow relative">
        <div className="flex flex-wrap items-end justify-between gap-6" {...reveal()}>
          <h2 className={`${h2Light} max-w-[18ch]`}>{testimonials.heading}</h2>
          {summary.length > 0 ? (
            <dl className="flex items-center gap-7 text-[14px]">
              {summary.map((item) => (
                <div key={item.label} className="flex flex-row-reverse items-baseline gap-1.5">
                  <dt className="text-ink-invert-muted">{item.label}</dt>
                  <dd className="font-display text-[26px] font-extrabold">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure key={item.id} className="glass p-7" {...reveal(index)}>
              <Stars rating={item.rating} className="text-[15px]" />
              <blockquote className="mt-4 text-[16px] leading-relaxed">{`"${item.quote}"`}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-ink-invert/15 pt-5">
                {item.avatar ? (
                  <ResponsiveImage
                    src={item.avatar.src}
                    alt=""
                    width={44}
                    height={44}
                    sizes="44px"
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : null}
                <span className="text-[14px]">
                  <b className="block">{item.clientName}</b>
                  <span className="text-ink-invert-muted">
                    {[item.role, item.company].filter(Boolean).join(', ')}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
