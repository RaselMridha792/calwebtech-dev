import {
  CALCULATOR_OPTIONS,
  CALCULATOR_SETTING_KEYS,
  CALCULATOR_STEP_KEYS,
  calculatorPageContentSchema,
  type CalculatorPageContentInput,
  type CalculatorStepKey,
} from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Copy of `/cost-calculator/` for the placeholder database (content.ts rules): placeholder
 * words, no figures, names, vendors or promises. The publish-ready copy lives in
 * apps/web/static-content/calculator. The questions and answers themselves are fixed by the
 * pricing model in packages/shared; only their words are seeded here, one label per stored
 * answer value, so the page renders and the flow works against the placeholder database.
 */

const ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

function stepCopy(step: CalculatorStepKey, index: number) {
  const options = Object.fromEntries(
    CALCULATOR_OPTIONS[step].map((option, position) => [
      option,
      { label: `Placeholder answer ${ORDINALS[position] ?? String(position)}`, description: null },
    ]),
  );
  return {
    title: `Placeholder question ${ORDINALS[index] ?? String(index)}`,
    question: `Placeholder question ${ORDINALS[index] ?? String(index)}?`,
    help: null,
    options,
  };
}

const steps = Object.fromEntries(
  CALCULATOR_STEP_KEYS.map((step, index) => [step, stepCopy(step, index)]),
) as CalculatorPageContentInput['calculator']['steps'];

export const CALCULATOR_PAGE_PLACEHOLDER: CalculatorPageContentInput = {
  seo: {
    title: 'Placeholder cost calculator title',
    description: 'Placeholder description of the cost calculator. The approved copy replaces it before launch.',
  },
  hero: {
    title: 'Placeholder cost calculator heading',
    answer:
      'Placeholder answer for the cost calculator. The approved two to three sentence answer, with the published range, replaces this text before launch.',
    intro: 'Placeholder. The approved copy says what the tool does and how long it takes.',
    backdrop: null,
    points: [],
    bandsHeading: 'Placeholder bands heading',
    bandsNote: 'Placeholder. The approved copy introduces the published bands.',
    bandsEmpty: 'No price bands are published yet.',
  },
  calculator: {
    heading: 'Placeholder calculator question?',
    intro: 'Placeholder. The approved copy introduces the questions.',
    secondsPerStep: 20,
    labels: {
      progress: 'Question {current} of {total}',
      gateProgress: 'Last step: where to send it',
      progressName: 'Your progress through the estimate',
      timeLeft: 'About {minutes} minutes left',
      timeLeftOne: 'About a minute left',
      timeLeftShort: 'Under a minute left',
      back: 'Back',
      next: 'Next',
      toResult: 'See the range',
      restart: 'Start again',
      chooseOne: 'Choose an answer to continue.',
      chooseAtLeastOne: 'Choose at least one answer to continue.',
      start: 'Start the estimate',
      methodology: 'Placeholder methodology link label',
      loading: 'Loading the calculator',
      noScript: 'The calculator needs JavaScript in the browser. Placeholder alternative for people without it.',
    },
    steps,
    gate: {
      heading: 'Placeholder email step heading',
      body: 'Placeholder. The approved copy says what is sent and why an address is asked for.',
      nameLabel: 'Full name',
      emailLabel: 'Work email',
      companyLabel: 'Company',
      submitLabel: 'Show the range',
      sendingLabel: 'Working it out…',
      privacy: 'Placeholder. The approved copy says where the answers are stored.',
      privacyLink: { label: 'Privacy policy', href: '/privacy-policy/' },
    },
    result: {
      heading: 'Placeholder result heading',
      rangeHeading: 'Placeholder range heading',
      breakdownHeading: 'Placeholder breakdown heading',
      moversHeading: 'Placeholder heading for what would move it',
      monthlyHeading: 'Placeholder ongoing heading',
      answersHeading: 'Placeholder answers heading',
      tiers: {
        focused: { name: 'Placeholder band one', summary: 'Placeholder. The approved copy describes this band.' },
        platform: { name: 'Placeholder band two', summary: 'Placeholder. The approved copy describes this band.' },
        beyond: { name: 'Placeholder band three', summary: 'Placeholder. The approved copy describes this band.' },
      },
      included: 'Included',
      monthlyFrom: '{plan}: from {amount} a month',
      monthlyNone: 'No ongoing plan chosen.',
      moverChoose: '{question}: {option}',
      moverDrop: 'Without {option}',
      saving: 'About {range} less',
      noMovers: 'Placeholder. The approved copy says what happens when nothing would lower the range.',
      note: 'Placeholder. The approved copy says how indicative the range is and what fixes it.',
      emailed: 'A copy is on its way to {email}.',
      unsent: 'We could not save your answers or email this copy just now. Nothing was sent.',
      bookHeading: 'Placeholder next step heading',
      bookBody: 'Placeholder. The approved copy invites the visitor to talk it through.',
      bookLabel: 'Book a consultation',
    },
    errors: {
      invalid: 'Please check the highlighted fields.',
      botCheck: 'We could not confirm this request came from a person. Please try again.',
      rateLimited: 'You have sent several requests in a row. Please wait a minute and try again.',
      unavailable: 'We could not send that just now. Please try again, or call us.',
    },
    email: {
      heading: 'Placeholder email heading',
      intro: 'Placeholder. The approved copy introduces the emailed copy of the result.',
    },
  },
  methodology: {
    heading: 'Placeholder methodology question?',
    intro: 'Placeholder. The approved copy explains where the figures come from.',
    sections: [
      {
        heading: 'Placeholder methodology question one?',
        paragraphs: ['Placeholder. The approved copy answers this question.'],
      },
    ],
    rateHeading: 'Placeholder rate table question?',
    rateIntro: 'Placeholder. The approved copy introduces the published rates.',
    rateNote: 'Placeholder. The approved copy explains the schedule and the ongoing plans.',
    rateContentRow: '{option} ({pages})',
    rateColumns: { option: 'Answer', amount: 'Adds' },
  },
  faq: {
    heading: 'Placeholder questions heading?',
    intro: 'Placeholder. The approved copy introduces the pricing questions.',
  },
  cta: {
    heading: 'Placeholder closing heading',
    body: 'Placeholder. The approved copy invites the next step.',
    primaryCta: { label: 'Placeholder primary link', href: '/contact/' },
    secondaryCta: null,
  },
};

/**
 * Every word this seed writes, for the scan in content.test.ts. The object's keys are not
 * copy: they are the stored answer values of the pricing model (`cms: "wordpress"`), the
 * same way a budget band is stored as `25k-60k`. Only the strings a visitor reads are
 * scanned, so a platform name in a key is never mistaken for a claim about the business.
 */
export function calculatorPlaceholderCopy(value: unknown = CALCULATOR_PAGE_PLACEHOLDER): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => calculatorPlaceholderCopy(item));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item) => calculatorPlaceholderCopy(item));
  }
  return [];
}

export const calculatorSeed: PageSeed = {
  family: 'calculator',
  content: calculatorPlaceholderCopy(),
  /** Creates the setting once; a value someone has set since is never overwritten. */
  async seed(db: PrismaClient): Promise<void> {
    const value = calculatorPageContentSchema.parse(CALCULATOR_PAGE_PLACEHOLDER) as Prisma.InputJsonObject;
    await db.setting.upsert({
      where: { key: CALCULATOR_SETTING_KEYS.page },
      create: { key: CALCULATOR_SETTING_KEYS.page, value },
      update: {},
    });
  },
};
