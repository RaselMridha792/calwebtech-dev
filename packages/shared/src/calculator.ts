import { z } from 'zod';
import type { BudgetBand } from './lead';

/*
 * The cost calculator (docs/03-page-specs.md, "Cost calculator"; docs/06-build-plan.md,
 * task 4.1): the eight questions, the answers a lead stores, and the pricing model.
 *
 * The model is a pure function anchored on the published price bands: Focused build
 * $12,000 to $25,000, Platform build $25,000 to $60,000, Ongoing partner from $1,500 a
 * month, and the budget bands in lead.ts. The web app shows the range the API computed; the
 * API recomputes it from the answers on every submission and never accepts a figure from
 * the browser.
 *
 * This file imports nothing but zod at runtime (lead.ts is a type import), so lead.ts and
 * email-jobs.ts can import it without a cycle.
 */

export const CALCULATOR_PATH = '/cost-calculator/';
/** Where the result's next action goes; the booking family owns the page. */
export const CONSULTATION_PATH = '/book-a-consultation/';
/** `formId` of the calculator's lead, and the `source` it passes to the booking page. */
export const CALCULATOR_FORM_ID = 'cost-calculator';
/** Stored with every estimate, so a lead can be read against the rates that produced it. */
export const CALCULATOR_MODEL_VERSION = '2026-09';

/** The eight questions, in the order the visitor answers them. */
export const CALCULATOR_STEP_KEYS = [
  'projectType',
  'timeline',
  'pageCount',
  'designDepth',
  'content',
  'integrations',
  'cms',
  'support',
] as const;
export type CalculatorStepKey = (typeof CALCULATOR_STEP_KEYS)[number];

/**
 * Stored answer values per question. They are segmentation keys: stable, lowercase and
 * hyphenated. The words a visitor reads live in the page copy (pages/calculator.ts).
 */
export const CALCULATOR_OPTIONS = {
  projectType: ['marketing-site', 'redesign', 'ecommerce', 'web-application'],
  timeline: ['flexible', 'within-4-months', 'within-8-weeks'],
  pageCount: ['under-10', '10-50', '50-150', 'over-150'],
  designDepth: ['component-library', 'custom-design', 'custom-design-and-brand'],
  content: ['ready', 'needs-editing', 'write-it-for-us'],
  integrations: ['crm', 'email-marketing', 'booking', 'payments', 'erp-inventory', 'custom-system', 'none'],
  cms: ['recommend', 'headless', 'wordpress', 'shopify', 'custom-dashboard'],
  support: ['none', 'care-plan', 'ongoing-partner'],
} as const satisfies Record<CalculatorStepKey, readonly [string, ...string[]]>;

export type CalculatorOption<K extends CalculatorStepKey> = (typeof CALCULATOR_OPTIONS)[K][number];

/** Questions where the visitor may choose more than one answer. */
export const CALCULATOR_MULTI_SELECT_STEPS: readonly CalculatorStepKey[] = ['integrations'];

/** The integrations answer that stands for "none of these". */
export const CALCULATOR_NO_INTEGRATIONS = 'none' satisfies CalculatorOption<'integrations'>;

const integrationsSchema = z
  .array(z.enum(CALCULATOR_OPTIONS.integrations))
  .min(1, 'Choose at least one answer, or "none of these"')
  .max(CALCULATOR_OPTIONS.integrations.length)
  .refine((values) => new Set(values).size === values.length, 'Choose each answer once')
  .refine(
    (values) => !values.includes(CALCULATOR_NO_INTEGRATIONS) || values.length === 1,
    '"None of these" cannot be combined with an integration',
  );

/** All eight answers. Every lead from the calculator stores them as typed fields. */
export const calculatorAnswersSchema = z.object({
  projectType: z.enum(CALCULATOR_OPTIONS.projectType),
  timeline: z.enum(CALCULATOR_OPTIONS.timeline),
  pageCount: z.enum(CALCULATOR_OPTIONS.pageCount),
  designDepth: z.enum(CALCULATOR_OPTIONS.designDepth),
  content: z.enum(CALCULATOR_OPTIONS.content),
  integrations: integrationsSchema,
  cms: z.enum(CALCULATOR_OPTIONS.cms),
  support: z.enum(CALCULATOR_OPTIONS.support),
});
export type CalculatorAnswers = z.output<typeof calculatorAnswersSchema>;

// ---------------------------------------------------------------- rates

type Money = readonly [low: number, high: number];

/** The published bands the model is anchored on, in US dollars. */
export const CALCULATOR_BANDS = {
  focused: { name: 'Focused build', low: 12_000, high: 25_000 },
  platform: { name: 'Platform build', low: 25_000, high: 60_000 },
  ongoingPartnerMonthlyFrom: 1_500,
} as const;

/**
 * What each answer adds to the one-off build, as a low and a high figure. The base for the
 * project type covers discovery, design from a component library, the CMS, lead capture, up
 * to ten pages, QA and launch, so the leanest marketing site starts at the bottom of the
 * Focused build band.
 */
export const CALCULATOR_RATES = {
  projectType: {
    'marketing-site': [12_000, 16_000],
    redesign: [13_000, 18_000],
    ecommerce: [22_000, 30_000],
    'web-application': [28_000, 40_000],
  },
  pageCount: {
    'under-10': [0, 0],
    '10-50': [2_000, 4_000],
    '50-150': [5_000, 9_000],
    'over-150': [9_000, 16_000],
  },
  designDepth: {
    'component-library': [0, 0],
    'custom-design': [3_000, 6_000],
    'custom-design-and-brand': [7_000, 12_000],
  },
  /** For a site under ten pages; multiplied by `contentPageFactor` for larger ones. */
  content: {
    ready: [0, 0],
    'needs-editing': [1_000, 2_000],
    'write-it-for-us': [2_500, 4_500],
  },
  contentPageFactor: { 'under-10': 1, '10-50': 1.6, '50-150': 2.5, 'over-150': 3.5 },
  /** Each integration chosen. */
  integrations: {
    crm: [2_000, 4_000],
    'email-marketing': [1_500, 3_000],
    booking: [3_000, 5_000],
    payments: [3_000, 6_000],
    'erp-inventory': [6_000, 12_000],
    'custom-system': [5_000, 10_000],
    none: [0, 0],
  },
  cms: {
    recommend: [0, 0],
    headless: [0, 0],
    wordpress: [0, 0],
    shopify: [2_000, 4_000],
    'custom-dashboard': [6_000, 12_000],
  },
  /** A launch inside eight weeks runs design and build in parallel: a share of the build. */
  timelineUplift: {
    flexible: [0, 0],
    'within-4-months': [0, 0],
    'within-8-weeks': [0.15, 0.2],
  },
  /** Care plans and the Ongoing partner plan start at this monthly figure. */
  monthlyFrom: {
    none: null,
    'care-plan': CALCULATOR_BANDS.ongoingPartnerMonthlyFrom,
    'ongoing-partner': CALCULATOR_BANDS.ongoingPartnerMonthlyFrom,
  },
} as const satisfies {
  projectType: Record<CalculatorOption<'projectType'>, Money>;
  pageCount: Record<CalculatorOption<'pageCount'>, Money>;
  designDepth: Record<CalculatorOption<'designDepth'>, Money>;
  content: Record<CalculatorOption<'content'>, Money>;
  contentPageFactor: Record<CalculatorOption<'pageCount'>, number>;
  integrations: Record<CalculatorOption<'integrations'>, Money>;
  cms: Record<CalculatorOption<'cms'>, Money>;
  timelineUplift: Record<CalculatorOption<'timeline'>, Money>;
  monthlyFrom: Record<CalculatorOption<'support'>, number | null>;
};

export type CalculatorRates = typeof CALCULATOR_RATES;

/**
 * Answers whose cost the project type already covers: a store's base includes its commerce
 * platform, and a web application's base includes its admin dashboard.
 */
function cmsRange(answers: CalculatorAnswers): Money {
  if (answers.cms === 'shopify' && answers.projectType === 'ecommerce') return [0, 0];
  if (answers.cms === 'custom-dashboard' && answers.projectType === 'web-application') return [0, 0];
  return CALCULATOR_RATES.cms[answers.cms];
}

// ---------------------------------------------------------------- estimate

export const CALCULATOR_TIERS = ['focused', 'platform', 'beyond'] as const;
export type CalculatorTier = (typeof CALCULATOR_TIERS)[number];

/** Budget band values (lead.ts), repeated as literals so this file has no runtime import. */
const ESTIMATE_BUDGET_BANDS = ['under-12k', '12k-25k', '25k-60k', '60k-120k', 'over-120k'] as const satisfies readonly BudgetBand[];

/** The steps a breakdown line can come from: every answer except ongoing support, which is monthly. */
export const CALCULATOR_LINE_STEPS = [
  'projectType',
  'pageCount',
  'designDepth',
  'content',
  'integrations',
  'cms',
  'timeline',
] as const satisfies readonly CalculatorStepKey[];
export type CalculatorLineStep = (typeof CALCULATOR_LINE_STEPS)[number];

const dollars = z.number().int().nonnegative();

export const calculatorLineSchema = z.object({ step: z.enum(CALCULATOR_LINE_STEPS), low: dollars, high: dollars });

/**
 * A change that would lower the range: `choose` another answer to a question, or `drop` one
 * of the integrations chosen. `low` and `high` are how much lower each end would be.
 */
export const calculatorMoverSchema = z.object({
  step: z.enum(CALCULATOR_LINE_STEPS),
  change: z.enum(['choose', 'drop']),
  option: z.string().min(1),
  low: dollars,
  high: dollars,
});

/** What the API returns and stores: the range, the tier, the breakdown and what would move it. */
export const calculatorEstimateSchema = z.object({
  modelVersion: z.literal(CALCULATOR_MODEL_VERSION),
  currency: z.literal('USD'),
  low: dollars,
  high: dollars,
  tier: z.enum(CALCULATOR_TIERS),
  budgetBand: z.enum(ESTIMATE_BUDGET_BANDS),
  /** Care plans and the Ongoing partner plan, per month; null without ongoing support. */
  monthlyFrom: dollars.nullable(),
  lines: z.array(calculatorLineSchema),
  movers: z.array(calculatorMoverSchema).max(3),
});
export type CalculatorEstimate = z.output<typeof calculatorEstimateSchema>;
export type CalculatorLine = z.output<typeof calculatorLineSchema>;
export type CalculatorMover = z.output<typeof calculatorMoverSchema>;

const roundTo500 = (value: number): number => Math.round(value / 500) * 500;

function lineFor(step: CalculatorLineStep, range: Money): CalculatorLine {
  return { step, low: roundTo500(range[0]), high: roundTo500(range[1]) };
}

/**
 * What the content answer adds, at the page count chosen. It is the one line that is not a
 * flat rate: writing scales with the number of pages (`contentPageFactor`), so the figure a
 * visitor sees in the breakdown is the rate multiplied and rounded. The methodology table
 * publishes the same function, so the row on screen can still be reproduced by hand.
 */
export function calculatorContentRate(
  content: CalculatorOption<'content'>,
  pageCount: CalculatorOption<'pageCount'>,
): [low: number, high: number] {
  const [low, high] = CALCULATOR_RATES.content[content];
  const factor = CALCULATOR_RATES.contentPageFactor[pageCount];
  return [roundTo500(low * factor), roundTo500(high * factor)];
}

/** The lines and totals, without the movers (which are computed from this). */
function priceLines(answers: CalculatorAnswers): { lines: CalculatorLine[]; low: number; high: number } {
  const rates = CALCULATOR_RATES;
  const integrations = answers.integrations.reduce<[number, number]>(
    (sum, integration) => {
      const [low, high] = rates.integrations[integration];
      return [sum[0] + low, sum[1] + high];
    },
    [0, 0],
  );

  const build: CalculatorLine[] = [
    lineFor('projectType', rates.projectType[answers.projectType]),
    lineFor('pageCount', rates.pageCount[answers.pageCount]),
    lineFor('designDepth', rates.designDepth[answers.designDepth]),
    lineFor('content', calculatorContentRate(answers.content, answers.pageCount)),
    lineFor('integrations', integrations),
    lineFor('cms', cmsRange(answers)),
  ];
  const subtotalLow = build.reduce((sum, line) => sum + line.low, 0);
  const subtotalHigh = build.reduce((sum, line) => sum + line.high, 0);
  const [upliftLow, upliftHigh] = rates.timelineUplift[answers.timeline];
  const lines = [...build, lineFor('timeline', [subtotalLow * upliftLow, subtotalHigh * upliftHigh])];

  return {
    lines,
    low: lines.reduce((sum, line) => sum + line.low, 0),
    high: lines.reduce((sum, line) => sum + line.high, 0),
  };
}

/** The published band the middle of the range falls in. */
export function calculatorTier(low: number, high: number): CalculatorTier {
  const middle = (low + high) / 2;
  if (middle <= CALCULATOR_BANDS.focused.high) return 'focused';
  if (middle <= CALCULATOR_BANDS.platform.high) return 'platform';
  return 'beyond';
}

/** The budget band (lead.ts) the middle of the range falls in, stored on the lead. */
export function calculatorBudgetBand(low: number, high: number): (typeof ESTIMATE_BUDGET_BANDS)[number] {
  const middle = (low + high) / 2;
  if (middle < 12_000) return 'under-12k';
  if (middle <= 25_000) return '12k-25k';
  if (middle <= 60_000) return '25k-60k';
  if (middle <= 120_000) return '60k-120k';
  return 'over-120k';
}

const MOVER_STEPS = ['timeline', 'pageCount', 'designDepth', 'content', 'cms'] as const satisfies readonly CalculatorLineStep[];

/**
 * The three changes that would lower the range most: the cheapest other answer to a
 * question, or leaving out one chosen integration. Ranked by the saving at the high end.
 */
function moversFor(answers: CalculatorAnswers, current: { low: number; high: number }): CalculatorMover[] {
  const candidates: CalculatorMover[] = [];
  const consider = (step: CalculatorLineStep, change: CalculatorMover['change'], option: string, alternative: CalculatorAnswers) => {
    const priced = priceLines(alternative);
    const high = current.high - priced.high;
    if (high <= 0) return;
    candidates.push({ step, change, option, low: Math.max(0, current.low - priced.low), high });
  };

  for (const step of MOVER_STEPS) {
    let best: { option: string; answers: CalculatorAnswers; high: number } | null = null;
    for (const option of CALCULATOR_OPTIONS[step]) {
      if (option === answers[step]) continue;
      const alternative: CalculatorAnswers = { ...answers, [step]: option };
      const high = priceLines(alternative).high;
      if (!best || high < best.high) best = { option, answers: alternative, high };
    }
    if (best) consider(step, 'choose', best.option, best.answers);
  }

  for (const integration of answers.integrations) {
    if (integration === CALCULATOR_NO_INTEGRATIONS) continue;
    const remaining = answers.integrations.filter((value) => value !== integration);
    consider('integrations', 'drop', integration, {
      ...answers,
      integrations: remaining.length > 0 ? remaining : [CALCULATOR_NO_INTEGRATIONS],
    });
  }

  return candidates.sort((a, b) => b.high - a.high || b.low - a.low).slice(0, 3);
}

/**
 * The indicative range for a set of answers. Pure and deterministic: the same answers give
 * the same figures in the API, in an emailed copy and in a test. Figures are whole dollars,
 * each line rounded to $500, and the total is the sum of the lines, so the breakdown adds up.
 */
export function estimateProject(input: CalculatorAnswers): CalculatorEstimate {
  const answers = calculatorAnswersSchema.parse(input);
  const { lines, low, high } = priceLines(answers);
  return {
    modelVersion: CALCULATOR_MODEL_VERSION,
    currency: 'USD',
    low,
    high,
    tier: calculatorTier(low, high),
    budgetBand: calculatorBudgetBand(low, high),
    monthlyFrom: CALCULATOR_RATES.monthlyFrom[answers.support],
    lines,
    movers: moversFor(answers, { low, high }),
  };
}

// ---------------------------------------------------------------- the stored lead

/** The part of an estimate kept on the lead, beside the answers. */
export const calculatorStoredEstimateSchema = calculatorEstimateSchema.pick({
  modelVersion: true,
  currency: true,
  low: true,
  high: true,
  tier: true,
  budgetBand: true,
  monthlyFrom: true,
});

/**
 * `Lead.answers` of a calculator lead: the eight answers as top-level fields, so each is
 * queryable (`answers->>'pageCount'`), and the estimate the API computed from them.
 */
export const calculatorLeadAnswersSchema = calculatorAnswersSchema.extend({ estimate: calculatorStoredEstimateSchema });
export type CalculatorLeadAnswers = z.output<typeof calculatorLeadAnswersSchema>;

export function calculatorLeadAnswers(answers: CalculatorAnswers, estimate: CalculatorEstimate): CalculatorLeadAnswers {
  return calculatorLeadAnswersSchema.parse({ ...answers, estimate });
}

/** `POST /leads` answers 202 with this body for a calculator lead: the range the API computed. */
export const calculatorLeadReceivedSchema = z.object({
  status: z.literal('received'),
  estimate: calculatorEstimateSchema,
});
export type CalculatorLeadReceived = z.output<typeof calculatorLeadReceivedSchema>;

// ---------------------------------------------------------------- the emailed copy

/** A site path such as `/book-a-consultation/?source=cost-calculator`; never another host. */
const sitePathSchema = z
  .string()
  .max(2000)
  .refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Must be a path on this site');

export const calculatorResultRowSchema = z.object({
  label: z.string().min(1),
  /** The answer behind a breakdown line, e.g. "10 to 50 pages". */
  detail: z.string().min(1).nullable(),
  value: z.string().min(1),
});
export type CalculatorResultRow = z.output<typeof calculatorResultRowSchema>;

/**
 * The result in words, built from the estimate and the page copy by
 * `presentCalculatorResult` (pages/calculator.ts). The page shows it and the email repeats
 * it, so both say the same thing and the words stay editable with the page.
 */
export const calculatorPresentedResultSchema = z.object({
  rangeLabel: z.string().min(1),
  /** The band and the budget band the range fell in, for the page's measurable events. */
  tier: z.enum(CALCULATOR_TIERS),
  budgetBand: z.enum(ESTIMATE_BUDGET_BANDS),
  tierName: z.string().min(1),
  tierSummary: z.string().min(1),
  monthly: z.string().min(1),
  breakdown: z.array(calculatorResultRowSchema),
  movers: z.array(calculatorResultRowSchema),
  /** Shown in place of the movers when no change would lower the range. */
  noMovers: z.string().min(1),
  answers: z.array(calculatorResultRowSchema),
  note: z.string().min(1),
  bookingPath: sitePathSchema,
});
export type CalculatorPresentedResult = z.output<typeof calculatorPresentedResultSchema>;

/** The `calculator-result` email job's content: the result plus the email's own words. */
export const calculatorResultEmailSchema = calculatorPresentedResultSchema.extend({
  heading: z.string().min(1),
  intro: z.string().min(1),
  rangeHeading: z.string().min(1),
  breakdownHeading: z.string().min(1),
  moversHeading: z.string().min(1),
  monthlyHeading: z.string().min(1),
  answersHeading: z.string().min(1),
  bookingLabel: z.string().min(1),
  methodologyLabel: z.string().min(1),
  methodologyPath: sitePathSchema,
});
export type CalculatorResultEmail = z.output<typeof calculatorResultEmailSchema>;

// ---------------------------------------------------------------- helpers

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** "$18,500". */
export const formatUsd = (value: number): string => usd.format(value);

/** "$18,500 to $32,000", or one figure when both ends match. */
export function formatUsdRange(low: number, high: number): string {
  return low === high ? formatUsd(low) : `${formatUsd(low)} to ${formatUsd(high)}`;
}

/** Query parameter per question on the booking link. */
export const CALCULATOR_PARAMS: Readonly<Record<CalculatorStepKey, string>> = {
  projectType: 'project-type',
  timeline: 'timeline',
  pageCount: 'page-count',
  designDepth: 'design-depth',
  content: 'content',
  integrations: 'integrations',
  cms: 'cms',
  support: 'support',
};

/**
 * The consultation link with the answers carried in the URL, for example
 * `/book-a-consultation/?source=cost-calculator&project-type=redesign&...&integrations=crm,booking`.
 * The booking page reads it back with `calculatorAnswersFromSearchParams`.
 */
export function calculatorBookingPath(answers: CalculatorAnswers): string {
  const params = new URLSearchParams({ source: CALCULATOR_FORM_ID });
  for (const step of CALCULATOR_STEP_KEYS) {
    const value = answers[step];
    params.set(CALCULATOR_PARAMS[step], Array.isArray(value) ? value.join(',') : value);
  }
  return `${CONSULTATION_PATH}?${params.toString()}`;
}

/** Answers from a booking link, or null when any is missing or not a known value. */
export function calculatorAnswersFromSearchParams(params: URLSearchParams): CalculatorAnswers | null {
  const raw: Record<string, unknown> = {};
  for (const step of CALCULATOR_STEP_KEYS) {
    const value = params.get(CALCULATOR_PARAMS[step]);
    raw[step] = step === 'integrations' ? value?.split(',').filter(Boolean) : value;
  }
  const parsed = calculatorAnswersSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Analytics events the calculator dispatches (docs/03, "Each step fires a measurable
 * event"), named for Umami funnel reports. They carry no personal data.
 *
 * - `calculator-step-<n>-<question>` when question n is shown, e.g. `calculator-step-3-page-count`,
 *   with `{ step, direction }`; step-level drop-off is the funnel from step 1 to the result.
 * - `calculator-email-gate` when the email gate is shown.
 * - `calculator-email-submit` when the visitor asks for the estimate.
 * - `calculator-result` when the stored estimate is shown, with `{ tier, budgetBand }`.
 * - `calculator-result-unsent` when the range is shown but could not be stored or emailed.
 * - `calculator-book-consultation` when the visitor follows the booking link.
 * - `calculator-restart` when the visitor starts again.
 */
export function calculatorEvents() {
  return {
    steps: CALCULATOR_STEP_KEYS.map(
      (step, index) => `calculator-step-${String(index + 1)}-${CALCULATOR_PARAMS[step]}`,
    ),
    gate: 'calculator-email-gate',
    submit: 'calculator-email-submit',
    result: 'calculator-result',
    unsent: 'calculator-result-unsent',
    book: 'calculator-book-consultation',
    restart: 'calculator-restart',
  };
}

export const calculatorEventsSchema = z.object({
  steps: z.array(z.string().regex(/^[a-z0-9-]{1,50}$/)).length(CALCULATOR_STEP_KEYS.length),
  gate: z.string().min(1),
  submit: z.string().min(1),
  result: z.string().min(1),
  unsent: z.string().min(1),
  book: z.string().min(1),
  restart: z.string().min(1),
});
export type CalculatorEvents = z.output<typeof calculatorEventsSchema>;
