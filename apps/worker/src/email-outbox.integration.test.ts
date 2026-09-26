import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createPrismaClient, emailOutboxData, type OutboxEmailJob } from '@calwebtech/db';
import { emailOutboxJobId, emailOutboxQueueEntry, type LeadSummary } from '@calwebtech/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runEmailOutboxSweep, type OutboxRowToQueue } from './email-outbox-sweep';
import { createEmailJobProcessor } from './process-email-job';
import { prismaDeliveryStore } from './store';
import { logTransport } from './transport';

/**
 * The crash the outbox exists for (docs/08-decisions.md, 71), against a real database and a
 * real Redis: a lead or a booking is committed with its emails as outbox rows, the process
 * dies before it queues them, and the worker's sweep queues them and the log transport sends
 * them, once.
 *
 * "Committed" is the transaction the API runs: the record and its rows written through the
 * same `emailOutboxData` the API's `writeOutbox` uses (apps/api/src/queue/email-outbox.ts, whose
 * own integration test shows the API commits them and leaves them unqueued when it dies). The
 * database is created beside DATABASE_URL and dropped afterwards; the queue has a name of its own.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const { DATABASE_URL, REDIS_URL } = process.env;
if (!DATABASE_URL || !REDIS_URL) throw new Error('DATABASE_URL and REDIS_URL are required for the worker integration tests');

const run = Date.now().toString(36);
const databaseName = `calwebtech_outbox_${run}`;
const databaseUrl = (() => {
  const parsed = new URL(DATABASE_URL);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
})();

const admin = createPrismaClient(DATABASE_URL);
const db = createPrismaClient(databaseUrl);
const queueName = `email-outbox-${String(process.pid)}-${run}`;
const connections: Redis[] = [];
const connect = (options: { worker?: boolean } = {}) => {
  const connection = new Redis(REDIS_URL, options.worker ? { maxRetriesPerRequest: null } : {});
  connections.push(connection);
  return connection;
};
const queue = new Queue(queueName, { connection: connect() });

/** What the log transport and the sweep wrote: the only trace of an email under EMAIL_TRANSPORT=log. */
const lines: string[] = [];
const log = (line: string) => {
  lines.push(line);
};
const sentLines = () => lines.filter((line) => line.startsWith('email not sent (EMAIL_TRANSPORT=log)'));

/** The worker's own processor and store, sending through the log transport as production does. */
const worker = new Worker(
  queueName,
  createEmailJobProcessor({ transport: logTransport(log), store: prismaDeliveryStore(db), from: 'Calwebtech <hello@calwebtech.test>' }),
  { connection: connect({ worker: true }), autorun: false },
);

/** The sweep as the worker schedules it, adding to this test's queue. */
const sweep = () =>
  runEmailOutboxSweep({
    db,
    log,
    enqueue: async (rows: readonly OutboxRowToQueue[]) => {
      await queue.addBulk(rows.map((row) => emailOutboxQueueEntry(row)));
    },
  });

function migrate(): number {
  const dbPackage = path.resolve(process.cwd(), '../../packages/db');
  const cli = createRequire(path.join(dbPackage, 'package.json')).resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: dbPackage,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function until(done: () => Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const settled = async (outboxIds: readonly string[]) => {
  const rows = await db.emailOutbox.findMany({ where: { id: { in: [...outboxIds] } } });
  return rows.every((row) => row.sentAt !== null || row.cancelledAt !== null || row.failedAt !== null);
};

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrate();
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  void worker.run();
}, 180_000);

afterAll(async () => {
  await worker.close();
  await queue.obliterate({ force: true });
  await queue.close();
  await Promise.all(connections.map((connection) => connection.quit()));
  await db.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('a lead committed, the process gone before the enqueue', () => {
  let outboxIds: string[] = [];
  let leadId = '';

  it('leaves the lead and its emails committed and nothing in the queue', async () => {
    // The API's transaction: the lead, then its emails as rows. Then the process dies, so the
    // enqueue that follows the commit never happens.
    const written = await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { type: 'CONTACT', name: 'Dana Whitfield', email: `dana+${run}@example.com`, serviceInterest: [] },
      });
      const summary: LeadSummary = {
        leadId: lead.id,
        type: 'CONTACT',
        formId: 'contact-page',
        name: 'Dana Whitfield',
        email: lead.email,
        serviceInterest: [],
        message: 'Can you rebuild our site?',
        attribution: {},
        submittedAt: lead.createdAt.toISOString(),
      };
      const emails: OutboxEmailJob[] = [
        {
          template: 'lead-confirmation',
          to: [lead.email],
          lead: summary,
          acknowledgement: { heading: 'Thanks. We have your request.', body: 'Someone will reply by email.' },
        },
        { template: 'lead-notification', to: ['leads@calwebtech.test'], lead: summary },
      ];
      const rows = await tx.emailOutbox.createManyAndReturn({
        data: emails.map((job) => emailOutboxData(job, new Date())),
        select: { id: true },
      });
      return { leadId: lead.id, outboxIds: rows.map((row) => row.id) };
    });
    ({ leadId, outboxIds } = written);

    const rows = await db.emailOutbox.findMany({ where: { leadId } });
    expect(rows.map((row) => row.template).sort()).toEqual(['lead-confirmation', 'lead-notification']);
    expect(rows.every((row) => row.queuedAt === null && row.sentAt === null)).toBe(true);
    expect(await queue.getJobCountByTypes('waiting', 'delayed', 'active', 'completed')).toBe(0);
  });

  it('is queued by the sweep and sent once through the log transport', async () => {
    const result = await sweep();
    expect(result).toMatchObject({ neverQueued: 2 });
    expect(lines).toContain('outbox: queued 2 email(s) the API had not');
    for (const id of outboxIds) expect(await queue.getJob(emailOutboxJobId(id))).toBeTruthy();

    await until(() => settled(outboxIds), 'the two emails to be sent');
    const rows = await db.emailOutbox.findMany({ where: { leadId }, orderBy: { template: 'asc' } });
    for (const row of rows) {
      expect(row.sentAt).not.toBeNull();
      expect(row.queuedAt).not.toBeNull();
      expect(row.providerId).toBe(`log-${emailOutboxJobId(row.id)}`);
    }
    expect(sentLines()).toHaveLength(2);
    expect(sentLines().some((line) => line.includes(`to dana+${run}@example.com`))).toBe(true);
    expect(sentLines().some((line) => line.includes('to leads@calwebtech.test'))).toBe(true);

    const activities = await db.leadActivity.findMany({ where: { leadId, type: 'email_sent' } });
    expect(activities.map((activity) => (activity.detail as { template: string }).template).sort()).toEqual([
      'lead-confirmation',
      'lead-notification',
    ]);
  });

  it('sends nothing more however often the rows are queued again', async () => {
    expect(await sweep()).toEqual({ pending: 0, neverQueued: 0 });

    // A job Redis has already let go of, added again by hand: the row is sent, so it is skipped.
    const [first] = outboxIds;
    if (!first) throw new Error('expected an outbox row');
    await (await queue.getJob(emailOutboxJobId(first)))?.remove();
    const again = await queue.add('lead-confirmation', { outboxId: first }, { jobId: emailOutboxJobId(first) });
    await until(async () => (await again.getState()) === 'completed', 'the repeated job to finish');

    expect(sentLines()).toHaveLength(2);
    expect(await db.leadActivity.count({ where: { leadId, type: 'email_sent' } })).toBe(2);
  });
});

describe('a booking committed, the process gone before the enqueue', () => {
  it('sends the confirmation after the sweep, keeps the reminder for its time, and never reminds about a cancelled call', async () => {
    const type = await db.consultationType.create({
      data: { name: 'Discovery call', slug: `discovery-${run}`, durationMinutes: 30 },
    });
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const remindAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
    const email = `sam+${run}@example.com`;
    const manage = { rescheduleToken: `move-${run}`, cancelToken: `cancel-${run}` };

    const bookingId = await db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          consultationTypeId: type.id,
          name: 'Sam Lee',
          email,
          timezone: 'Europe/London',
          startsAt,
          endsAt,
          slotStartsAt: startsAt,
          ...manage,
        },
      });
      const call = {
        bookingId: booking.id,
        name: 'Sam Lee',
        consultationType: type.name,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: 'Europe/London',
        manage,
      };
      await tx.emailOutbox.createMany({
        data: [
          emailOutboxData({ template: 'booking-confirmation', to: [email], ...call }, new Date()),
          emailOutboxData({ template: 'booking-reminder', to: [email], ...call, window: '24h' }, remindAt),
        ],
      });
      return booking.id;
    });

    const rows = await db.emailOutbox.findMany({ where: { bookingId } });
    const confirmation = rows.find((row) => row.template === 'booking-confirmation');
    const reminder = rows.find((row) => row.template === 'booking-reminder');
    if (!confirmation || !reminder) throw new Error('expected a confirmation and a reminder row');
    expect(rows.every((row) => row.queuedAt === null)).toBe(true);

    await sweep();
    await until(() => settled([confirmation.id]), 'the confirmation to be sent');
    expect(sentLines().filter((line) => line.includes(`to ${email}`))).toHaveLength(1);
    expect(sentLines().find((line) => line.includes(`to ${email}`))).toContain('with calwebtech-call.ics');
    const events = await db.bookingEvent.findMany({ where: { bookingId } });
    expect(events.map((event) => event.type)).toEqual(['email_sent']);

    // The reminder waits for its own time, a day before the call.
    const reminderJob = await queue.getJob(emailOutboxJobId(reminder.id));
    expect(await reminderJob?.getState()).toBe('delayed');
    expect(Math.abs((reminderJob?.timestamp ?? 0) + (reminderJob?.delay ?? 0) - remindAt.getTime())).toBeLessThan(5_000);

    // Redis loses the job: the next sweep puts it back, at the same time.
    await reminderJob?.remove();
    await sweep();
    const restored = await queue.getJob(emailOutboxJobId(reminder.id));
    expect(await restored?.getState()).toBe('delayed');
    expect(Math.abs((restored?.timestamp ?? 0) + (restored?.delay ?? 0) - remindAt.getTime())).toBeLessThan(5_000);

    // The call is cancelled, and the reminder comes due anyway (its removal failed, say): the
    // worker reads the booking, sends nothing, and withdraws the row so no sweep queues it again.
    await db.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', slotStartsAt: null } });
    await restored?.promote();
    await until(() => settled([reminder.id]), 'the reminder to be withdrawn');
    const withdrawn = await db.emailOutbox.findUniqueOrThrow({ where: { id: reminder.id } });
    expect(withdrawn.sentAt).toBeNull();
    expect(withdrawn.cancelledAt).not.toBeNull();
    expect(withdrawn.error).toBe('the call was moved or cancelled');
    expect(sentLines().filter((line) => line.includes(`to ${email}`))).toHaveLength(1);
    expect(await sweep()).toMatchObject({ pending: 0 });
  });
});
