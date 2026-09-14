import type { PrismaClient } from '@calwebtech/db';
import { CALCULATOR_PAGE_PLACEHOLDER } from '@calwebtech/db/seed';
import {
  CALCULATOR_SETTING_KEYS,
  estimateProject,
  type CalculatorAnswers,
  type LeadSubmission,
} from '@calwebtech/shared';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { calculatorLeadOutcome } from './calculator-lead';

const ANSWERS: CalculatorAnswers = {
  projectType: 'ecommerce',
  timeline: 'within-4-months',
  pageCount: '50-150',
  designDepth: 'custom-design',
  content: 'write-it-for-us',
  integrations: ['crm', 'payments'],
  cms: 'headless',
  support: 'care-plan',
};

/** A client that answers with one setting value, and records what was asked for. */
function db(settingValue: unknown): { client: PrismaClient; keys: string[] } {
  const keys: string[] = [];
  const client = {
    setting: {
      findUnique: ({ where }: { where: { key: string } }) => {
        keys.push(where.key);
        return Promise.resolve(settingValue === undefined ? null : { value: settingValue });
      },
    },
  };
  return { client: client as unknown as PrismaClient, keys };
}

function submission(overrides: Partial<LeadSubmission> = {}): LeadSubmission {
  return {
    type: 'CALCULATOR',
    formId: 'cost-calculator',
    name: 'Sample Visitor',
    email: 'visitor@example.com',
    serviceInterest: [],
    attribution: {},
    answers: ANSWERS,
    ...overrides,
  };
}

describe('calculatorLeadOutcome', () => {
  it('computes the estimate from the answers itself, whatever the browser sent', async () => {
    const { client } = db(CALCULATOR_PAGE_PLACEHOLDER);
    const outcome = await calculatorLeadOutcome(client, submission());
    expect(outcome.estimate).toEqual(estimateProject(ANSWERS));
    expect(outcome.estimate.tier).toBe('platform');
  });

  it('stores every answer as a field beside the estimate the API stands behind', async () => {
    const { client } = db(CALCULATOR_PAGE_PLACEHOLDER);
    const { stored, estimate } = await calculatorLeadOutcome(client, submission());
    expect(stored.pageCount).toBe('50-150');
    expect(stored.integrations).toEqual(['crm', 'payments']);
    expect(stored.estimate).toEqual({
      modelVersion: estimate.modelVersion,
      currency: 'USD',
      low: estimate.low,
      high: estimate.high,
      tier: estimate.tier,
      budgetBand: estimate.budgetBand,
      monthlyFrom: estimate.monthlyFrom,
    });
  });

  it('builds the emailed copy from the page copy, so the email repeats what was on screen', async () => {
    const { client, keys } = db(CALCULATOR_PAGE_PLACEHOLDER);
    const outcome = await calculatorLeadOutcome(client, submission());
    expect(keys).toEqual([CALCULATOR_SETTING_KEYS.page]);
    expect(outcome.email?.rangeLabel).toContain('$');
    expect(outcome.email?.breakdown).toHaveLength(outcome.estimate.lines.length);
    expect(outcome.email?.bookingPath.startsWith('/book-a-consultation/?source=cost-calculator')).toBe(true);
    expect(outcome.email?.methodologyPath).toBe('/cost-calculator/#methodology');
  });

  it('still stores the answers and the estimate when the page copy is missing', async () => {
    const { client } = db(undefined);
    const outcome = await calculatorLeadOutcome(client, submission());
    expect(outcome.email).toBeNull();
    expect(outcome.estimate.low).toBeGreaterThan(0);
  });

  it('refuses a calculator submission with no answers', async () => {
    const { client } = db(CALCULATOR_PAGE_PLACEHOLDER);
    await expect(calculatorLeadOutcome(client, submission({ answers: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
