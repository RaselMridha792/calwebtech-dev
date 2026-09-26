import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import {
  BOOKING_ERRORS,
  EMAIL_DOMAIN_MESSAGES,
  EMAIL_LIMITS,
  EMAIL_QUEUE,
  emailOutboxJobId,
  type BookingSubmission,
  type LeadSubmission,
} from '@calwebtech/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BookingService } from '../booking/booking.service';
import { loadEnv } from '../config/env';
import { LeadsService } from '../leads/leads.service';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { SubscribersService } from '../subscribers/subscribers.controller';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';
import { SubmissionGuard, type EmailCounter } from './submission-guard';

/**
 * The antispam checks through the three services that take public submissions
 * (docs/08-decisions.md, 61): leads, bookings and subscribers alike. The guard counts in
 * memory and answers DNS from a table here, so the rules are tested rather than the network.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_antispam_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const queueName = `${EMAIL_QUEUE}-antispam-${String(process.pid)}-${run}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });

const counts = new Map<string, number>();
const counter: EmailCounter = {
  increment: (key) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return Promise.resolve(counts.get(key) ?? 0);
  },
};
const guard = new SubmissionGuard(counter, {
  check: (domain) => Promise.resolve(domain === 'gmial.con' ? 'no' : 'yes'),
});
const turnstile = new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000);
const settings = new SettingsService(prisma);
const leads = new LeadsService(prisma, turnstile, settings, emailQueue, guard);
const subscribers = new SubscribersService(prisma, turnstile, guard);
const bookings = new BookingService(prisma, turnstile, settings, emailQueue, guard);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

let sequence = 0;
function lead(overrides: Partial<LeadSubmission> = {}): LeadSubmission {
  sequence += 1;
  return {
    type: 'CONTACT',
    formId: 'contact-page',
    name: 'Antispam Test',
    email: `antispam+${run}-${String(sequence)}@example.com`,
    serviceInterest: [],
    attribution: {},
    turnstileToken: TURNSTILE_TEST.dummyToken,
    formElapsedMs: 9_000,
    ...overrides,
  };
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  await importSnapshots(db, { dir: snapshotDir });
}, 180_000);

afterAll(async () => {
  await inspect.obliterate({ force: true });
  await inspect.close();
  await inspectConnection.quit();
  await emailQueue.onModuleDestroy();
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('a lead sent again', () => {
  const email = `returning+${run}@example.com`;

  it('joins the open lead of the same person and kind, with what it adds and emails of its own', async () => {
    const first = lead({ email, company: 'Test Harbour Co', serviceInterest: ['Website design'], message: 'First.' });
    await leads.create(first, undefined);
    const second = lead({ email, phone: '+1 555 0100', serviceInterest: ['SEO'], message: 'Second, with more.' });
    await leads.create(second, undefined);

    const rows = await db.lead.findMany({ where: { email }, include: { activities: true } });
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ company: 'Test Harbour Co', phone: '+1 555 0100', message: 'Second, with more.' });
    expect(row?.serviceInterest).toEqual(['Website design', 'SEO']);
    const resubmitted = row?.activities.find((activity) => activity.type === 'form_resubmitted');
    expect(resubmitted?.detail).toMatchObject({ formId: 'contact-page', message: 'Second, with more.' });

    // The resubmission's own confirmation, committed with it (docs/08-decisions.md, 71) and queued.
    const confirmations = await db.emailOutbox.findMany({
      where: { leadId: row?.id ?? '', template: 'lead-confirmation' },
      orderBy: { createdAt: 'asc' },
    });
    expect(confirmations).toHaveLength(2);
    expect(confirmations[1]?.payload).toMatchObject({ resubmission: resubmitted?.id });
    const again = await inspect.getJob(emailOutboxJobId(confirmations[1]?.id ?? ''));
    expect(again).toBeTruthy();
  });

  it('starts a new lead for another kind of form, and once the lead is closed', async () => {
    await leads.create(lead({ email, type: 'AUDIT', formId: 'free-website-audit' }), undefined);
    expect(await db.lead.count({ where: { email } })).toBe(2);

    await db.lead.updateMany({ where: { email, type: 'CONTACT' }, data: { status: 'WON' } });
    await leads.create(lead({ email }), undefined);
    expect(await db.lead.count({ where: { email, type: 'CONTACT' } })).toBe(2);
  });
});

describe('the checks on every form', () => {
  it('refuse a form sent faster than a person could, as a failed bot check, and store nothing', async () => {
    const submission = lead({ formElapsedMs: 200 });
    await expect(leads.create(submission, undefined)).rejects.toMatchObject({ status: 403 });
    expect(await db.lead.count({ where: { email: submission.email } })).toBe(0);
  });

  it('name a throwaway inbox and a domain that cannot receive mail under the email field', async () => {
    await expect(leads.create(lead({ email: `x${run}@mailinator.com` }), undefined)).rejects.toMatchObject({
      response: { fieldErrors: { email: [EMAIL_DOMAIN_MESSAGES.disposable] } },
    });
    await expect(
      subscribers.subscribe({ email: `dana${run}@gmial.con`, sourcePage: '/', formElapsedMs: 5_000 }, undefined),
    ).rejects.toMatchObject({ response: { fieldErrors: { email: [EMAIL_DOMAIN_MESSAGES.noMail] } } });
  });

  it('allow one address its limit of leads, then answer 429', async () => {
    const email = `limited+${run}@example.com`;
    for (let attempt = 0; attempt < EMAIL_LIMITS.lead.max; attempt += 1) {
      await leads.create(lead({ email, type: attempt % 2 === 0 ? 'CONTACT' : 'AUDIT' }), undefined);
    }
    await expect(leads.create(lead({ email }), undefined)).rejects.toMatchObject({ status: 429 });
  });

  it('answer a subscriber over the limit as always, and write nothing', async () => {
    const email = `subscriber+${run}@example.com`;
    for (let attempt = 0; attempt < EMAIL_LIMITS.subscribe.max; attempt += 1) {
      await subscribers.subscribe({ email, sourcePage: '/', formElapsedMs: 5_000, turnstileToken: TURNSTILE_TEST.dummyToken }, undefined);
    }
    await db.subscriber.deleteMany({ where: { email } });
    expect(await subscribers.subscribe({ email, sourcePage: '/', formElapsedMs: 5_000, turnstileToken: TURNSTILE_TEST.dummyToken }, undefined)).toEqual({
      status: 'subscribed',
    });
    expect(await db.subscriber.count({ where: { email } })).toBe(0);
  });
});

describe('a second booking from one address', () => {
  it('is refused while the first call is still to come, with its time', async () => {
    const view = await bookings.slots();
    const [first, second] = view.days.slice(2).flatMap((day) => day.slots.map((slot) => slot.startsAt));
    if (!first || !second) throw new Error('two free slots are needed');
    const booking = (startsAt: string): BookingSubmission => ({
      consultationType: 'consultation',
      startsAt,
      timezone: 'Europe/London',
      name: 'Antispam Booking',
      email: `booker+${run}@example.com`,
      turnstileToken: TURNSTILE_TEST.dummyToken,
      formElapsedMs: 20_000,
    });

    await bookings.create(booking(first), '203.0.113.30');
    await expect(bookings.create(booking(second), '203.0.113.30')).rejects.toMatchObject({
      response: { error: BOOKING_ERRORS.alreadyBooked, startsAt: first },
    });
  });
});
