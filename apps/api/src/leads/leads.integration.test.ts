import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@calwebtech/db';
import {
  EMAIL_QUEUE,
  SETTING_KEYS,
  acknowledgementSchema,
  emailOutboxJobId,
  homePageContentSchema,
  type LeadSubmission,
  type LeadSummary,
} from '@calwebtech/shared';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';
import { LeadsService } from './leads.service';
import { SubmissionGuard } from '../antispam/submission-guard';

// Needs a migrated and seeded Postgres and a Redis: infra/docker-compose.yml with the dev
// overrides locally, services in CI. Turnstile calls reach Cloudflare with its test keys.
// Nothing is sent: jobs go to a queue no worker consumes and are inspected directly.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const prisma = new PrismaService(env);
const db = prisma.client;
const queueName = `${EMAIL_QUEUE}-leads-integration-${String(process.pid)}-${String(Date.now())}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });
const settings = new SettingsService(prisma);

const leadsWith = (secret: string) =>
  new LeadsService(prisma, new TurnstileService(secret, fetch, 15_000), settings, emailQueue, SubmissionGuard.off());

const run = Date.now().toString(36);
let sequence = 0;
function submission(overrides: Partial<LeadSubmission> = {}): LeadSubmission {
  sequence += 1;
  return {
    type: 'PROJECT',
    formId: 'lp-hero',
    name: 'Integration Test',
    email: `integration+${run}-${String(sequence)}@example.com`,
    budgetBand: '25k-60k',
    serviceInterest: ['Redesign'],
    landingPageSlug: 'b2b-website-design',
    attribution: { lastTouch: { source: 'integration' }, landingPage: '/lp/b2b-website-design/' },
    turnstileToken: TURNSTILE_TEST.dummyToken,
    ...overrides,
  };
}

const recipientsKey = SETTING_KEYS.leadNotificationRecipients;
let originalRecipients: Prisma.JsonValue | undefined;

async function setRecipients(emails: string[]): Promise<void> {
  await db.setting.upsert({
    where: { key: recipientsKey },
    create: { key: recipientsKey, value: { emails } },
    update: { value: { emails } },
  });
}

async function storedLead(email: string) {
  return db.lead.findFirstOrThrow({ where: { email }, include: { attribution: true, activities: true } });
}

/**
 * A lead's email of one template, as its transaction committed it to the outbox, and the job
 * that names it (docs/08-decisions.md, 71). The job carries only the row's id.
 */
async function outboxEmail(leadId: string, template: string) {
  const row = await db.emailOutbox.findFirst({ where: { leadId, template } });
  return { row, payload: row?.payload, job: row ? await inspect.getJob(emailOutboxJobId(row.id)) : undefined };
}

beforeAll(async () => {
  originalRecipients = (await db.setting.findUnique({ where: { key: recipientsKey } }))?.value;
});

afterAll(async () => {
  if (originalRecipients === undefined) {
    await db.setting.deleteMany({ where: { key: recipientsKey } });
  } else {
    await db.setting.update({ where: { key: recipientsKey }, data: { value: originalRecipients as Prisma.InputJsonValue } });
  }
  const testEmails = { startsWith: `integration+${run}-` };
  await db.lead.deleteMany({ where: { email: testEmails } });
  await db.contact.deleteMany({ where: { email: testEmails } });
  await db.enquiryType.deleteMany({ where: { slug: { startsWith: `integration-${run}-` } } });
  await inspect.obliterate({ force: true });
  await inspect.close();
  await inspectConnection.quit();
  await emailQueue.onModuleDestroy();
  await prisma.onModuleDestroy();
});

describe('LeadsService against Postgres, Redis and Turnstile test keys', () => {
  it('stores the lead with attribution and both emails with the exact payloads, and queues them', async () => {
    await setRecipients(['leads@example.com']);
    const input = submission();
    await leadsWith(TURNSTILE_TEST.alwaysPassesSecret).create(input, '203.0.113.7');

    const lead = await storedLead(input.email);
    expect(lead.attribution?.formId).toBe('lp-hero');
    expect(lead.attribution?.landingPageId).not.toBeNull();
    expect(lead.activities.map((activity) => activity.type)).toEqual(['form_submitted']);

    const page = await db.landingPage.findUniqueOrThrow({ where: { slug: 'b2b-website-design' } });
    const acknowledgement = acknowledgementSchema.parse((page.content as Record<string, unknown>).formSuccess);
    const expectedLead: LeadSummary = {
      leadId: lead.id,
      type: 'PROJECT',
      formId: 'lp-hero',
      name: 'Integration Test',
      email: input.email,
      budgetBand: '25k-60k',
      serviceInterest: ['Redesign'],
      landingPageSlug: 'b2b-website-design',
      attribution: input.attribution,
      submittedAt: lead.createdAt.toISOString(),
    };

    const confirmation = await outboxEmail(lead.id, 'lead-confirmation');
    expect(confirmation.payload).toEqual({
      template: 'lead-confirmation',
      to: [input.email],
      lead: expectedLead,
      acknowledgement,
    });
    expect(confirmation.job?.name).toBe('lead-confirmation');
    expect(confirmation.job?.data).toEqual({ outboxId: confirmation.row?.id });
    expect(confirmation.job?.opts.attempts).toBe(5);
    expect(confirmation.row?.queuedAt).not.toBeNull();

    const notification = await outboxEmail(lead.id, 'lead-notification');
    expect(notification.payload).toEqual({ template: 'lead-notification', to: ['leads@example.com'], lead: expectedLead });
    expect(notification.job?.data).toEqual({ outboxId: notification.row?.id });
  });

  it('refuses the always-fail Turnstile key and stores and queues nothing', async () => {
    await setRecipients(['leads@example.com']);
    const before = await inspect.getJobCounts('waiting', 'prioritized', 'delayed');
    const outboxBefore = await db.emailOutbox.count();
    const input = submission();

    await expect(leadsWith(TURNSTILE_TEST.alwaysFailsSecret).create(input, '203.0.113.7')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(await db.lead.count({ where: { email: input.email } })).toBe(0);
    expect(await db.contact.count({ where: { email: input.email } })).toBe(0);
    expect(await db.emailOutbox.count()).toBe(outboxBefore);
    expect(await inspect.getJobCounts('waiting', 'prioritized', 'delayed')).toEqual(before);
  });

  it('reads the recipients setting on every lead, so changing it needs no restart', async () => {
    const leads = leadsWith(TURNSTILE_TEST.alwaysPassesSecret);

    await setRecipients(['first@example.com']);
    const first = submission();
    await leads.create(first, undefined);

    await setRecipients(['second@example.com', 'owner@example.com']);
    const second = submission();
    await leads.create(second, undefined);

    const firstEmail = await outboxEmail((await storedLead(first.email)).id, 'lead-notification');
    const secondEmail = await outboxEmail((await storedLead(second.email)).id, 'lead-notification');
    expect(firstEmail.payload).toMatchObject({ to: ['first@example.com'] });
    expect(secondEmail.payload).toMatchObject({ to: ['second@example.com', 'owner@example.com'] });
  });

  it('still confirms to the visitor when no recipients are set, and records the skipped notification', async () => {
    await setRecipients([]);
    const input = submission({ landingPageSlug: undefined });
    await leadsWith(TURNSTILE_TEST.alwaysPassesSecret).create(input, undefined);

    const lead = await storedLead(input.email);
    const confirmation = await outboxEmail(lead.id, 'lead-confirmation');
    expect(confirmation.payload).toMatchObject({
      to: [input.email],
      acknowledgement: { heading: 'Thanks. We have your request.' },
    });
    expect(confirmation.job).toBeTruthy();
    expect((await outboxEmail(lead.id, 'lead-notification')).row).toBeNull();
    expect(lead.activities.map((activity) => activity.type)).toContain('notification_skipped');
  });

  it('stores the referral source of a homepage form and confirms with the homepage success copy', async () => {
    await setRecipients(['leads@example.com']);
    const input = submission({
      type: 'CONSULTATION',
      formId: 'home-book',
      referralSource: 'AI assistant',
      landingPageSlug: undefined,
      attribution: { lastTouch: { source: 'integration' }, landingPage: '/' },
    });
    await leadsWith(TURNSTILE_TEST.alwaysPassesSecret).create(input, undefined);

    const lead = await storedLead(input.email);
    expect(lead.type).toBe('CONSULTATION');
    expect(lead.referralSource).toBe('AI assistant');
    expect(lead.attribution?.formId).toBe('home-book');
    expect(lead.attribution?.landingPageId).toBeNull();

    const home = await db.setting.findUniqueOrThrow({ where: { key: SETTING_KEYS.homeContent } });
    const acknowledgement = acknowledgementSchema.parse(homePageContentSchema.parse(home.value).formSuccess);
    const confirmation = await outboxEmail(lead.id, 'lead-confirmation');
    expect(confirmation.payload).toMatchObject({ template: 'lead-confirmation', to: [input.email], acknowledgement });
  });

  it('stores the routed enquiry type of a contact lead and notifies its mailbox as well', async () => {
    await setRecipients(['leads@example.com']);
    const slug = `integration-${run}-support`;
    await db.enquiryType.create({ data: { slug, name: 'Support', mailbox: 'Support@Example.com', order: 99 } });
    const input = submission({
      type: 'CONTACT',
      formId: 'contact-page',
      enquiryType: slug,
      budgetBand: undefined,
      serviceInterest: [],
      landingPageSlug: undefined,
      message: 'A question about our care plan.',
    });
    await leadsWith(TURNSTILE_TEST.alwaysPassesSecret).create(input, undefined);

    const lead = await storedLead(input.email);
    expect(lead.type).toBe('CONTACT');
    expect(lead.answers).toEqual({ enquiryType: slug });
    expect(lead.activities.find((activity) => activity.type === 'form_submitted')?.detail).toEqual({
      formId: 'contact-page',
      enquiryType: slug,
    });
    const notification = await outboxEmail(lead.id, 'lead-notification');
    expect(notification.payload).toMatchObject({
      to: ['leads@example.com', 'support@example.com'],
      lead: { enquiry: 'Support', message: 'A question about our care plan.' },
    });
  });

  it('refuses an enquiry type that does not exist and stores nothing', async () => {
    const input = submission({ type: 'CONTACT', formId: 'contact-page', enquiryType: `integration-${run}-missing` });
    await expect(leadsWith(TURNSTILE_TEST.alwaysPassesSecret).create(input, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await db.lead.count({ where: { email: input.email } })).toBe(0);
  });
});
