import { industryPath, servicePath, type ServiceDetailView } from '@calwebtech/shared';
import { CardGrid, CaseStudyCard, LinkCard, TestimonialCard } from '@/components/site/cards';
import { CheckList, StepList } from '@/components/site/lists';
import { Section, groundOf, type SectionTone } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { reveal } from '@/components/ui/primitives';

type Page = ServiceDetailView;

/** How a price band is introduced wherever it appears. */
export const PRICE_LABEL = 'Typical price';

/** The starting price band under the hero's calls to action, on the dark hero. */
export function HeroPriceBand({ price }: { price: NonNullable<Page['price']> }) {
  return (
    <p className="mt-8 inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-ink-invert/15 bg-navy-900-invert/5 px-5 py-3.5">
      <span className="text-[14px] text-ink-invert-muted">{PRICE_LABEL}</span>
      <span className="font-display text-[20px] leading-tight font-extrabold text-ink-invert">{price.label}</span>
    </p>
  );
}

/** The three situations that bring a buyer to this service. */
export function ProblemSection({ problem, tone }: { problem: NonNullable<Page['problem']>; tone: SectionTone }) {
  return (
    <Section id="situations" tone={tone} labelledBy="situations-heading">
      <SectionHeading id="situations-heading" title={problem.heading} intro={problem.intro} ground={groundOf(tone)} />
      <ol className="grid gap-5 md:grid-cols-3 lg:gap-6">
        {problem.situations.map((situation, index) => (
          <li key={situation.title} className="flex flex-col border-t border-hairline pt-5" {...reveal(index)}>
            <span className="meta text-gold-ink" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="heading-md mt-4 text-ink">{situation.title}</p>
            <p className="body-base mt-2.5 text-ink-muted">{situation.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** The itemised deliverables, with affirmative check marks. */
export function IncludedSection({ included, tone }: { included: NonNullable<Page['included']>; tone: SectionTone }) {
  const ground = groundOf(tone);
  return (
    <Section id="included" tone={tone} labelledBy="included-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SectionHeading id="included-heading" title={included.heading} intro={included.intro} ground={ground} className="mb-0" />
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          <CheckList items={included.items} columns={2} ground={ground} />
        </div>
      </div>
    </Section>
  );
}

/** Process steps with how long each takes. */
export function ProcessSection({ process, tone }: { process: NonNullable<Page['process']>; tone: SectionTone }) {
  const ground = groundOf(tone);
  return (
    <Section id="process" tone={tone} backdrop={process.backdrop} labelledBy="process-heading">
      <SectionHeading id="process-heading" title={process.heading} intro={process.intro} ground={ground} />
      <StepList steps={process.steps} ground={ground} />
    </Section>
  );
}

/** The technologies behind the service, from the Technology type. */
export function TechnologySection({ technology, tone }: { technology: NonNullable<Page['technology']>; tone: SectionTone }) {
  const dark = groundOf(tone) === 'dark';
  return (
    <Section id="technology" tone={tone} labelledBy="technology-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading
            id="technology-heading"
            title={technology.heading}
            intro={technology.intro}
            ground={groundOf(tone)}
            className="mb-0"
          />
        </div>
        <ul className="flex flex-wrap content-start gap-3 lg:col-span-7" {...reveal(1)}>
          {technology.items.map((item) => (
            <li
              key={item.name}
              className={` border px-5 py-3.5 ${dark ? 'border-ink-invert/15 bg-navy-900-invert/5' : 'border-hairline bg-canvas-raised'}`}
            >
              <span className={`block font-display text-[16px] font-bold ${dark ? '' : 'text-ink'}`}>{item.name}</span>
              {item.category ? (
                <span className={`block text-[13px] ${dark ? 'text-ink-invert-muted' : ''}`}>{item.category}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** Related case studies with their outcome figures, up to three. */
export function ProofSection({ proof, tone }: { proof: NonNullable<Page['proof']>; tone: SectionTone }) {
  return (
    <Section id="case-studies" tone={tone} labelledBy="case-studies-heading">
      <SectionHeading id="case-studies-heading" title={proof.heading} intro={proof.intro} link={proof.link} ground={groundOf(tone)} />
      <CardGrid columns={proof.caseStudies.length === 2 ? 2 : 3}>
        {proof.caseStudies.map((study, index) => (
          <CaseStudyCard key={study.slug} study={study} step={index} />
        ))}
      </CardGrid>
    </Section>
  );
}

/**
 * Our approach against a freelancer, a page builder and an offshore body shop. A table, in
 * its own scrollable region on small screens, which keyboard users can focus and scroll.
 */
export function ComparisonSection({
  comparison,
  tone,
}: {
  comparison: NonNullable<Page['comparison']>;
  tone: SectionTone;
}) {
  const { columns } = comparison;
  const others = [columns.freelancer, columns.pageBuilder, columns.offshore];
  return (
    <Section id="comparison" tone={tone} labelledBy="comparison-heading">
      <SectionHeading id="comparison-heading" title={comparison.heading} intro={comparison.intro} ground={groundOf(tone)} />
      {/* A focusable scroller needs a role and a name; its own name, so it is not a second landmark named like the section. */}
      <div
        role="region"
        aria-label={`${comparison.heading} The table scrolls sideways.`}
        tabIndex={0}
        className="overflow-x-auto border border-hairline bg-canvas-raised focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        {...reveal(1)}
      >
        <table className="w-full min-w-[860px] border-collapse text-left text-[15px] leading-relaxed">
          <caption className="sr-only">{comparison.heading}</caption>
          <thead>
            <tr className="border-b border-hairline">
              <td className="w-[16%] p-5" />
              <th scope="col" className="w-[24%] bg-navy-900 p-5 font-display text-[16px] font-bold text-ink-invert">
                {columns.us}
              </th>
              {others.map((label) => (
                <th key={label} scope="col" className="w-[20%] p-5 font-display text-[16px] font-bold text-ink">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline last:border-b-0">
                <th scope="row" className="p-5 align-top font-semibold text-ink">
                  {row.label}
                </th>
                <td className="bg-navy-500/5 p-5 align-top font-medium text-ink">{row.us}</td>
                <td className="p-5 align-top">{row.freelancer}</td>
                <td className="p-5 align-top">{row.pageBuilder}</td>
                <td className="p-5 align-top">{row.offshore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** The price band and what moves the number. */
export function PricingSection({
  pricing,
  price,
  tone,
}: {
  pricing: NonNullable<Page['pricing']>;
  price: Page['price'];
  tone: SectionTone;
}) {
  const ground = groundOf(tone);
  const dark = ground === 'dark';
  return (
    <Section id="pricing" tone={tone} labelledBy="pricing-heading">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id="pricing-heading" title={pricing.heading} intro={pricing.intro} ground={ground} className="mb-0" />
          {price ? (
            <p
              className={`mt-8  p-6 ${dark ? 'glass' : 'border border-hairline bg-canvas-raised'}`}
              {...reveal(1)}
            >
              <span className={`block text-[14px] ${dark ? 'text-ink-invert-muted' : ''}`}>{PRICE_LABEL}</span>
              <span className={`mt-1 block font-display text-[30px] leading-tight font-extrabold ${dark ? '' : 'text-ink'}`}>
                {price.label}
              </span>
            </p>
          ) : null}
          {pricing.link ? (
            <a
              href={pricing.link.href}
              className={
                dark
                  ? 'mt-7 inline-flex h-12 items-center  bg-canvas-raised px-6 font-semibold text-ink hover:bg-canvas-sunken'
                  : 'mt-7 inline-flex h-12 items-center  bg-navy-900 px-6 font-semibold text-ink-invert hover:bg-navy-700'
              }
            >
              {pricing.link.label}
            </a>
          ) : null}
        </div>
        <dl className="grid content-start gap-x-8 gap-y-8 sm:grid-cols-2 lg:col-span-7">
          {pricing.factors.map((factor, index) => (
            <div key={factor.title} className={`border-t pt-5 ${dark ? 'border-ink-invert/15' : 'border-hairline'}`} {...reveal(index)}>
              <dt className={`font-display text-[18px] font-bold ${dark ? '' : 'text-ink'}`}>{factor.title}</dt>
              <dd className={`mt-2 text-[15.5px] leading-relaxed ${dark ? 'text-ink-invert-muted' : ''}`}>{factor.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

/** The industries this service is delivered for, linking to their pages. */
export function IndustriesSection({ industries, tone }: { industries: NonNullable<Page['industries']>; tone: SectionTone }) {
  return (
    <Section id="industries" tone={tone} labelledBy="industries-heading">
      <SectionHeading id="industries-heading" title={industries.heading} intro={industries.intro} ground={groundOf(tone)} />
      <CardGrid columns={industries.items.length % 3 === 0 ? 3 : 4}>
        {industries.items.map((industry, index) => (
          <LinkCard key={industry.slug} href={industryPath(industry.slug)} title={industry.name} body={industry.line} step={index} />
        ))}
      </CardGrid>
    </Section>
  );
}

/** A consented client quote about this service's work. */
export function TestimonialSection({ testimonial, tone }: { testimonial: NonNullable<Page['testimonial']>; tone: SectionTone }) {
  const ground = groundOf(tone);
  return (
    <Section id="client-quote" tone={tone} labelledBy="client-quote-heading">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id="client-quote-heading" title={testimonial.heading} ground={ground} className="mb-0" />
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <TestimonialCard testimonial={testimonial.quote} ground={ground} />
        </div>
      </div>
    </Section>
  );
}

/** Other services, same category first. */
export function RelatedServicesSection({ related, tone }: { related: NonNullable<Page['related']>; tone: SectionTone }) {
  return (
    <Section id="related-services" tone={tone} labelledBy="related-services-heading">
      <SectionHeading id="related-services-heading" title={related.heading} intro={related.intro} ground={groundOf(tone)} />
      <CardGrid columns={3}>
        {related.items.map((service, index) => (
          <LinkCard
            key={service.slug}
            href={servicePath(service.slug)}
            title={service.title}
            body={service.summary}
            meta={service.priceLabel ? `${PRICE_LABEL}: ${service.priceLabel}` : null}
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}
