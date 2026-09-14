import type { Faq, PricingTier } from '@calwebtech/db';
import { CALCULATOR_PAGE_PLACEHOLDER } from '@calwebtech/db/seed';
import { CALCULATOR_STEP_KEYS, calculatorEvents } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { toCalculatorPageView, type CalculatorPageSources } from './calculator.mapper';

const tier = (name: string, priceLabel: string, order: number): PricingTier => ({
  id: `tier-${String(order)}`,
  name,
  priceLabel,
  summary: `What ${name} covers.`,
  highlighted: order === 1,
  active: true,
  order,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
});

const faq = (id: string, question: string): Faq => ({
  id,
  question,
  answer: 'The answer to it.',
  group: 'calculator',
  order: 0,
  serviceId: null,
  industryId: null,
  locationId: null,
  landingPageId: null,
});

function sources(overrides: Partial<CalculatorPageSources> = {}): CalculatorPageSources {
  return {
    contentSetting: CALCULATOR_PAGE_PLACEHOLDER,
    pricingTiers: [tier('Focused build', '$12k to $25k', 0), tier('Platform build', '$25k to $60k', 1)],
    faqs: [faq('faq-1', 'How much does a website cost?')],
    ...overrides,
  };
}

describe('toCalculatorPageView', () => {
  it('returns the page copy, the published bands and the questions', () => {
    const view = toCalculatorPageView(sources());
    expect(view.content.calculator.steps.projectType.options['marketing-site'].label).toBeTruthy();
    expect(view.tiers.map((band) => band.priceLabel)).toEqual(['$12k to $25k', '$25k to $60k']);
    expect(view.tiers[1]?.highlighted).toBe(true);
    expect(view.faqs).toEqual([{ id: 'faq-1', question: 'How much does a website cost?', answer: 'The answer to it.' }]);
  });

  it('publishes the rate table the methodology section shows, from the model not from copy', () => {
    const view = toCalculatorPageView(sources());
    expect(view.rates.map((group) => group.step)).toEqual([
      'projectType',
      'pageCount',
      'designDepth',
      'content',
      'integrations',
      'cms',
    ]);
    const pages = view.rates.find((group) => group.step === 'pageCount');
    expect(pages?.rows.map((row) => row.value)).toEqual(['Included', '$2,000 to $4,000', '$5,000 to $9,000', '$9,000 to $16,000']);
  });

  it('names one measurable event per question, in the order they are answered', () => {
    expect(toCalculatorPageView(sources()).events).toEqual(calculatorEvents());
    expect(toCalculatorPageView(sources()).events.steps).toHaveLength(CALCULATOR_STEP_KEYS.length);
  });

  it('renders with no published bands and no questions, as on the placeholder database', () => {
    const view = toCalculatorPageView(sources({ pricingTiers: [], faqs: [] }));
    expect(view.tiers).toEqual([]);
    expect(view.faqs).toEqual([]);
    expect(view.content.hero.bandsEmpty).toBeTruthy();
  });

  it('refuses copy that is missing, so the page never renders half a question', () => {
    expect(() => toCalculatorPageView(sources({ contentSetting: null }))).toThrow(ZodError);
  });

  it('refuses copy that has lost the label of a stored answer', () => {
    const content = structuredClone(CALCULATOR_PAGE_PLACEHOLDER) as unknown as {
      calculator: { steps: Record<string, { options: Record<string, unknown> }> };
    };
    delete content.calculator.steps.support?.options['care-plan'];
    expect(() => toCalculatorPageView(sources({ contentSetting: content }))).toThrow(ZodError);
  });
});
