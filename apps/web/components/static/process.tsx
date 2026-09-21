import type { Link, StaticProcessContent, StaticProcessStep } from '@calwebtech/shared';
import { CheckList, EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { PointGrid } from './parts';

/** One stage in full: when it runs, what happens, what you get and what we need. */
function ProcessStage({
  step,
  index,
  copy,
}: {
  step: StaticProcessStep;
  index: number;
  copy: StaticProcessContent['steps'];
}) {
  const id = `stage-${String(index + 1)}`;
  const imageFirst = index % 2 === 1;
  return (
    <li aria-labelledby={id} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-16" {...reveal()}>
      <div className={`lg:col-span-6 ${imageFirst ? 'lg:order-2' : ''}`}>
        <p className="flex flex-wrap items-center gap-3 text-[14px]">
          <span
            className="grid h-9 w-9 place-items-center bg-navy-900 font-display text-[15px] font-extrabold text-ink-invert"
            aria-hidden="true"
          >
            {String(index + 1)}
          </span>
          <span className="bg-canvas-sunken px-2.5 py-1 font-semibold text-ink">{step.timing}</span>
        </p>
        <h3 id={id} className="mt-5 font-display text-[28px] leading-tight font-extrabold text-ink lg:text-[34px]">
          <span className="sr-only">{`Stage ${String(index + 1)}: `}</span>
          {step.title}
        </h3>
        <p className="mt-2 font-display text-[19px] leading-snug font-semibold text-ink">{step.heading}</p>
        <p className="mt-4 text-[16.5px] leading-relaxed">{step.body}</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {step.youGet.length > 0 ? (
            <div>
              <h4 className="mb-3 font-display text-[15px] font-bold text-ink">{copy.youGetLabel}</h4>
              <CheckList items={step.youGet} />
            </div>
          ) : null}
          {step.weNeed.length > 0 ? (
            <div>
              <h4 className="mb-3 font-display text-[15px] font-bold text-ink">{copy.weNeedLabel}</h4>
              <ul className="space-y-3 text-[16px] text-ink">
                {step.weNeed.map((item) => (
                  <li key={item} className="flex items-start gap-3.5">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-900" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      {step.image ? (
        <div className={`lg:col-span-6 ${imageFirst ? 'lg:order-1' : ''}`}>
          <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken ">
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
    </li>
  );
}

/** Every stage of a project in order, or an empty state while none is published. */
export function ProcessStages({
  copy,
  steps,
  action,
}: {
  copy: StaticProcessContent['steps'];
  steps: readonly StaticProcessStep[];
  action: Link;
}) {
  return (
    <Section id="stages" tone="white" labelledBy="stages-heading">
      <SectionHeading id="stages-heading" title={copy.heading} intro={copy.intro} />
      {steps.length > 0 ? (
        <>
          <ol className="mb-16 flex flex-wrap gap-2 text-[14px]" aria-label="Stages at a glance">
            {steps.map((step, index) => (
              <li key={`${String(index)}-${step.title}`} className="rounded-full border border-hairline bg-canvas-raised px-4 py-2">
                <span className="font-semibold text-ink">{`${String(index + 1)}. ${step.title}`}</span>
                <span className="text-ink-muted">{` · ${step.timing}`}</span>
              </li>
            ))}
          </ol>
          <ol className="space-y-20 lg:space-y-28">
            {steps.map((step, index) => (
              <ProcessStage key={`${String(index)}-${step.title}`} step={step} index={index} copy={copy} />
            ))}
          </ol>
        </>
      ) : (
        <EmptyState action={action}>{copy.empty}</EmptyState>
      )}
    </Section>
  );
}

/** Titled points under a question heading: why the timeline holds, what slows a project. */
export function ProcessPoints({
  id,
  copy,
  tone,
}: {
  id: string;
  copy: StaticProcessContent['principles'];
  tone: 'mist' | 'white';
}) {
  return (
    <Section id={id} tone={tone} labelledBy={`${id}-heading`}>
      <SectionHeading id={`${id}-heading`} title={copy.heading} intro={copy.intro} />
      <PointGrid items={copy.items} columns={copy.items.length === 4 ? 4 : 3} />
    </Section>
  );
}

/** The warranty, training and handover that follow launch, on the dark ground. */
export function ProcessAfterLaunch({ copy }: { copy: StaticProcessContent['afterLaunch'] }) {
  return (
    <Section id="after-launch" tone="ink" labelledBy="after-launch-heading">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading
            id="after-launch-heading"
            title={copy.heading}
            intro={copy.body}
            ground="dark"
            className="mb-0"
          />
          {copy.link ? (
            <a
              href={copy.link.href}
              className="mt-8 inline-flex h-12 items-center bg-canvas-raised px-6 font-semibold text-ink hover:bg-canvas-sunken"
            >
              {copy.link.label}
            </a>
          ) : null}
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <CheckList items={copy.items} ground="dark" />
        </div>
      </div>
    </Section>
  );
}
