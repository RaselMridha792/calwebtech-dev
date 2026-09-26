import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import { BOOKING_ERRORS, EMAIL_QUEUE, emailOutboxJobId, type BookingSubmission } from '@calwebtech/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminBookingsService } from '../admin/bookings/admin-bookings.service';
import { AuditService } from '../auth/audit.service';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';
import { BookingService } from './booking.service';
import { SubmissionGuard } from '../antispam/submission-guard';

/**
 * A booked call from the visitor's side after they booked it (docs/08-decisions.md, 60): its
 * reminders are queued for a day and an hour before, its signed links move or cancel it and
 * only it, a move goes through the same rules as a booking and carries its reminders along,
 * and a cancellation frees the time and takes the reminders back.
 *
 * The database is created on the same server as DATABASE_URL and the queue has a name of its
 * own, both removed afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_booking_manage_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const queueName = `${EMAIL_QUEUE}-booking-manage-${String(process.pid)}-${run}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });
const settings = new SettingsService(prisma);
const booking = new BookingService(
  prisma,
  new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000),
  settings,
  emailQueue,
  SubmissionGuard.off(),
);
const adminBookings = new AdminBookingsService(prisma, new AuditService(prisma), settings, emailQueue);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

let sequence = 0;
function submission(startsAt: string): BookingSubmission {
  sequence += 1;
  return {
    consultationType: 'consultation',
    startsAt,
    timezone: 'Europe/London',
    name: `Manage Test ${String(sequence)}`,
    email: `manage+${run}-${String(sequence)}@example.com`,
    turnstileToken: TURNSTILE_TEST.dummyToken,
  };
}

/** A free slot a few days out, so both reminders are still ahead of it. */
async function freeSlot(skip = 0): Promise<string> {
  const view = await booking.slots();
  const slots = view.days.slice(3).flatMap((day) => day.slots.map((slot) => slot.startsAt));
  const slot = slots[skip];
  if (!slot) throw new Error('no free slot far enough out');
  return slot;
}

async function state(jobId: string): Promise<string | null> {
  const job = await inspect.getJob(jobId);
  return job ? await job.getState() : null;
}

/**
 * A booking's emails of one template as its transactions committed them to the outbox
 * (docs/08-decisions.md, 71), oldest first, with the state of the job that names each.
 */
async function outbox(bookingId: string, template: string) {
  const rows = await prisma.client.emailOutbox.findMany({ where: { bookingId, template }, orderBy: { createdAt: 'asc' } });
  return Promise.all(rows.map(async (row) => ({ ...row, job: await state(emailOutboxJobId(row.id)) })));
}

/** The reminders still to send for a call at `startsAt`. */
async function reminders(bookingId: string, startsAt: string) {
  const rows = await outbox(bookingId, 'booking-reminder');
  return rows.filter((row) => (row.payload as { startsAt: string }).startsAt === startsAt);
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  await importSnapshots(prisma.client, { dir: snapshotDir });
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

describe('a booked call, moved and cancelled from its links', () => {
  let tokens = { rescheduleToken: '', cancelToken: '' };
  let id = '';
  let first = '';
  let second = '';

  it('queues reminders a day and an hour before, and gives the confirmation its links', async () => {
    first = await freeSlot();
    const confirmation = await booking.create(submission(first), '203.0.113.20');
    tokens = { rescheduleToken: confirmation.rescheduleToken, cancelToken: confirmation.cancelToken };
    const row = await prisma.client.booking.findUniqueOrThrow({ where: { rescheduleToken: tokens.rescheduleToken } });
    id = row.id;

    const [day, hour] = await reminders(id, first);
    expect((day?.payload as { window: string }).window).toBe('24h');
    expect(day?.sendAt.toISOString()).toBe(new Date(Date.parse(first) - 24 * 60 * 60 * 1000).toISOString());
    expect(hour?.sendAt.toISOString()).toBe(new Date(Date.parse(first) - 60 * 60 * 1000).toISOString());
    expect(day?.job).toBe('delayed');
    expect(hour?.job).toBe('delayed');
    const dayJob = await inspect.getJob(emailOutboxJobId(day?.id ?? ''));
    expect(dayJob?.timestamp !== undefined && dayJob.delay).toBeGreaterThan(0);
    const [confirmationEmail] = await outbox(id, 'booking-confirmation');
    expect(confirmationEmail?.payload).toMatchObject({ manage: tokens });
    expect(confirmationEmail?.job).not.toBeNull();
  });

  it('shows the call behind each link, and which action each allows', async () => {
    expect(await booking.manage(tokens.rescheduleToken)).toMatchObject({ action: 'reschedule', open: true, startsAt: first });
    expect(await booking.manage(tokens.cancelToken)).toMatchObject({ action: 'cancel', open: true });
    await expect(booking.manage('no-such-token-0000000000')).rejects.toMatchObject({
      response: { error: BOOKING_ERRORS.linkUnknown },
    });
  });

  it('moves only with the move link, and only to a time the engine offers', async () => {
    second = await freeSlot(1);
    await expect(
      booking.reschedule({ token: tokens.cancelToken, startsAt: second, timezone: 'Europe/London' }),
    ).rejects.toMatchObject({ response: { error: BOOKING_ERRORS.linkUnknown } });
    await expect(
      booking.reschedule({ token: tokens.rescheduleToken, startsAt: '2026-01-01T03:17:00.000Z', timezone: 'Europe/London' }),
    ).rejects.toMatchObject({ response: { error: BOOKING_ERRORS.slotUnknown } });
  });

  it('moves the call, takes the old reminders back, queues new ones, and tells both sides', async () => {
    const moved = await booking.reschedule({ token: tokens.rescheduleToken, startsAt: second, timezone: 'Asia/Dhaka' });
    expect(moved).toMatchObject({ startsAt: second, timezone: 'Asia/Dhaka', open: true });

    const row = await prisma.client.booking.findUniqueOrThrow({ where: { id }, include: { events: true } });
    expect(row.status).toBe('RESCHEDULED');
    expect(row.events.map((event) => event.type)).toContain('rescheduled');
    // The old time's reminders were withdrawn with the move and taken off the queue.
    for (const old of await reminders(id, first)) {
      expect(old.cancelledAt).not.toBeNull();
      expect(old.job).toBeNull();
    }
    const fresh = await reminders(id, second);
    expect(fresh).toHaveLength(2);
    for (const reminder of fresh) {
      expect(reminder.cancelledAt).toBeNull();
      expect(reminder.job).toBe('delayed');
    }
    const [changed] = await outbox(id, 'booking-changed');
    expect(changed?.payload).toMatchObject({ change: 'moved', previousStartsAt: first, startsAt: second });
    expect(changed?.job).not.toBeNull();
    // The old time is free again; the new one is not.
    const offered = (await booking.slots()).days.flatMap((day) => day.slots.map((slot) => slot.startsAt));
    expect(offered).toContain(first);
    expect(offered).not.toContain(second);
  });

  it('cancels with the cancel link, frees the time, and answers a second cancel the same way', async () => {
    const cancelled = await booking.cancel(tokens.cancelToken);
    expect(cancelled).toMatchObject({ cancelled: true, open: false });
    expect((await prisma.client.booking.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    for (const reminder of await reminders(id, second)) {
      expect(reminder.cancelledAt).not.toBeNull();
      expect(reminder.job).toBeNull();
    }
    const cancelledEmails = (await outbox(id, 'booking-changed')).map((row) => row.payload as { change: string });
    expect(cancelledEmails.map((payload) => payload.change)).toEqual(['moved', 'cancelled']);
    const offered = (await booking.slots()).days.flatMap((day) => day.slots.map((slot) => slot.startsAt));
    expect(offered).toContain(second);

    expect(await booking.cancel(tokens.cancelToken)).toMatchObject({ cancelled: true });
    await expect(
      booking.reschedule({ token: tokens.rescheduleToken, startsAt: first, timezone: 'Europe/London' }),
    ).rejects.toMatchObject({ response: { error: BOOKING_ERRORS.closed } });
  });

  it('lets somebody else book the time a cancelled call gave back, and will not bring the old call back over it', async () => {
    const rebooked = await booking.create(submission(second), '203.0.113.22');
    expect(rebooked.startsAt).toBe(second);
    expect(await prisma.client.booking.count({ where: { startsAt: new Date(second) } })).toBe(2);

    const user = await prisma.client.user.create({
      data: { email: `editor+${run}@calwebtech.test`, name: 'Editor', role: 'EDITOR', passwordHash: 'x' },
      select: { id: true },
    });
    await expect(adminBookings.update(id, { status: 'CONFIRMED' }, user.id)).rejects.toMatchObject({
      response: { error: BOOKING_ERRORS.slotGone },
    });
    expect((await prisma.client.booking.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
  });

  it('takes the reminders back when the team cancels a call from the dashboard', async () => {
    const at = await freeSlot(2);
    const confirmation = await booking.create(submission(at), '203.0.113.21');
    const row = await prisma.client.booking.findUniqueOrThrow({ where: { cancelToken: confirmation.cancelToken } });
    const user = await prisma.client.user.create({
      data: { email: `owner+${run}@calwebtech.test`, name: 'Owner', role: 'OWNER', passwordHash: 'x' },
      select: { id: true },
    });

    await adminBookings.update(row.id, { status: 'CANCELLED' }, user.id);
    const withdrawn = await reminders(row.id, at);
    expect(withdrawn).toHaveLength(2);
    for (const reminder of withdrawn) {
      expect(reminder.cancelledAt).not.toBeNull();
      expect(reminder.job).toBeNull();
    }
  });
});
