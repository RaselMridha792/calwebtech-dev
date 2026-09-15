import {
  CALCULATOR_MULTI_SELECT_STEPS,
  CALCULATOR_OPTIONS,
  CALCULATOR_STEP_KEYS,
  calculatorPageViewSchema,
  type CalculatorPageView,
} from '@calwebtech/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculatorPageSnapshot } from '@/static-content/calculator';
import { CalculatorSection } from './calculator-section';
import { Methodology, PriceBands } from './methodology';
import { calculatorSteps } from './steps';

/**
 * What the server sends for `/cost-calculator/`. The tool itself is loaded on demand in the
 * browser, so what is rendered here is the first question as HTML, the methodology and the
 * published rates: everything a visitor, or a crawler, gets without running any script.
 */
const view = calculatorPageViewSchema.parse(calculatorPageSnapshot);
const copy = view.content.calculator;

const markup = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe('the calculator section', () => {
  const html = markup(<CalculatorSection view={view} permalink="/cost-calculator/" />);

  it('renders the first question, its answers and the progress, before any script runs', () => {
    expect(html).toContain(copy.steps.projectType.question);
    for (const option of CALCULATOR_OPTIONS.projectType) {
      expect(html).toContain(copy.steps.projectType.options[option].label);
    }
    expect(html).toContain('Question 1 of 8');
    expect(html).toContain('About 3 minutes left');
  });

  it('explains itself and hides the start button when script cannot run', () => {
    expect(html).toContain(copy.labels.noScript);
    expect(html).toContain('[data-calculator-start]{display:none}');
  });

  it('is the only h2 in its section, so the heading order holds', () => {
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html).toContain('id="calculator-heading"');
    expect(html).toContain('aria-labelledby="calculator-heading"');
  });

  it('sends the browser plain data: eight questions, their values and how many may be chosen', () => {
    const steps = calculatorSteps(copy);
    expect(steps.map((step) => step.key)).toEqual([...CALCULATOR_STEP_KEYS]);
    for (const step of steps) {
      expect(step.options.map((option) => option.value)).toEqual([
        ...CALCULATOR_OPTIONS[step.key as (typeof CALCULATOR_STEP_KEYS)[number]],
      ]);
      expect(step.multiple).toBe(CALCULATOR_MULTI_SELECT_STEPS.includes(step.key as never));
    }
    expect(steps.find((step) => step.key === 'integrations')?.exclusiveOption).toBe('none');
    expect(steps.find((step) => step.key === 'cms')?.exclusiveOption).toBeNull();
    // No figure travels with the questions: a price only ever comes back from the API.
    expect(JSON.stringify(steps)).not.toMatch(/\$\d/);
  });
});

describe('the methodology section', () => {
  const html = markup(<Methodology view={view} />);

  it('publishes a rate table with a heading per question and the amounts from the model', () => {
    for (const group of view.rates) {
      expect(html).toContain(group.title);
      for (const row of group.rows) expect(html).toContain(row.value);
    }
    expect(html).toContain('$12,000 to $16,000');
    expect(html.match(/<caption/g)).toHaveLength(1);
  });

  it('answers question-shaped headings under one h2', () => {
    expect(html.match(/<h2/g)).toHaveLength(1);
    for (const section of view.content.methodology.sections) expect(html).toContain(section.heading);
  });
});

describe('the published bands beside the hero', () => {
  it('lists each band with its price label', () => {
    const html = markup(<PriceBands view={view} />);
    for (const tier of view.tiers) {
      expect(html).toContain(tier.name);
      expect(html).toContain(tier.priceLabel);
    }
  });

  it('says plainly when nothing is published, as on the placeholder database', () => {
    const empty: CalculatorPageView = { ...view, tiers: [] };
    const html = markup(<PriceBands view={empty} />);
    expect(html).toContain(view.content.hero.bandsEmpty);
  });
});
