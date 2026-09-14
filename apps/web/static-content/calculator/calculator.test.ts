import {
  CALCULATOR_MODEL_VERSION,
  CALCULATOR_OPTIONS,
  CALCULATOR_STEP_KEYS,
  calculatorAnswersFromSearchParams,
  calculatorEvents,
  calculatorPageViewSchema,
  calculatorRateTable,
  countSentences,
  estimateProject,
  presentCalculatorResult,
  type CalculatorAnswers,
} from '@calwebtech/shared';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unfinishedCopy } from '../copy-rules';
import { calculatorPageSnapshot } from './index';

const view = calculatorPageViewSchema.parse(calculatorPageSnapshot);

const answers: CalculatorAnswers = {
  projectType: 'ecommerce',
  timeline: 'within-8-weeks',
  pageCount: '50-150',
  designDepth: 'custom-design',
  content: 'write-it-for-us',
  integrations: ['payments', 'erp-inventory'],
  cms: 'shopify',
  support: 'ongoing-partner',
};

/**
 * The calculator family's snapshot (docs/10-site-pages.md): exactly what the endpoint
 * returns, matching the contract, with publish-ready copy and figures that come from the
 * pricing model rather than from the copy.
 */
describe('calculator snapshot', () => {
  it('is one file, named after the view it holds', () => {
    const files = fs
      .readdirSync(import.meta.dirname)
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(files).toEqual(['page.json']);
  });

  it('matches the contract and carries no unfinished copy', () => {
    expect(unfinishedCopy(view)).toEqual([]);
  });

  it('keeps the metadata inside the per-record limits', () => {
    expect(view.content.seo.title.length).toBeLessThanOrEqual(60);
    expect(view.content.seo.description.length).toBeLessThanOrEqual(155);
  });

  it('opens with an answer block of two or three sentences naming the published bands', () => {
    const { answer } = view.content.hero;
    expect(countSentences(answer)).toBeGreaterThanOrEqual(2);
    expect(countSentences(answer)).toBeLessThanOrEqual(3);
    expect(answer).toContain('$12,000 to $25,000');
    expect(answer).toContain('$25,000 to $60,000');
    expect(answer).toContain('$1,500 a month');
  });

  it('shows the same published bands as the pricing page', () => {
    expect(view.tiers.map((tier) => tier.priceLabel)).toEqual(['$12k to $25k', '$25k to $60k', 'From $1.5k/mo']);
    expect(view.tiers.map((tier) => tier.name)).toEqual(['Focused build', 'Platform build', 'Ongoing partner']);
  });

  it('names every stored answer of all eight questions, so no visitor sees a raw value', () => {
    for (const step of CALCULATOR_STEP_KEYS) {
      const copy = view.content.calculator.steps[step];
      // The record is keyed by that question's own answers, so it is read by value here.
      const options: Record<string, { label: string }> = copy.options;
      expect(copy.question.endsWith('?')).toBe(true);
      for (const option of CALCULATOR_OPTIONS[step]) {
        expect(options[option]?.label.trim()).toBeTruthy();
      }
    }
  });

  it('names each question once, so the breakdown never repeats a row', () => {
    const titles = CALCULATOR_STEP_KEYS.map((step) => view.content.calculator.steps[step].title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('publishes the rates from the pricing model, not from the copy', () => {
    expect(view.rates).toEqual(calculatorRateTable(view.content));
    const projectType = view.rates.find((group) => group.step === 'projectType');
    expect(projectType?.rows[0]?.value).toBe('$12,000 to $16,000');
  });

  it('documents one measurable event per question, in the order they are answered', () => {
    expect(view.events).toEqual(calculatorEvents());
    expect(view.events.steps[2]).toBe('calculator-step-3-page-count');
  });

  it('asks the pricing questions once each, as questions a buyer types', () => {
    expect(view.faqs.length).toBeGreaterThanOrEqual(5);
    expect(new Set(view.faqs.map((faq) => faq.id)).size).toBe(view.faqs.length);
    expect(new Set(view.faqs.map((faq) => faq.question)).size).toBe(view.faqs.length);
    for (const faq of view.faqs) expect(faq.question.endsWith('?')).toBe(true);
    expect(view.content.faq.heading.endsWith('?')).toBe(true);
    expect(view.content.methodology.heading.endsWith('?')).toBe(true);
    for (const section of view.content.methodology.sections) expect(section.heading.endsWith('?')).toBe(true);
  });

  it('presents a result whose breakdown adds up to the range it shows', () => {
    const estimate = estimateProject(answers);
    const result = presentCalculatorResult(estimate, answers, view.content);
    expect(estimate.modelVersion).toBe(CALCULATOR_MODEL_VERSION);
    expect(estimate.lines.reduce((sum, line) => sum + line.low, 0)).toBe(estimate.low);
    expect(estimate.lines.reduce((sum, line) => sum + line.high, 0)).toBe(estimate.high);
    expect(result.rangeLabel).toContain(' to ');
    expect(result.breakdown).toHaveLength(estimate.lines.length);
    expect(result.answers).toHaveLength(CALCULATOR_STEP_KEYS.length);
    expect(result.tierName).toBe(view.content.calculator.result.tiers[estimate.tier].name);
  });

  it('carries every answer to the booking page in the result link', () => {
    const result = presentCalculatorResult(estimateProject(answers), answers, view.content);
    const query = new URLSearchParams(result.bookingPath.split('?')[1] ?? '');
    expect(result.bookingPath.startsWith('/book-a-consultation/')).toBe(true);
    expect(query.get('source')).toBe('cost-calculator');
    expect(calculatorAnswersFromSearchParams(query)).toEqual(answers);
  });

  it('never claims the calculator itself is a quote', () => {
    const note = view.content.calculator.result.note;
    expect(note).toMatch(/indicative/i);
    expect(note).toMatch(/not a quote/i);
  });
});
