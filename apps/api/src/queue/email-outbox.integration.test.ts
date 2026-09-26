import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PENDING_EMAIL_OUTBOX, createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import {
  EMAIL_QUEUE,
  SETTING_KEYS,
  emailOutboxJobId,
  emailOutboxQueueEntry,
  type BookingSubmission,
  type LeadSubmission,
} from '@calwebtech/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SubmissionGuard } from '../antispam/submission-guard';
import { BookingService } from '../booking/booking.service';
import { loadEnv } from '../config/env';
import { LeadsService } from '../leads/leads.service';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';
import { EmailQueue } from './email-queue';

/**
 * The API's half of the outbox (docs/08-decisions.md, 71): a lead's or a booking's emails are
 * committed with it, so a process that dies between the commit and the queue loses none.
 *
 * "Dies" is a queue that never answers: the request stops at the enqueue that follows the
 * commit, as a killed process would, and never returns. What is left is what the worker's
 * sweep finds. The worker's own integration test (apps/worker/src/email-outbox.integration.
 * test.ts) takes rows in exactly this state through the sweep and the log transport.
 *
 * The database is created beside DATABASE_URL and the queue has a name of its own, both
 * removed afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_email_outbox_${run}`;
const databaseUrl = (() => {
  const parsed = new URL(env.DATABASE_URL);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
})();

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const queueName = `${EMAIL_QUEUE}-outbox-${String(process.pid)}-${run}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });
const turnstile = new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000);
const settings = new SettingsService(prisma);

/**
 * An email queue the process dies in front of. `died` resolves when the request reaches the
 * enqueue, which comes after the commit; the enqueue itself never returns.
 */
function dyingQueue(): { queue: EmailQueue; died: Promise<void> } {
  let reached: () => void = () => undefined;
  const died = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const queue = {
    enqueueOutbox: () => {
      reached();
      return new Promise<never>(() => undefined);
    },
    remove: () => Promise.resolve(0),
  } as unknown as EmailQueue;
  return { queue, died };
}

const leadsWith = (queue: EmailQueue) => new LeadsService(prisma, turnstile, settings, queue, SubmissionGuard.off());
const bookingsWith = (queue: EmailQueue) => new BookingService(prisma, turnstile, settings, queue, SubmissionGuard.off());
const liveBookings = bookingsWith(emailQueue);

let sequence = 0;
function lead(): LeadSubmission {
  sequence += 1;
  return {
    type: 'CONTACT',
    formId: 'contact-page',
    name: 'Dana Whitfield',
    email: `outbox+${run}-${String(sequence)}@example.com`,
    serviceInterest: [],
    message: 'Can you rebuild our site?',
    attribution: { landingPage: '/contact/' },
    turnstileToken: TURNSTILE_TEST.dummyToken,
  };
}

function booking(startsAt: string): BookingSubmission {
  sequence += 1;
  return {
    consultationType: 'consultation',
    startsAt,
    timezone: 'Europe/London',
    name: 'Sam Lee',
    email: `outbox-call+${run}-${String(sequence)}@example.com`,
    turnstileToken: TURNSTILE_TEST.dummyToken,
  };
}

/** A free slot a few days out, so both reminders are still ahead of it. */
async function freeSlot(skip = 0): Promise<string> {
  const view = await liveBookings.slots();
  const slot = view.days.slice(3).flatMap((day) => day.slots.map((entry) => entry.startsAt))[skip];
  if (!slot) throw new Error('no free slot far enough out');
  return slot;
}

/** Whether any of these rows has a job in the queue, whatever its state. */
const anyQueued = async (rows: readonly { id: string }[]) =>
  (await Promise.all(rows.map((row) => inspect.getJob(emailOutboxJobId(row.id))))).some((job) => job !== undefined);

/** Every job in the test's queue, whatever its state. */
const jobCount = async () =>
  Object.values(await inspect.getJobCounts('waiting', 'prioritized', 'delayed', 'active', 'completed', 'failed')).reduce(
    (sum, count) => sum + count,
    0,
  );

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  await importSnapshots(db, { dir: snapshotDir });
  const key = SETTING_KEYS.leadNotificationRecipients;
  await db.setting.upsert({ where: { key }, create: { key, value: { emails: ['leads@example.com'] } }, update: { value: { emails: ['leads@example.com'] } } });
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

describe('a lead, and the process gone before the enqueue', () => {
  it('has the lead and both its emails committed, not queued, and waiting for the sweep', async () => {
    const { queue, died } = dyingQueue();
    const input = lead();
    // The request never returns: the process is gone.
    void leadsWith(queue).create(input, '203.0.113.30');
    await died;

    const stored = await db.lead.findFirstOrThrow({ where: { email: input.email }, include: { emailOutbox: true } });
    const rows = stored.emailOutbox;
    expect(rows.map((row) => row.template).sort()).toEqual(['lead-confirmation', 'lead-notification']);
    expect(rows.find((row) => row.template === 'lead-confirmation')?.payload).toMatchObject({
      to: [input.email],
      lead: { leadId: stored.id, message: 'Can you rebuild our site?' },
    });
    expect(rows.find((row) => row.template === 'lead-notification')?.payload).toMatchObject({ to: ['leads@example.com'] });
    for (const row of rows) {
      expect(row.queuedAt).toBeNull();
      expect(row.sentAt).toBeNull();
    }
    expect(await anyQueued(rows)).toBe(false);

    // What the worker's sweep reads: every row still to send, these among them.
    const pending = await db.emailOutbox.findMany({ where: PENDING_EMAIL_OUTBOX, select: { id: true } });
    expect(pending.map((row) => row.id)).toEqual(expect.arrayContaining(rows.map((row) => row.id)));
  });

  it('queues each email once, under its row, whether the API or the sweep adds it', async () => {
    const input = lead();
    await leadsWith(emailQueue).create(input, '203.0.113.31');

    const rows = await db.emailOutbox.findMany({ where: { lead: { email: input.email } } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.queuedAt).not.toBeNull();
      const job = await inspect.getJob(emailOutboxJobId(row.id));
      expect(job?.name).toBe(row.template);
      expect(job?.data).toEqual({ outboxId: row.id });
    }
    const before = await jobCount();
    // The sweep adds what the API already queued: the id is the row's, so nothing is added.
    await inspect.addBulk(rows.map((row) => emailOutboxQueueEntry(row)));
    expect(await jobCount()).toBe(before);
  });
});

describe('a booking, and the process gone before the enqueue', () => {
  it('has the call and all four of its emails committed, the reminders due at their times', async () => {
    const { queue, died } = dyingQueue();
    const at = await freeSlot();
    const input = booking(at);
    void bookingsWith(queue).create(input, '203.0.113.32');
    await died;

    const stored = await db.booking.findFirstOrThrow({ where: { email: input.email }, include: { emailOutbox: true } });
    const rows = stored.emailOutbox;
    expect(rows.map((row) => row.template).sort()).toEqual([
      'booking-confirmation',
      'booking-notification',
      'booking-reminder',
      'booking-reminder',
    ]);
    const reminders = rows.filter((row) => row.template === 'booking-reminder').map((row) => row.sendAt.getTime());
    expect(reminders.sort()).toEqual([Date.parse(at) - 24 * 60 * 60 * 1000, Date.parse(at) - 60 * 60 * 1000]);
    expect(rows.every((row) => row.queuedAt === null)).toBe(true);
    expect(await anyQueued(rows)).toBe(false);
  });

  it('commits a move with the old reminders withdrawn and the new emails written, even if it dies before the enqueue', async () => {
    const at = await freeSlot(1);
    const confirmation = await liveBookings.create(booking(at), '203.0.113.33');
    const { id } = await db.booking.findUniqueOrThrow({ where: { cancelToken: confirmation.cancelToken } });

    const { queue, died } = dyingQueue();
    const to = await freeSlot(2);
    void bookingsWith(queue).reschedule({ token: confirmation.rescheduleToken, startsAt: to, timezone: 'Europe/London' });
    await died;

    expect((await db.booking.findUniqueOrThrow({ where: { id } })).status).toBe('RESCHEDULED');
    const rows = await db.emailOutbox.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } });
    const old = rows.filter((row) => row.template === 'booking-reminder' && (row.payload as { startsAt: string }).startsAt === at);
    const fresh = rows.filter((row) => row.template === 'booking-reminder' && (row.payload as { startsAt: string }).startsAt === to);
    expect(old).toHaveLength(2);
    expect(old.every((row) => row.cancelledAt !== null && row.error === 'the call was moved')).toBe(true);
    expect(fresh).toHaveLength(2);
    expect(fresh.every((row) => row.cancelledAt === null && row.queuedAt === null)).toBe(true);
    expect(await anyQueued(fresh)).toBe(false);
    const moved = rows.filter((row) => (row.payload as { change?: string }).change === 'moved');
    expect(moved.map((row) => row.template).sort()).toEqual(['booking-changed', 'booking-notification']);
    expect(moved.every((row) => row.queuedAt === null)).toBe(true);
  });

  it('writes no email for a booking that loses its slot, since its transaction rolls back', async () => {
    const at = await freeSlot(3);
    const [first, second] = [booking(at), booking(at)];
    const [firstResult, secondResult] = await Promise.allSettled([
      liveBookings.create(first, '203.0.113.34'),
      liveBookings.create(second, '203.0.113.35'),
    ]);
    expect([firstResult.status, secondResult.status].sort()).toEqual(['fulfilled', 'rejected']);

    const loser = firstResult.status === 'fulfilled' ? second : first;
    const rows = await db.emailOutbox.findMany({ select: { payload: true } });
    const toLoser = rows.filter((row) => JSON.stringify(row.payload).includes(loser.email));
    expect(toLoser).toEqual([]);
  });
});
