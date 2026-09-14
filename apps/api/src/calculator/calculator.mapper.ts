import type { Faq, PricingTier } from '@calwebtech/db';
import {
  calculatorEvents,
  calculatorPageContentSchema,
  calculatorPageViewSchema,
  calculatorRateTable,
  type CalculatorPageContent,
  type CalculatorPageView,
} from '@calwebtech/shared';

export interface CalculatorPageSources {
  /** The `calculator.page` setting: every word on the page. */
  contentSetting: unknown;
  /** Published price bands (`PricingTier`), as on /pricing/. */
  pricingTiers: PricingTier[];
  /** Questions in the `calculator` FAQ group, in order. */
  faqs: Faq[];
}

/** The page's copy, or a throw naming the setting when it does not match the contract. */
export function calculatorContent(setting: unknown): CalculatorPageContent {
  return calculatorPageContentSchema.parse(setting);
}

/**
 * `/cost-calculator/`: the copy from the setting, the published bands and questions from
 * their content types, and the rate table the methodology section publishes. The figures
 * themselves come from the pricing model in packages/shared, never from copy.
 */
export function toCalculatorPageView(sources: CalculatorPageSources): CalculatorPageView {
  const content = calculatorContent(sources.contentSetting);
  return calculatorPageViewSchema.parse({
    content,
    tiers: sources.pricingTiers.map((tier) => ({
      name: tier.name,
      priceLabel: tier.priceLabel,
      summary: tier.summary,
      highlighted: tier.highlighted,
    })),
    rates: calculatorRateTable(content),
    faqs: sources.faqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer })),
    events: calculatorEvents(),
  });
}
