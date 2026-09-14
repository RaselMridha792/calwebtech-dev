import { describe, expect, it } from 'vitest';
import {
  CALCULATOR_OPTIONS,
  CALCULATOR_STEP_KEYS,
  estimateProject,
  type CalculatorAnswers,
  type CalculatorStepKey,
} from '../calculator';
import {
  calculatorPageContentSchema,
  calculatorRateTable,
  calculatorResultEmail,
  fillTemplate,
  presentCalculatorResult,
  type CalculatorPageContent,
  type CalculatorPageContentInput,
} from './calculator';

/** Copy in the shape a person would write, with one label per stored answer value. */
function stepCopy(step: CalculatorStepKey) {
  const options = Object.fromEntries(
    CALCULATOR_OPTIONS[step].map((option) => [option, { label: `${step}: ${option}`, description: null }]),
  );
  return { title: step, question: `Which ${step}?`, help: null, options };
}

const CONTENT_INPUT: CalculatorPageContentInput = {
  seo: { title: 'Website cost calculator', description: 'An indicative range in eight questions.' },
  hero: {
    title: 'Website cost calculator',
    answer:
      'A Calwebtech website costs between twelve thousand and sixty thousand dollars, depending on scope. This tool asks eight questions and gives you the range for your own project. Nothing is sent until you ask for it.',
    intro: 'Eight questions, an indicative range, and the reasoning behind it.',
    points: ['No sales call required'],
    bandsHeading: 'The bands we quote from',
    bandsNote: 'Published so you can tell quickly whether we are in your range.',
    bandsEmpty: 'Our bands are being updated. Ask us for a quote instead.',
  },
  calculator: {
    heading: 'What will your website cost?',
    intro: 'Answer eight questions.',
    labels: {
      progress: 'Question {current} of {total}',
      gateProgress: 'Last step: where to send it',
      timeLeft: 'About {minutes} minutes left',
      timeLeftOne: 'About a minute left',
      timeLeftShort: 'Under a minute left',
      back: 'Back',
      next: 'Next',
      toResult: 'See my range',
      restart: 'Start again',
      chooseOne: 'Choose one answer to continue.',
      chooseAtLeastOne: 'Choose at least one answer, or "none of these".',
      start: 'Start the estimate',
      methodology: 'How we work this out',
      loading: 'Loading the calculator',
      noScript: 'The calculator needs JavaScript. Call us and we will do it with you.',
    },
    steps: Object.fromEntries(CALCULATOR_STEP_KEYS.map((step) => [step, stepCopy(step)])) as CalculatorPageContentInput['calculator']['steps'],
    gate: {
      heading: 'Where shall we send it?',
      body: 'We email the range and the breakdown.',
      nameLabel: 'Full name',
      emailLabel: 'Work email',
      companyLabel: 'Company',
      submitLabel: 'Show my range',
      sendingLabel: 'Working it out…',
      privacy: 'We store your answers in our own database.',
      privacyLink: { label: 'Privacy policy', href: '/privacy-policy/' },
    },
    result: {
      heading: 'Your indicative range',
      rangeHeading: 'The range',
      breakdownHeading: 'Where the number comes from',
      moversHeading: 'What would move it',
      monthlyHeading: 'Ongoing',
      answersHeading: 'What you told us',
      tiers: {
        focused: { name: 'Focused build', summary: 'Marketing site, custom design, CMS and lead capture.' },
        platform: { name: 'Platform build', summary: 'Everything above plus booking, dashboards and integrations.' },
        beyond: { name: 'Beyond the published bands', summary: 'Larger than our published bands; we scope it in stages.' },
      },
      included: 'Included',
      monthlyFrom: '{plan}: from {amount} a month',
      monthlyNone: 'No ongoing plan chosen.',
      moverChoose: '{question}: {option}',
      moverDrop: 'Without {option}',
      saving: 'About {range} less',
      noMovers: 'This is already the leanest version of this project.',
      note: 'Indicative only. A fixed price follows discovery.',
      emailed: 'A copy is on its way to {email}.',
      unsent: 'We could not save or email this just now.',
      bookHeading: 'Talk it through',
      bookBody: 'Bring your answers to a call.',
      bookLabel: 'Book a consultation',
    },
    errors: {
      invalid: 'Please check the highlighted fields.',
      botCheck: 'We could not confirm this came from a person.',
      rateLimited: 'Please wait a minute and try again.',
      unavailable: 'We could not send that just now.',
    },
    email: { heading: 'Your website cost estimate', intro: 'Here is the range.' },
  },
  methodology: {
    heading: 'How does this calculator work?',
    intro: 'The figures come from a published model.',
    sections: [{ heading: 'Where do the figures come from?', paragraphs: ['From delivered projects.'] }],
    rateHeading: 'What does each answer add?',
    rateIntro: 'Every line published.',
    rateNote: 'A compressed schedule adds a share of the build.',
    rateColumns: { option: 'Answer', amount: 'Adds' },
  },
  faq: { heading: 'What else do buyers ask?', intro: 'Straight answers.' },
  cta: {
    heading: 'Want a fixed price?',
    body: 'Send us the detail and we reply with a proposal.',
    primaryCta: { label: 'Book a consultation', href: '/book-a-consultation/' },
  },
};

const content: CalculatorPageContent = calculatorPageContentSchema.parse(CONTENT_INPUT);

const answers: CalculatorAnswers = {
  projectType: 'redesign',
  timeline: 'within-8-weeks',
  pageCount: '50-150',
  designDepth: 'custom-design',
  content: 'write-it-for-us',
  integrations: ['crm', 'erp-inventory'],
  cms: 'headless',
  support: 'care-plan',
};

describe('calculatorPageContentSchema', () => {
  it('accepts copy with one label per stored answer value', () => {
    expect(content.calculator.steps.pageCount.options['50-150'].label).toBe('pageCount: 50-150');
  });

  it('refuses copy that leaves an answer without a label', () => {
    const missing = structuredClone(CONTENT_INPUT);
    const steps = missing.calculator.steps as unknown as Record<string, { options: Record<string, unknown> }>;
    delete steps.cms?.options.shopify;
    expect(calculatorPageContentSchema.safeParse(missing).success).toBe(false);
  });

  it('holds the section headings to questions a buyer types', () => {
    const plain = structuredClone(CONTENT_INPUT);
    plain.methodology.heading = 'Our methodology';
    expect(calculatorPageContentSchema.safeParse(plain).success).toBe(false);
  });

  it('holds the hero answer to two or three sentences', () => {
    const short = structuredClone(CONTENT_INPUT);
    short.hero.answer = 'It depends on the project.';
    expect(calculatorPageContentSchema.safeParse(short).success).toBe(false);
  });
});

describe('presentCalculatorResult', () => {
  const estimate = estimateProject(answers);
  const result = presentCalculatorResult(estimate, answers, content);

  it('states the range, the band and the ongoing plan in the page words', () => {
    expect(result.rangeLabel).toBe(`$${estimate.low.toLocaleString('en-US')} to $${estimate.high.toLocaleString('en-US')}`);
    expect(result.tierName).toBe('Platform build');
    expect(result.monthly).toBe('support: care-plan: from $1,500 a month');
  });

  it('shows a breakdown line per priced answer, adding up to the range', () => {
    expect(result.breakdown.map((row) => row.label)).toEqual([
      'projectType',
      'pageCount',
      'designDepth',
      'content',
      'integrations',
      'cms',
      'timeline',
    ]);
    expect(result.breakdown.find((row) => row.label === 'cms')?.value).toBe('Included');
    expect(result.breakdown.find((row) => row.label === 'integrations')?.detail).toBe(
      'integrations: crm, integrations: erp-inventory',
    );
  });

  it('lists every answer, so the visitor can check what the figures answer to', () => {
    expect(result.answers).toHaveLength(CALCULATOR_STEP_KEYS.length);
    expect(result.answers[0]).toEqual({ label: 'projectType', detail: null, value: 'projectType: redesign' });
  });

  it('names what would move the range, with the saving', () => {
    expect(result.movers.length).toBeGreaterThan(0);
    for (const mover of result.movers) expect(mover.value).toMatch(/^About \$[\d,]+( to \$[\d,]+)? less$/);
  });

  it('carries the answers to the booking page', () => {
    expect(result.bookingPath).toContain('/book-a-consultation/?source=cost-calculator');
    expect(result.bookingPath).toContain('integrations=crm%2Cerp-inventory');
  });

  it('says so plainly when no ongoing plan was chosen', () => {
    const none: CalculatorAnswers = { ...answers, support: 'none' };
    expect(presentCalculatorResult(estimateProject(none), none, content).monthly).toBe('No ongoing plan chosen.');
  });
});

describe('calculatorResultEmail', () => {
  it('repeats the result with the email headings and the two links', () => {
    const estimate = estimateProject(answers);
    const email = calculatorResultEmail(presentCalculatorResult(estimate, answers, content), content);
    expect(email.heading).toBe('Your website cost estimate');
    expect(email.rangeLabel).toBe(presentCalculatorResult(estimate, answers, content).rangeLabel);
    expect(email.methodologyPath).toBe('/cost-calculator/#methodology');
    expect(email.bookingPath.startsWith('/book-a-consultation/')).toBe(true);
  });
});

describe('calculatorRateTable', () => {
  it('publishes what every answer adds, the free ones marked as included', () => {
    const table = calculatorRateTable(content);
    expect(table.map((group) => group.step)).toEqual([
      'projectType',
      'pageCount',
      'designDepth',
      'content',
      'integrations',
      'cms',
    ]);
    const pages = table.find((group) => group.step === 'pageCount');
    expect(pages?.rows[0]).toEqual({ label: 'pageCount: under-10', value: 'Included' });
    expect(pages?.rows[1]?.value).toBe('$2,000 to $4,000');
    expect(table.find((group) => group.step === 'integrations')?.rows.some((row) => row.label.endsWith('none'))).toBe(false);
  });
});

describe('fillTemplate', () => {
  it('fills the placeholders it is given and leaves the rest alone', () => {
    expect(fillTemplate('Question {current} of {total}', { current: '3', total: '8' })).toBe('Question 3 of 8');
    expect(fillTemplate('About {minutes} minutes left', {})).toBe('About {minutes} minutes left');
  });
});
