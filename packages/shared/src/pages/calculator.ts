import { z } from 'zod';
import {
  CALCULATOR_LINE_STEPS,
  CALCULATOR_NO_INTEGRATIONS,
  CALCULATOR_OPTIONS,
  CALCULATOR_PATH,
  CALCULATOR_RATES,
  CALCULATOR_STEP_KEYS,
  CALCULATOR_TIERS,
  calculatorBookingPath,
  calculatorEventsSchema,
  calculatorPresentedResultSchema,
  calculatorResultEmailSchema,
  formatUsd,
  formatUsdRange,
  type CalculatorAnswers,
  type CalculatorEstimate,
  type CalculatorLineStep,
  type CalculatorPresentedResult,
  type CalculatorResultEmail,
  type CalculatorResultRow,
  type CalculatorStepKey,
} from '../calculator';
import { linkSchema } from '../home-page';
import { decorativeImageSchema } from '../media';
import { answerBlockSchema, faqItemSchema, pageSeoSchema, questionSchema, requiredText } from './common';

/*
 * The cost calculator page, `/cost-calculator/` (docs/10-site-pages.md). The pricing model
 * lives in ../calculator; this file holds the words: the copy of the page, the view the API
 * returns, and the presenter that turns an estimate into the sentences the page shows and
 * the email repeats.
 */

/** Copy of the page, stored in the `Setting` table and editable without a deploy. */
export const CALCULATOR_SETTING_KEYS = { page: 'calculator.page' } as const;

/** `Faq.group` of the questions shown on /cost-calculator/. */
export const CALCULATOR_FAQ_GROUP = 'calculator';

/** Anchors the page links to. */
export const CALCULATOR_ANCHORS = { tool: 'calculator', methodology: 'methodology', faq: 'faq' } as const;

/** `{name}` placeholders in a copy template, filled with the values given. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

const optionCopySchema = z.object({
  label: requiredText(80),
  /** One line under the option, such as what it covers. */
  description: requiredText(240).nullable().default(null),
});

function stepCopySchema<const Values extends readonly [string, ...string[]]>(values: Values) {
  return z.object({
    /** Short name of the question, used in the breakdown and the methodology table. */
    title: requiredText(40),
    question: questionSchema(140),
    help: requiredText(300).nullable().default(null),
    /** One entry per stored answer value; the record is exhaustive. */
    options: z.record(z.enum(values), optionCopySchema),
  });
}

const stepsCopySchema = z.object({
  projectType: stepCopySchema(CALCULATOR_OPTIONS.projectType),
  timeline: stepCopySchema(CALCULATOR_OPTIONS.timeline),
  pageCount: stepCopySchema(CALCULATOR_OPTIONS.pageCount),
  designDepth: stepCopySchema(CALCULATOR_OPTIONS.designDepth),
  content: stepCopySchema(CALCULATOR_OPTIONS.content),
  integrations: stepCopySchema(CALCULATOR_OPTIONS.integrations),
  cms: stepCopySchema(CALCULATOR_OPTIONS.cms),
  support: stepCopySchema(CALCULATOR_OPTIONS.support),
});

const labelsSchema = z.object({
  /** "Question {current} of {total}". */
  progress: requiredText(60),
  /** "About {minutes} minutes left". */
  timeLeft: requiredText(60),
  timeLeftOne: requiredText(60),
  timeLeftShort: requiredText(60),
  back: requiredText(30),
  next: requiredText(30),
  toResult: requiredText(40),
  restart: requiredText(40),
  /** Shown when the visitor presses next without answering. */
  chooseOne: requiredText(120),
  chooseAtLeastOne: requiredText(120),
  /** The button on the server-rendered card, before the calculator loads. */
  start: requiredText(40),
  loading: requiredText(60),
  /** Shown instead of the calculator when script cannot run. */
  noScript: requiredText(300),
});

const gateSchema = z.object({
  heading: requiredText(120),
  body: requiredText(400),
  nameLabel: requiredText(40),
  emailLabel: requiredText(40),
  companyLabel: requiredText(40),
  submitLabel: requiredText(40),
  sendingLabel: requiredText(40),
  privacy: requiredText(300),
  privacyLink: linkSchema,
});

const tierCopySchema = z.object({ name: requiredText(60), summary: requiredText(300) });

const resultSchema = z.object({
  heading: requiredText(120),
  rangeHeading: requiredText(60),
  breakdownHeading: requiredText(80),
  moversHeading: requiredText(80),
  monthlyHeading: requiredText(80),
  answersHeading: requiredText(80),
  /** The band the range falls in, by name. */
  tiers: z.object({
    focused: tierCopySchema,
    platform: tierCopySchema,
    beyond: tierCopySchema,
  }),
  /** A breakdown line the project type already covers. */
  included: requiredText(40),
  /** "{plan}: from {amount} a month". */
  monthlyFrom: requiredText(80),
  monthlyNone: requiredText(120),
  /** "{question}: {option}". */
  moverChoose: requiredText(80),
  /** "Without {option}". */
  moverDrop: requiredText(80),
  /** "About {range} less". */
  saving: requiredText(80),
  noMovers: requiredText(300),
  note: requiredText(600),
  /** "A copy is on its way to {email}." */
  emailed: requiredText(200),
  /** Shown when the estimate could not be stored or emailed. */
  unsent: requiredText(400),
  bookHeading: requiredText(120),
  bookBody: requiredText(400),
  bookLabel: requiredText(60),
});

const errorsSchema = z.object({
  invalid: requiredText(200),
  botCheck: requiredText(200),
  rateLimited: requiredText(200),
  unavailable: requiredText(200),
});

const emailSchema = z.object({
  heading: requiredText(120),
  intro: requiredText(400),
  methodologyLabel: requiredText(60),
});

export const calculatorPageContentSchema = z.object({
  seo: pageSeoSchema,
  hero: z.object({
    title: requiredText(90),
    /** Two or three sentences with the honest range, before anything promotional. */
    answer: answerBlockSchema,
    intro: requiredText(500),
    backdrop: decorativeImageSchema.nullable().default(null),
    points: z.array(requiredText(140)).max(4).default([]),
    /** Heading of the published bands beside the hero copy. */
    bandsHeading: requiredText(80),
    bandsNote: requiredText(300),
    bandsEmpty: requiredText(200),
  }),
  calculator: z.object({
    heading: questionSchema(140),
    intro: requiredText(500),
    /** How long one question takes, used for the time remaining on the progress bar. */
    secondsPerStep: z.number().int().min(5).max(180).default(20),
    labels: labelsSchema,
    steps: stepsCopySchema,
    gate: gateSchema,
    result: resultSchema,
    errors: errorsSchema,
    email: emailSchema,
  }),
  methodology: z.object({
    heading: questionSchema(140),
    intro: requiredText(500),
    sections: z
      .array(z.object({ heading: questionSchema(140), paragraphs: z.array(requiredText(900)).min(1).max(4) }))
      .min(1)
      .max(8),
    rateHeading: questionSchema(140),
    rateIntro: requiredText(500),
    rateNote: requiredText(600),
    /** Column headings of the rate table. */
    rateColumns: z.object({ option: requiredText(40), amount: requiredText(40) }),
  }),
  faq: z.object({ heading: questionSchema(140), intro: requiredText(400) }),
  cta: z.object({
    heading: requiredText(140),
    body: requiredText(400),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable().default(null),
  }),
});

export type CalculatorPageContent = z.output<typeof calculatorPageContentSchema>;
export type CalculatorPageContentInput = z.input<typeof calculatorPageContentSchema>;
export type CalculatorStepCopy = CalculatorPageContent['calculator']['steps'][CalculatorStepKey];

const calculatorTierViewSchema = z.object({
  name: requiredText(60),
  priceLabel: requiredText(40),
  summary: requiredText(300),
  highlighted: z.boolean(),
});

const calculatorRateGroupSchema = z.object({
  step: z.enum(CALCULATOR_STEP_KEYS),
  title: requiredText(40),
  rows: z.array(z.object({ label: requiredText(80), value: requiredText(60) })).min(1),
});
export type CalculatorRateGroup = z.output<typeof calculatorRateGroupSchema>;

/** `GET /pages/cost-calculator`. */
export const calculatorPageViewSchema = z.object({
  content: calculatorPageContentSchema,
  /** The published price bands (`PricingTier`), as on /pricing/. */
  tiers: z.array(calculatorTierViewSchema),
  /** What each answer adds, published in the methodology section. */
  rates: z.array(calculatorRateGroupSchema),
  /** Questions in the `calculator` FAQ group. */
  faqs: z.array(faqItemSchema),
  events: calculatorEventsSchema,
});
export type CalculatorPageView = z.output<typeof calculatorPageViewSchema>;

// ---------------------------------------------------------------- presenting a result

function optionLabel(content: CalculatorPageContent, step: CalculatorStepKey, option: string): string {
  const options: Record<string, { label: string }> = content.calculator.steps[step].options;
  return Object.hasOwn(options, option) ? (options[option]?.label ?? option) : option;
}

function answerLabel(content: CalculatorPageContent, step: CalculatorStepKey, answers: CalculatorAnswers): string {
  const value = answers[step];
  return Array.isArray(value)
    ? value.map((item) => optionLabel(content, step, item)).join(', ')
    : optionLabel(content, step, value);
}

/** The answer behind a breakdown line; the schedule line names the timeline chosen. */
function lineDetail(content: CalculatorPageContent, step: CalculatorLineStep, answers: CalculatorAnswers): string {
  return answerLabel(content, step, answers);
}

/**
 * The estimate in words: the range, the band, the breakdown, what would move it and the
 * consultation link carrying the answers. The page renders it and the emailed copy repeats
 * it, so the visitor reads the same figures in both.
 */
export function presentCalculatorResult(
  estimate: CalculatorEstimate,
  answers: CalculatorAnswers,
  content: CalculatorPageContent,
): CalculatorPresentedResult {
  const copy = content.calculator.result;
  const steps = content.calculator.steps;
  const tier = copy.tiers[estimate.tier];

  const breakdown: CalculatorResultRow[] = estimate.lines.map((line) => ({
    label: steps[line.step].title,
    detail: lineDetail(content, line.step, answers),
    value: line.low === 0 && line.high === 0 ? copy.included : formatUsdRange(line.low, line.high),
  }));

  const movers: CalculatorResultRow[] = estimate.movers.map((mover) => ({
    label:
      mover.change === 'drop'
        ? fillTemplate(copy.moverDrop, { option: optionLabel(content, mover.step, mover.option) })
        : fillTemplate(copy.moverChoose, {
            question: steps[mover.step].title,
            option: optionLabel(content, mover.step, mover.option),
          }),
    detail: null,
    value: fillTemplate(copy.saving, { range: formatUsdRange(mover.low, mover.high) }),
  }));

  return calculatorPresentedResultSchema.parse({
    rangeLabel: formatUsdRange(estimate.low, estimate.high),
    tierName: tier.name,
    tierSummary: tier.summary,
    monthly:
      estimate.monthlyFrom === null
        ? copy.monthlyNone
        : fillTemplate(copy.monthlyFrom, {
            plan: optionLabel(content, 'support', answers.support),
            amount: formatUsd(estimate.monthlyFrom),
          }),
    breakdown,
    movers,
    noMovers: copy.noMovers,
    answers: CALCULATOR_STEP_KEYS.map((step) => ({
      label: steps[step].title,
      detail: null,
      value: answerLabel(content, step, answers),
    })),
    note: copy.note,
    bookingPath: calculatorBookingPath(answers),
  });
}

/** The same result, plus the words the email wraps it in. */
export function calculatorResultEmail(
  result: CalculatorPresentedResult,
  content: CalculatorPageContent,
): CalculatorResultEmail {
  const copy = content.calculator.result;
  return calculatorResultEmailSchema.parse({
    ...result,
    heading: content.calculator.email.heading,
    intro: content.calculator.email.intro,
    rangeHeading: copy.rangeHeading,
    breakdownHeading: copy.breakdownHeading,
    moversHeading: copy.moversHeading,
    monthlyHeading: copy.monthlyHeading,
    answersHeading: copy.answersHeading,
    bookingLabel: copy.bookLabel,
    methodologyLabel: content.calculator.email.methodologyLabel,
    methodologyPath: `${CALCULATOR_PATH}#${CALCULATOR_ANCHORS.methodology}`,
  });
}

// ---------------------------------------------------------------- the published rates

const RATE_STEPS = ['projectType', 'pageCount', 'designDepth', 'content', 'integrations', 'cms'] as const;

const RATE_TABLES: Record<(typeof RATE_STEPS)[number], Readonly<Record<string, readonly [number, number]>>> = {
  projectType: CALCULATOR_RATES.projectType,
  pageCount: CALCULATOR_RATES.pageCount,
  designDepth: CALCULATOR_RATES.designDepth,
  content: CALCULATOR_RATES.content,
  integrations: CALCULATOR_RATES.integrations,
  cms: CALCULATOR_RATES.cms,
};

/**
 * What every answer adds, published in the methodology section so the number on screen can
 * be checked by hand. The figures come from the model, the words from the page copy.
 */
export function calculatorRateTable(content: CalculatorPageContent): CalculatorRateGroup[] {
  const included = content.calculator.result.included;
  return RATE_STEPS.map((step) => ({
    step,
    title: content.calculator.steps[step].title,
    rows: CALCULATOR_OPTIONS[step]
      .filter((option) => !(step === 'integrations' && option === CALCULATOR_NO_INTEGRATIONS))
      .map((option) => {
        const [low, high] = RATE_TABLES[step][option] ?? [0, 0];
        return {
          label: optionLabel(content, step, option),
          value: low === 0 && high === 0 ? included : formatUsdRange(low, high),
        };
      }),
  }));
}

/** Every line step, in the order the breakdown shows them. */
export const CALCULATOR_BREAKDOWN_STEPS = CALCULATOR_LINE_STEPS;
export const CALCULATOR_RESULT_TIERS = CALCULATOR_TIERS;
