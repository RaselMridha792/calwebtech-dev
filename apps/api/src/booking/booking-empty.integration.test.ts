import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { BOOKING_ERRORS, EMAIL_QUEUE } from '@calwebtech/shared';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 * A production stack the hour it is first deployed: migrations have run and nothing else.
 * No `booking.page` setting, no consultation type, no availability.
 *
 * This is the state the live site was in, and the page answered 500 to every visitor
 * because the missing setting reached Zod as null. An empty database is an ordinary state,
 * not a fault, and it has to read as "no times" — which the page already says.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const run = Date.now().toString(36);
const databaseName = `calwebtech_booking_empty_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const emailQueue = new EmailQueue(env.REDIS_URL, `${EMAIL_QUEUE}-empty-${String(process.pid)}-${run}`);
const booking = new BookingService(
  prisma,
  new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000),
  new SettingsService(prisma),
  emailQueue,
  SubmissionGuard.off(),
);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
}, 180_000);

afterAll(async () => {
  await emailQueue.onModuleDestroy();
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('the booking engine on a database with nothing in it', () => {
  it('says there is no consultation type rather than failing to read its own settings', async () => {
    // A Zod error here would mean the missing page setting, which is a 500. 404 is the
    // answer the page knows how to render.
    await expect(booking.slots()).rejects.toBeInstanceOf(NotFoundException);
    await expect(booking.slots()).rejects.toMatchObject({ response: { message: BOOKING_ERRORS.typeUnknown } });
  });

  it('answers the page the same way, so the site renders and offers nothing', async () => {
    await expect(booking.page()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a booking without inventing a slot to give it', async () => {
    await expect(
      booking.create(
        {
          consultationType: 'consultation',
          startsAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
          timezone: 'Europe/London',
          name: 'Nobody',
          email: 'nobody@example.com',
          turnstileToken: TURNSTILE_TEST.dummyToken,
        },
        '203.0.113.9',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
