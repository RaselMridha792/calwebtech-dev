import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CALCULATOR_PAGE_PLACEHOLDER } from '@calwebtech/db/seed';
import {
  CALCULATOR_FORM_ID,
  CALCULATOR_SETTING_KEYS,
  calculatorLeadReceivedSchema,
  calculatorPageContentSchema,
  calculatorPageViewSchema,
  estimateProject,
  leadSubmissionSchema,
  type CalculatorAnswers,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { LeadsService } from '../leads/leads.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { CalculatorPageService } from './calculator.service';
import { SubmissionGuard } from '../antispam/submission-guard';

/*
 * The cost calculator against Postgres (docs/06-build-plan.md, task 4.1): the page builds
 * from the setting, and completing the flow creates a lead whose eight answers are stored
 * as fields the inbox can be queried on.
 *
 * Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally,
 * services in CI. Every row it writes carries this run's prefix and is removed afterwards,
 * so parallel suites and the seeded placeholder rows are left alone.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv(process.env);
const prisma = new PrismaService(env);
const db = prisma.client;
const run = `it-calculator-${Date.now().toString(36)}`;

const ANSWERS: CalculatorAnswers = {
  projectType: 'ecommerce',
  timeline: 'within-8-weeks',
  pageCount: '50-150',
  designDepth: 'custom-design',
  content: 'write-it-for-us',
  integrations: ['payments', 'erp-inventory'],
  cms: 'shopify',
  support: 'ongoing-partner',
};

let createdSetting = false;

beforeAll(async () => {
  // The page needs its copy. A value someone has set already is left exactly as it is.
  const existing = await db.setting.findUnique({ where: { key: CALCULATOR_SETTING_KEYS.page } });
  if (!existing) {
    createdSetting = true;
    await db.setting.create({
      data: {
        key: CALCULATOR_SETTING_KEYS.page,
        value: calculatorPageContentSchema.parse(CALCULATOR_PAGE_PLACEHOLDER),
      },
    });
  }
});

afterAll(async () => {
  const emails = { startsWith: run };
  await db.leadActivity.deleteMany({ where: { lead: { email: emails } } });
  await db.leadAttribution.deleteMany({ where: { lead: { email: emails } } });
  await db.lead.deleteMany({ where: { email: emails } });
  await db.contact.deleteMany({ where: { email: emails } });
  if (createdSetting) await db.setting.deleteMany({ where: { key: CALCULATOR_SETTING_KEYS.page } });
  await prisma.onModuleDestroy();
});

describe('the cost calculator page against Postgres', () => {
  it('builds from the copy setting, with the published bands, questions and rates', async () => {
    const view = calculatorPageViewSchema.parse(await new CalculatorPageService(prisma).find());
    expect(view.rates.map((group) => group.step)).toContain('projectType');
    expect(view.events.steps).toHaveLength(8);
    // Bands and questions are content types: on the placeholder database there may be none.
    expect(Array.isArray(view.tiers)).toBe(true);
    expect(Array.isArray(view.faqs)).toBe(true);
  });
});

describe('calculator leads against Postgres', () => {
  // No Turnstile secret outside production stores the lead without a verdict; no emails are sent.
  const queued: unknown[] = [];
  const emailQueue = { enqueue: (jobs: unknown[]) => Promise.resolve(void queued.push(...jobs)) } as unknown as EmailQueue;
  const leads = new LeadsService(
    prisma,
    new TurnstileService('', fetch, 15_000),
    new SettingsService(prisma),
    emailQueue,
    SubmissionGuard.off(),
  );

  const submission = (name: string, answers: unknown) =>
    leadSubmissionSchema.parse({
      type: 'CALCULATOR',
      formId: CALCULATOR_FORM_ID,
      name: 'Integration Person',
      email: `${run}.${name}@example.com`,
      company: 'Example Client',
      answers,
      attribution: {},
    });

  it('stores all eight answers as fields the inbox can be queried on, with the range it computed', async () => {
    const input = submission('complete', ANSWERS);
    const received = calculatorLeadReceivedSchema.parse(await leads.create(input, '203.0.113.11'));
    const expected = estimateProject(ANSWERS);
    expect(received.estimate.low).toBe(expected.low);
    expect(received.estimate.high).toBe(expected.high);

    const lead = await db.lead.findFirstOrThrow({ where: { email: input.email } });
    expect(lead.type).toBe('CALCULATOR');
    // The band comes from the figure the API calculated, not from anything the visitor chose.
    expect(lead.budgetBand).toBe(expected.budgetBand);
    expect(lead.projectType).toBe(ANSWERS.projectType);
    expect(lead.answers).toMatchObject({ ...ANSWERS, estimate: { low: expected.low, high: expected.high } });

    // The gate for task 4.1: each answer is its own queryable field on the lead.
    const byPageCount = await db.lead.findMany({
      where: { email: input.email, answers: { path: ['pageCount'], equals: ANSWERS.pageCount } },
      select: { id: true },
    });
    expect(byPageCount.map((row) => row.id)).toEqual([lead.id]);
    const byOtherPageCount = await db.lead.findMany({
      where: { email: input.email, answers: { path: ['pageCount'], equals: 'under-10' } },
    });
    expect(byOtherPageCount).toEqual([]);
  });

  it('queues the visitor a copy of the result rather than the standard confirmation', () => {
    const templates = queued.map((job) => (job as { template: string }).template);
    expect(templates).toContain('calculator-result');
    expect(templates).not.toContain('lead-confirmation');
    const copy = queued.find((job) => (job as { template: string }).template === 'calculator-result');
    expect(JSON.stringify(copy)).toContain('/book-a-consultation/?source=cost-calculator');
  });

  it('refuses a calculator lead with no answers, so no estimate is invented', async () => {
    await expect(leads.create(submission('empty', undefined), '203.0.113.11')).rejects.toThrow();
    expect(await db.lead.findFirst({ where: { email: `${run}.empty@example.com` } })).toBeNull();
  });

  it('refuses an answer the pricing model does not recognise', () => {
    const parsed = leadSubmissionSchema.safeParse({
      type: 'CALCULATOR',
      formId: CALCULATOR_FORM_ID,
      name: 'Integration Person',
      email: `${run}.unknown@example.com`,
      answers: { ...ANSWERS, pageCount: 'a-thousand' },
      attribution: {},
    });
    expect(parsed.success).toBe(false);
  });
});
