import { describe, expect, it } from 'vitest';
import {
  BUDGET_BANDS,
  CALCULATOR_BANDS,
  CALCULATOR_OPTIONS,
  CALCULATOR_STEP_KEYS,
  calculatorAnswersFromSearchParams,
  calculatorAnswersSchema,
  calculatorBookingPath,
  calculatorEvents,
  calculatorEventsSchema,
  calculatorLeadAnswers,
  estimateProject,
  formatUsdRange,
  type CalculatorAnswers,
} from './index';

/** The leanest project the calculator can describe. */
const LEANEST: CalculatorAnswers = {
  projectType: 'marketing-site',
  timeline: 'flexible',
  pageCount: 'under-10',
  designDepth: 'component-library',
  content: 'ready',
  integrations: ['none'],
  cms: 'headless',
  support: 'none',
};

/** The largest: everything at its most demanding. */
const LARGEST: CalculatorAnswers = {
  projectType: 'web-application',
  timeline: 'within-8-weeks',
  pageCount: 'over-150',
  designDepth: 'custom-design-and-brand',
  content: 'write-it-for-us',
  integrations: ['crm', 'email-marketing', 'booking', 'payments', 'erp-inventory', 'custom-system'],
  cms: 'custom-dashboard',
  support: 'ongoing-partner',
};

const answers = (overrides: Partial<CalculatorAnswers> = {}): CalculatorAnswers => ({ ...LEANEST, ...overrides });

describe('calculatorAnswersSchema', () => {
  it('accepts every option of every question', () => {
    for (const step of CALCULATOR_STEP_KEYS) {
      for (const option of CALCULATOR_OPTIONS[step]) {
        const value = step === 'integrations' ? [option] : option;
        expect(calculatorAnswersSchema.safeParse({ ...LEANEST, [step]: value }).success).toBe(true);
      }
    }
  });

  it('refuses an unknown answer, a missing answer and an empty integrations list', () => {
    expect(calculatorAnswersSchema.safeParse({ ...LEANEST, pageCount: '500' }).success).toBe(false);
    const missing: Record<string, unknown> = { ...LEANEST };
    delete missing.cms;
    expect(calculatorAnswersSchema.safeParse(missing).success).toBe(false);
    expect(calculatorAnswersSchema.safeParse({ ...LEANEST, integrations: [] }).success).toBe(false);
  });

  it('refuses "none of these" beside an integration, and a repeated integration', () => {
    expect(calculatorAnswersSchema.safeParse({ ...LEANEST, integrations: ['none', 'crm'] }).success).toBe(false);
    expect(calculatorAnswersSchema.safeParse({ ...LEANEST, integrations: ['crm', 'crm'] }).success).toBe(false);
  });
});

describe('estimateProject', () => {
  it('starts the leanest marketing site at the bottom of the Focused build band', () => {
    const estimate = estimateProject(LEANEST);
    expect(estimate.low).toBe(CALCULATOR_BANDS.focused.low);
    expect(estimate.high).toBeLessThanOrEqual(CALCULATOR_BANDS.focused.high);
    expect(estimate.tier).toBe('focused');
    expect(estimate.budgetBand).toBe('12k-25k');
    expect(estimate.monthlyFrom).toBeNull();
  });

  it('puts a platform project inside the Platform build band', () => {
    const estimate = estimateProject(
      answers({
        projectType: 'ecommerce',
        timeline: 'within-4-months',
        pageCount: '50-150',
        designDepth: 'custom-design',
        content: 'write-it-for-us',
        integrations: ['crm', 'payments'],
        support: 'care-plan',
      }),
    );
    expect(estimate.tier).toBe('platform');
    expect(estimate.budgetBand).toBe('25k-60k');
    expect(estimate.low).toBeGreaterThanOrEqual(CALCULATOR_BANDS.platform.low);
    expect(estimate.monthlyFrom).toBe(CALCULATOR_BANDS.ongoingPartnerMonthlyFrom);
  });

  it('says plainly when a project is beyond the published bands', () => {
    const estimate = estimateProject(LARGEST);
    expect(estimate.low).toBeGreaterThan(CALCULATOR_BANDS.platform.high);
    expect(estimate.tier).toBe('beyond');
    expect(estimate.budgetBand).toBe('60k-120k');
  });

  it('is pure: the same answers give the same figures, and the answers are not changed', () => {
    const input = answers({ integrations: ['crm', 'booking'] });
    const copy = structuredClone(input);
    expect(estimateProject(input)).toEqual(estimateProject(copy));
    expect(input).toEqual(copy);
  });

  it('adds up: the lines are the total, and every figure is a whole $500', () => {
    for (const set of [LEANEST, LARGEST, answers({ integrations: ['crm', 'erp-inventory'], pageCount: '10-50' })]) {
      const estimate = estimateProject(set);
      expect(estimate.lines.reduce((sum, line) => sum + line.low, 0)).toBe(estimate.low);
      expect(estimate.lines.reduce((sum, line) => sum + line.high, 0)).toBe(estimate.high);
      for (const line of estimate.lines) {
        expect(line.low % 500).toBe(0);
        expect(line.high % 500).toBe(0);
        expect(line.high).toBeGreaterThanOrEqual(line.low);
      }
    }
  });

  it('charges nothing extra for the platform a project type already includes', () => {
    const store = answers({ projectType: 'ecommerce' });
    expect(estimateProject({ ...store, cms: 'shopify' })).toEqual(estimateProject({ ...store, cms: 'headless' }));
    const application = answers({ projectType: 'web-application' });
    expect(estimateProject({ ...application, cms: 'custom-dashboard' })).toEqual(
      estimateProject({ ...application, cms: 'headless' }),
    );
  });

  it('prices a compressed schedule as a share of the build, and a relaxed one at nothing', () => {
    const relaxed = estimateProject(answers({ designDepth: 'custom-design' }));
    const rushed = estimateProject(answers({ designDepth: 'custom-design', timeline: 'within-8-weeks' }));
    expect(relaxed.lines.find((line) => line.step === 'timeline')).toEqual({ step: 'timeline', low: 0, high: 0 });
    expect(rushed.high).toBeGreaterThan(relaxed.high);
    expect(rushed.low).toBeGreaterThan(relaxed.low);
  });

  it('scales writing the content with the number of pages', () => {
    const small = estimateProject(answers({ content: 'write-it-for-us' }));
    const large = estimateProject(answers({ content: 'write-it-for-us', pageCount: 'over-150' }));
    const line = (estimate: ReturnType<typeof estimateProject>) =>
      estimate.lines.find((item) => item.step === 'content')?.high ?? 0;
    expect(line(large)).toBeGreaterThan(line(small));
  });

  it('never goes below the published floor, whatever the answers', () => {
    for (const projectType of CALCULATOR_OPTIONS.projectType) {
      expect(estimateProject(answers({ projectType })).low).toBeGreaterThanOrEqual(CALCULATOR_BANDS.focused.low);
    }
  });

  it('names the three changes that would lower the range most, each a real saving', () => {
    const estimate = estimateProject(
      answers({
        pageCount: '50-150',
        designDepth: 'custom-design-and-brand',
        content: 'write-it-for-us',
        integrations: ['crm', 'erp-inventory'],
        timeline: 'within-8-weeks',
      }),
    );
    expect(estimate.movers).toHaveLength(3);
    for (const mover of estimate.movers) {
      expect(mover.high).toBeGreaterThan(0);
      expect(mover.high).toBeLessThan(estimate.high);
    }
    const savings = estimate.movers.map((mover) => mover.high);
    expect([...savings].sort((a, b) => b - a)).toEqual(savings);
    expect(estimate.movers.some((mover) => mover.change === 'drop' && mover.option === 'erp-inventory')).toBe(true);
  });

  it('offers nothing to move on the leanest project', () => {
    expect(estimateProject(LEANEST).movers).toEqual([]);
  });

  it('maps every result onto a budget band the lead form already uses', () => {
    const bands = new Set(BUDGET_BANDS.map((band) => band.value));
    for (const projectType of CALCULATOR_OPTIONS.projectType) {
      for (const pageCount of CALCULATOR_OPTIONS.pageCount) {
        const estimate = estimateProject(answers({ projectType, pageCount }));
        expect(bands.has(estimate.budgetBand)).toBe(true);
      }
    }
  });
});

describe('the lead a calculator submission stores', () => {
  it('keeps every answer as a top-level field beside the estimate, so each is queryable', () => {
    const input = answers({ integrations: ['crm', 'booking'], support: 'ongoing-partner' });
    const stored = calculatorLeadAnswers(input, estimateProject(input));
    for (const step of CALCULATOR_STEP_KEYS) expect(stored[step]).toEqual(input[step]);
    expect(stored.estimate.tier).toBe('focused');
    expect(stored.estimate.modelVersion).toBe('2026-09');
    expect(stored.estimate).not.toHaveProperty('lines');
  });
});

describe('the consultation link', () => {
  it('carries every answer, and reads back as the same answers', () => {
    const input = answers({ integrations: ['crm', 'payments'], projectType: 'redesign' });
    const path = calculatorBookingPath(input);
    expect(path.startsWith('/book-a-consultation/?')).toBe(true);
    const params = new URLSearchParams(path.slice(path.indexOf('?')));
    expect(params.get('source')).toBe('cost-calculator');
    expect(params.get('project-type')).toBe('redesign');
    expect(params.get('integrations')).toBe('crm,payments');
    expect(calculatorAnswersFromSearchParams(params)).toEqual(input);
  });

  it('reads nothing from a link with an answer missing or invented', () => {
    const params = new URLSearchParams(calculatorBookingPath(LEANEST).split('?')[1] ?? '');
    params.delete('cms');
    expect(calculatorAnswersFromSearchParams(params)).toBeNull();
    const invented = new URLSearchParams(calculatorBookingPath(LEANEST).split('?')[1] ?? '');
    invented.set('page-count', 'a-thousand');
    expect(calculatorAnswersFromSearchParams(invented)).toBeNull();
  });
});

describe('measurable events', () => {
  it('names one event per question, in order, and validates', () => {
    const events = calculatorEvents();
    expect(calculatorEventsSchema.parse(events)).toEqual(events);
    expect(events.steps[0]).toBe('calculator-step-1-project-type');
    expect(events.steps.at(-1)).toBe('calculator-step-8-support');
    expect(new Set(events.steps).size).toBe(events.steps.length);
  });
});

describe('formatting', () => {
  it('writes a range in whole dollars', () => {
    expect(formatUsdRange(12_000, 25_500)).toBe('$12,000 to $25,500');
    expect(formatUsdRange(12_000, 12_000)).toBe('$12,000');
  });
});
