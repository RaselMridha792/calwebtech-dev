import { CALCULATOR_ANCHORS, type CalculatorPageView } from '@calwebtech/shared';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';

/**
 * How the figures are worked out, and what every answer adds. This is the part of the page
 * written to be read and cited: question-shaped headings, plain answers, and the rates
 * themselves in a table, straight from the pricing model rather than from marketing copy.
 */
export function Methodology({ view }: { view: CalculatorPageView }) {
  const copy = view.content.methodology;
  const headingId = 'methodology-heading';
  const rateHeadingId = 'rates-heading';

  return (
    <Section id={CALCULATOR_ANCHORS.methodology} tone="white" labelledBy={headingId}>
      <SectionHeading id={headingId} title={copy.heading} intro={copy.intro} />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {copy.sections.map((section, index) => (
          <div key={section.heading} {...reveal(index)}>
            <h3 className="font-display text-[20px] leading-snug font-bold text-ink">{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 max-w-[64ch] text-[16px] leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-16 border-t border-hairline pt-12" {...reveal()}>
        <h3 id={rateHeadingId} className="max-w-[26ch] font-display text-[26px] leading-tight font-extrabold text-ink lg:text-[32px]">
          {copy.rateHeading}
        </h3>
        <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed">{copy.rateIntro}</p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
            <caption className="sr-only">{copy.rateHeading}</caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="py-3 pr-6 font-semibold text-ink">
                  {copy.rateColumns.option}
                </th>
                <th scope="col" className="py-3 font-semibold text-ink">
                  {copy.rateColumns.amount}
                </th>
              </tr>
            </thead>
            {view.rates.map((group) => (
              <tbody key={group.step}>
                <tr className="border-b border-hairline bg-canvas-raised">
                  <th scope="colgroup" colSpan={2} className="py-3 pr-6 font-display font-bold text-ink">
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={`${group.step}-${row.label}`} className="border-b border-hairline">
                    <th scope="row" className="py-3 pr-6 font-normal">
                      {row.label}
                    </th>
                    <td className="py-3 font-semibold text-ink">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mt-6 max-w-[70ch] text-[14.5px] leading-relaxed">{copy.rateNote}</p>
      </div>
    </Section>
  );
}

/** The published price bands beside the hero, from the `PricingTier` records. */
export function PriceBands({ view }: { view: CalculatorPageView }) {
  const copy = view.content.hero;
  return (
    <div className="glass p-7">
      <h2 className="font-display text-[18px] font-bold">{copy.bandsHeading}</h2>
      {view.tiers.length > 0 ? (
        <dl className="mt-5 space-y-4">
          {view.tiers.map((tier) => (
            <div key={tier.name} className="border-t border-ink-invert/15 pt-4 first:border-t-0 first:pt-0">
              <dt className="text-[15px] font-semibold">{tier.name}</dt>
              <dd className="mt-1 font-display text-[22px] font-extrabold">{tier.priceLabel}</dd>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-ink-invert-muted">{tier.summary}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 text-[15px] leading-relaxed text-ink-invert-muted">{copy.bandsEmpty}</p>
      )}
      <p className="mt-6 border-t border-ink-invert/15 pt-4 text-[13.5px] leading-relaxed text-ink-invert-muted">{copy.bandsNote}</p>
    </div>
  );
}
