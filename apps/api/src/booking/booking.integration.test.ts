import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import { BOOKING_ERRORS, type BookingSubmission } from '@calwebtech/shared';
import { ConflictException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMAIL_QUEUE } from '@calwebtech/shared';
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
 * The one thing about a booking engine that cannot be proved without a database: two
 * people cannot take the same slot.
 *
 * The check is not "call the service twice and see". Both calls are started before either
 * finishes, which is the case a first-then-insert implementation passes in a test and
 * fails in production. One insert wins on the unique constraint and the other is told the
 * slot has gone.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_booking_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const queueName = `${EMAIL_QUEUE}-booking-${String(process.pid)}-${run}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });
const settings = new SettingsService(prisma);
const adminBookings = new AdminBookingsService(prisma, new AuditService(prisma), settings);
let ownerId = '';
const booking = new BookingService(
  prisma,
  new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000),
  settings,
  emailQueue,
  SubmissionGuard.off(),
);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

let sequence = 0;
function submission(startsAt: string, overrides: Partial<BookingSubmission> = {}): BookingSubmission {
  sequence += 1;
  return {
    consultationType: 'consultation',
    startsAt,
    timezone: 'Europe/London',
    name: `Booking Test ${String(sequence)}`,
    email: `booking+${run}-${String(sequence)}@example.com`,
    turnstileToken: TURNSTILE_TEST.dummyToken,
    ...overrides,
  };
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  // The operational import creates the consultation type, its weekday hours and the page
  // setting the service reads its timezone from.
  const result = await importSnapshots(prisma.client, { dir: snapshotDir });
  if (result.status !== 'imported') throw new Error('the import was skipped on an empty database');

  const owner = await prisma.client.user.create({
    data: { email: 'owner@calwebtech.test', name: 'The Owner', role: 'OWNER', passwordHash: 'x' },
    select: { id: true },
  });
  ownerId = owner.id;
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

describe('the booking engine against Postgres', () => {
  it('offers slots inside the horizon, and none of them sooner than the notice allows', async () => {
    const view = await booking.slots();
    expect(view.consultationType.slug).toBe('consultation');
    expect(view.days.length).toBeGreaterThan(0);

    const first = view.days[0]?.slots[0];
    expect(first).toBeDefined();
    const noticeMs = 24 * 3_600_000;
    expect(new Date(first?.startsAt ?? 0).getTime() - Date.now()).toBeGreaterThanOrEqual(noticeMs - 60_000);
  });

  it('stores a booking, its contact and the event that says it was made', async () => {
    const view = await booking.slots();
    const slot = view.days[0]?.slots[0]?.startsAt ?? '';
    const input = submission(slot, { context: 'Our checkout drops half its carts.' });

    const confirmation = await booking.create(input, '203.0.113.9');
    expect(confirmation).toMatchObject({ status: 'booked', startsAt: slot });
    expect(confirmation.cancelToken).not.toBe(confirmation.rescheduleToken);

    const stored = await prisma.client.booking.findFirstOrThrow({
      where: { email: input.email },
      include: { events: true, contact: true },
    });
    expect(stored.context).toBe('Our checkout drops half its carts.');
    expect(stored.timezone).toBe('Europe/London');
    expect(stored.contact?.email).toBe(input.email);
    expect(stored.events.map((event) => event.type)).toContain('created');
  });

  it('stops offering a slot once it is booked', async () => {
    const before = await booking.slots();
    const slot = before.days[0]?.slots.at(-1)?.startsAt ?? '';
    await booking.create(submission(slot), '203.0.113.9');

    const after = await booking.slots();
    const stillThere = after.days.some((day) => day.slots.some((entry) => entry.startsAt === slot));
    expect(stillThere).toBe(false);
  });

  it('refuses a time it never offered, however well formed', async () => {
    // Three in the morning: inside the horizon, outside every rule.
    const view = await booking.slots();
    const day = view.days[0]?.day ?? '';
    const middleOfTheNight = `${day}T10:17:00.000Z`;
    await expect(booking.create(submission(middleOfTheNight), '203.0.113.9')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets one of two simultaneous bookings through, and tells the other the slot has gone', async () => {
    const view = await booking.slots();
    const slot = view.days[1]?.slots[0]?.startsAt ?? view.days[0]?.slots[1]?.startsAt ?? '';
    expect(slot).not.toBe('');

    // Both are started before either finishes: the race the constraint exists to settle.
    const results = await Promise.allSettled([
      booking.create(submission(slot), '203.0.113.9'),
      booking.create(submission(slot), '203.0.113.10'),
    ]);

    const won = results.filter((result) => result.status === 'fulfilled');
    const lost = results.filter((result) => result.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const reason = lost[0]?.status === 'rejected' ? (lost[0].reason as ConflictException) : null;
    expect(reason).toBeInstanceOf(ConflictException);
    const body = reason?.getResponse();
    expect(body).toMatchObject({
      error: expect.stringMatching(new RegExp(`${BOOKING_ERRORS.slotGone}|${BOOKING_ERRORS.slotUnknown}`)) as unknown,
    });

    // And exactly one row exists for that instant.
    expect(await prisma.client.booking.count({ where: { startsAt: new Date(slot) } })).toBe(1);
  });

  it('queues the visitor their confirmation', async () => {
    const view = await booking.slots();
    const slot = view.days[2]?.slots[0]?.startsAt ?? '';
    const input = submission(slot);
    await booking.create(input, '203.0.113.9');

    const jobs = await inspect.getJobs(['waiting', 'prioritized', 'delayed']);
    const mine = jobs
      .map((job) => job.data as { template: string; to: string[] })
      .filter((data) => data.to.includes(input.email));
    expect(mine.map((data) => data.template)).toContain('booking-confirmation');
  });
});

/**
 * The loop the dashboard exists to close: hours changed in the admin are the hours the
 * public page offers. Asserting the rows were written would prove nothing — the engine
 * reads them through its own query, so the test asks the engine.
 */
describe('availability from the dashboard', () => {
  it('reads the week the import created, in the business timezone', async () => {
    const view = await adminBookings.availability();
    expect(view.consultationType.slug).toBe('consultation');
    expect(view.timeZone).not.toBe('');
    expect(view.rules.length).toBeGreaterThan(0);
    expect(view.rules.every((rule) => rule.endMinute > rule.startMinute)).toBe(true);
  });

  it('closes a weekday, and the page stops offering that day', async () => {
    const before = await adminBookings.availability();
    const slots = await booking.slots();
    const weekdays = new Set(before.rules.map((rule) => rule.weekday));
    const closing = [...weekdays][0];
    expect(closing).toBeDefined();

    await adminBookings.saveAvailability(
      {
        durationMinutes: before.consultationType.durationMinutes,
        bufferBefore: before.consultationType.bufferBefore,
        bufferAfter: before.consultationType.bufferAfter,
        rules: before.rules.filter((rule) => rule.weekday !== closing),
        overrides: [],
      },
      ownerId,
    );

    const after = await booking.slots();
    const weekdayOf = (startsAt: string): number =>
      new Date(startsAt).getUTCDay();
    // Every remaining slot belongs to a day that is still open. The business zone and UTC
    // can differ, so the check is that no slot falls on the closed rule's weekday in the
    // hours it used to cover.
    expect(after.days.length).toBeLessThanOrEqual(slots.days.length);
    expect(after.days.flatMap((day) => day.slots).every((slot) => weekdayOf(slot.startsAt) !== closing)).toBe(true);

    // And it is put back, so the tests that follow see the imported week.
    await adminBookings.saveAvailability(
      {
        durationMinutes: before.consultationType.durationMinutes,
        bufferBefore: before.consultationType.bufferBefore,
        bufferAfter: before.consultationType.bufferAfter,
        rules: before.rules,
        overrides: [],
      },
      ownerId,
    );
  });

  it('blocks one date, and nothing is offered on it', async () => {
    const view = await booking.slots();
    const day = view.days[1]?.day ?? '';
    expect(day).not.toBe('');

    const availability = await adminBookings.availability();
    await adminBookings.saveAvailability(
      {
        durationMinutes: availability.consultationType.durationMinutes,
        bufferBefore: availability.consultationType.bufferBefore,
        bufferAfter: availability.consultationType.bufferAfter,
        rules: availability.rules,
        overrides: [{ day, blocked: true, startMinute: null, endMinute: null, reason: 'Closed for the test' }],
      },
      ownerId,
    );

    const after = await booking.slots();
    expect(after.days.some((entry) => entry.day === day)).toBe(false);
    expect((await adminBookings.availability()).overrides.map((entry) => entry.day)).toContain(day);
  });

  it('writes an audit entry naming who changed the hours', async () => {
    const entries = await prisma.client.auditLog.findMany({
      where: { action: 'booking.availability.updated' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(entries[0]?.userId).toBe(ownerId);
  });
});
