import { servicePath, type IndustryDetailView } from '@calwebtech/shared';
import { CardGrid, CaseStudyCard, LinkCard, TestimonialCard } from '../site/cards';
import { CheckList } from '../site/lists';
import { Section, groundOf } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ShieldIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';
import type { IndustrySectionTone } from './section-tones';

type Sections = Pick<
  IndustryDetailView,
  'painPoints' | 'services' | 'compliance' | 'caseStudies' | 'results' | 'integrations'
>;
type LightTone = Exclude<IndustrySectionTone, 'ink'>;

/** The hero's right-hand column: the sector line over what the build handles, with check marks. */
export function IndustryHighlights({ hero }: { hero: IndustryDetailView['hero'] }) {
  if (hero.highlights.length === 0) return null;
  return (
    <div className="glass p-7 lg:p-8">
      {hero.line ? <p className="font-display text-[19px] leading-snug font-bold">{hero.line}</p> : null}
      <div className={hero.line ? 'mt-6 border-t border-ink-invert/15 pt-6' : ''}>
        <CheckList items={hero.highlights} ground="dark" />
      </div>
    </div>
  );
}

/** Four problems in the sector's own vocabulary, numbered. */
export function IndustryPainPoints({ section, tone }: { section: NonNullable<Sections['painPoints']>; tone: LightTone }) {
  return (
    <Section id="industry-challenges" tone={tone} labelledBy="industry-challenges-heading">
      <SectionHeading id="industry-challenges-heading" title={section.heading} intro={section.intro} />
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {section.items.map((item, index) => (
          <li
            key={item.title}
            className={`flex flex-col  border border-hairline p-7 ${tone === 'white' ? 'bg-canvas-raised' : 'bg-canvas-raised'}`}
            {...reveal(index)}
          >
            <span className="font-display text-[15px] font-extrabold text-gold-ink" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 font-display text-[19px] leading-snug font-bold text-ink">{item.title}</h3>
            {item.body ? <p className="mt-3 text-[15px] leading-relaxed">{item.body}</p> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** The matched services, each described for this sector, linking to the service page. */
export function IndustryServices({ section, tone }: { section: NonNullable<Sections['services']>; tone: LightTone }) {
  return (
    <Section id="industry-services" tone={tone} labelledBy="industry-services-heading">
      <SectionHeading id="industry-services-heading" title={section.heading} intro={section.intro} />
      <CardGrid columns={3}>
        {section.items.map((item, index) => (
          <LinkCard key={item.slug} href={servicePath(item.slug)} title={item.title} body={item.body} step={index} />
        ))}
      </CardGrid>
    </Section>
  );
}

/** Compliance or integration rules the build has to get right. */
export function IndustryCompliance({ section, tone }: { section: NonNullable<Sections['compliance']>; tone: LightTone }) {
  return (
    <Section id="industry-compliance" tone={tone} labelledBy="industry-compliance-heading">
      <SectionHeading id="industry-compliance-heading" title={section.heading} intro={section.intro} />
      <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        {section.notes.map((note, index) => (
          <li key={note.title} className="flex gap-5" {...reveal(index)}>
            <span
              className="grid h-11 w-11 shrink-0 place-items-center border border-hairline bg-canvas-raised text-gold-ink"
              aria-hidden="true"
            >
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-[19px] leading-snug font-bold text-ink">{note.title}</h3>
              <p className="mt-2.5 text-[15.5px] leading-relaxed">{note.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Case studies from this industry, with the link to the work listing filtered by it. */
export function IndustryCaseStudies({ section, tone }: { section: NonNullable<Sections['caseStudies']>; tone: LightTone }) {
  return (
    <Section id="industry-work" tone={tone} labelledBy="industry-work-heading">
      <SectionHeading id="industry-work-heading" title={section.heading} intro={section.intro} link={section.link} />
      <CardGrid columns={3}>
        {section.items.map((study, index) => (
          <CaseStudyCard key={study.slug} study={study} step={index} />
        ))}
      </CardGrid>
    </Section>
  );
}

/**
 * The sector's result figures, each with the client it was measured for, and a consented
 * quote from one of those clients when there is one. Image with overlay, on ink.
 */
export function IndustryResults({
  section,
  backdrop,
}: {
  section: NonNullable<Sections['results']>;
  backdrop: IndustryDetailView['hero']['backdrop'];
}) {
  const ground = groundOf('ink');
  const quote = section.testimonial;
  return (
    <Section id="industry-results" tone="ink" backdrop={backdrop} labelledBy="industry-results-heading">
      <SectionHeading id="industry-results-heading" title={section.heading} intro={section.intro} ground={ground} />
      <div className={`grid gap-12 ${quote ? 'lg:grid-cols-12 lg:gap-16' : ''}`}>
        <div className={quote ? 'lg:col-span-7' : ''}>
          <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 ${quote ? '' : 'lg:grid-cols-3'}`}>
            {section.metrics.map((metric, index) => (
              <div
                key={`${metric.clientName}-${metric.label}`}
                className="flex flex-col-reverse justify-end border-t border-ink-invert/15 pt-5"
                {...reveal(index)}
              >
                <dt className="mt-2.5 text-[14.5px] leading-snug text-ink-invert-muted">
                  {metric.label}
                  <span className="mt-1 block text-[13px] text-ink-invert-muted">{metric.clientName}</span>
                </dt>
                <dd className="font-display text-[36px] leading-none font-extrabold text-gold-ink lg:text-[46px]">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
          {section.note ? <p className="mt-10 max-w-[70ch] text-[14px] text-ink-invert-muted">{section.note}</p> : null}
        </div>
        {quote ? (
          <div className="lg:col-span-5" {...reveal(1)}>
            <TestimonialCard testimonial={quote} ground={ground} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** The systems a website in this sector usually connects to. */
export function IndustryIntegrations({ section, tone }: { section: NonNullable<Sections['integrations']>; tone: LightTone }) {
  return (
    <Section id="industry-integrations" tone={tone} labelledBy="industry-integrations-heading">
      <SectionHeading id="industry-integrations-heading" title={section.heading} intro={section.intro} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {section.items.map((item, index) => (
          <li
            key={item.name}
            className={` border border-hairline p-7 ${tone === 'white' ? 'bg-canvas-raised' : 'bg-canvas-raised'}`}
            {...reveal(index)}
          >
            <h3 className="font-display text-[18px] leading-snug font-bold text-ink">{item.name}</h3>
            {item.body ? <p className="mt-2.5 text-[15px] leading-relaxed">{item.body}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}
