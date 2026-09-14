import type { Link, StaticPricingContent, StaticPricingTier } from '@calwebtech/shared';
import { CheckList, EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { PointGrid } from './parts';

/** The published engagement shapes, the most common one marked. */
export function PricingTiers({
  copy,
  tiers,
  action,
}: {
  copy: StaticPricingContent['tiers'];
  tiers: readonly StaticPricingTier[];
  /** Where to go while no tiers are published. */
  action: Link;
}) {
  return (
    <Section id="tiers" tone="white" labelledBy="tiers-heading">
      <SectionHeading id="tiers-heading" title={copy.heading} intro={copy.intro} />
      {tiers.length > 0 ? (
        <>
          <ul className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier, index) => (
              <li
                key={`${String(index)}-${tier.name}`}
                className={`relative flex flex-col rounded-2xl p-8 ${tier.highlighted ? 'border-2 border-ink shadow-card' : 'border border-line bg-white'}`}
                {...reveal(index)}
              >
                {tier.highlighted ? (
                  <p className="absolute -top-3.5 left-8 rounded-md bg-ink px-3 py-1 text-[12.5px] font-semibold text-white">
                    {copy.highlightLabel}
                  </p>
                ) : null}
                <h3 className="font-display text-[19px] font-bold text-ink">{tier.name}</h3>
                <p className="mt-4 font-display text-[34px] leading-none font-extrabold text-ink lg:text-[38px]">
                  {tier.priceLabel}
                </p>
                <p className="mt-5 text-[15.5px] leading-relaxed">{tier.summary}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[72ch] text-[14.5px]">{copy.note}</p>
        </>
      ) : (
        <EmptyState action={action}>{copy.empty}</EmptyState>
      )}
    </Section>
  );
}

/** What every project includes, beside its heading. */
export function PricingIncluded({ copy }: { copy: StaticPricingContent['included'] }) {
  return (
    <Section id="included" tone="mist" labelledBy="included-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <SectionHeading id="included-heading" title={copy.heading} intro={copy.intro} className="lg:col-span-5" />
        <div className="lg:col-span-7" {...reveal(1)}>
          <CheckList items={copy.items} columns={2} />
        </div>
      </div>
    </Section>
  );
}

/** The decisions that move a quote. */
export function PricingFactors({ copy }: { copy: StaticPricingContent['factors'] }) {
  return (
    <Section id="factors" tone="white" labelledBy="factors-heading">
      <SectionHeading id="factors-heading" title={copy.heading} intro={copy.intro} />
      <PointGrid items={copy.items} numbered />
    </Section>
  );
}

/** From first call to a fixed price. */
export function PricingQuoting({ copy }: { copy: StaticPricingContent['quoting'] }) {
  return (
    <Section id="quoting" tone="tint" labelledBy="quoting-heading">
      <SectionHeading id="quoting-heading" title={copy.heading} intro={copy.intro} />
      <PointGrid items={copy.steps} numbered columns={copy.steps.length === 4 ? 4 : 3} />
    </Section>
  );
}
