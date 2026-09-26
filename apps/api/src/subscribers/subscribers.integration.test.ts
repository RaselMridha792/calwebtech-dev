import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import type { SubscribeSubmission } from '@calwebtech/shared';
import { ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';
import { SubscribersService } from './subscribers.controller';
import { SubmissionGuard } from '../antispam/submission-guard';

/**
 * The rules of the public subscribe form, against a real database. Each one is a rule about
 * what a stranger with a text box must not be able to do.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const run = Date.now().toString(36);
const databaseName = `calwebtech_subscribers_${run}`;

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: withDatabase(env.DATABASE_URL, databaseName) });
const passes = new SubscribersService(prisma, new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000), SubmissionGuard.off());
const fails = new SubscribersService(prisma, new TurnstileService(TURNSTILE_TEST.alwaysFailsSecret, fetch, 15_000), SubmissionGuard.off());

let sequence = 0;
function submission(overrides: Partial<SubscribeSubmission> = {}): SubscribeSubmission {
  sequence += 1;
  return {
    email: `sub-${run}-${String(sequence)}@example.com`,
    sourcePage: '/',
    turnstileToken: TURNSTILE_TEST.dummyToken,
    ...overrides,
  };
}

const count = (email: string) => prisma.client.subscriber.count({ where: { email } });

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(withDatabase(env.DATABASE_URL, databaseName));
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('subscribing from the website', () => {
  it('stores the subscriber with the consent it was given under, and a contact to hang it on', async () => {
    const input = submission({ sourcePage: '/insights/some-post/' });
    await expect(passes.subscribe(input, '203.0.113.9')).resolves.toEqual({ status: 'subscribed' });

    const stored = await prisma.client.subscriber.findUniqueOrThrow({
      where: { email: input.email },
      include: { contact: true },
    });
    expect(stored.sourcePage).toBe('/insights/some-post/');
    expect(stored.consentIp).toBe('203.0.113.9');
    expect(stored.consentAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(stored.unsubscribedAt).toBeNull();
    expect(stored.contact?.email).toBe(input.email);
  });

  it('reuses the contact a lead or a booking already made, rather than making a second person', async () => {
    const email = `known-${run}@example.com`;
    const contact = await prisma.client.contact.create({ data: { email, name: 'Dana Whitfield' } });

    await passes.subscribe(submission({ email }), undefined);

    const stored = await prisma.client.subscriber.findUniqueOrThrow({ where: { email } });
    expect(stored.contactId).toBe(contact.id);
    // The name a lead gave is not touched by somebody typing their address into a box.
    expect((await prisma.client.contact.findUniqueOrThrow({ where: { id: contact.id } })).name).toBe('Dana Whitfield');
    expect(await prisma.client.contact.count({ where: { email } })).toBe(1);
  });

  it('is idempotent, and keeps the first consent as the record', async () => {
    const input = submission();
    await passes.subscribe(input, '203.0.113.9');
    const first = await prisma.client.subscriber.findUniqueOrThrow({ where: { email: input.email } });

    await passes.subscribe({ ...input, sourcePage: '/somewhere-else/' }, '198.51.100.7');

    expect(await count(input.email)).toBe(1);
    const again = await prisma.client.subscriber.findUniqueOrThrow({ where: { email: input.email } });
    expect(again.consentAt).toEqual(first.consentAt);
    expect(again.consentIp).toBe('203.0.113.9');
    expect(again.sourcePage).toBe('/');
  });

  it('lets one of two simultaneous subscriptions of the same address through, and tells both they are subscribed', async () => {
    const input = submission();
    const results = await Promise.all([passes.subscribe(input, '203.0.113.9'), passes.subscribe(input, '203.0.113.10')]);
    expect(results).toEqual([{ status: 'subscribed' }, { status: 'subscribed' }]);
    expect(await count(input.email)).toBe(1);
  });

  it('treats the same address in another case as the same person', async () => {
    const input = submission();
    await passes.subscribe(input, '203.0.113.9');
    // The contract lower-cases; a caller that skips it still cannot make a second row.
    await passes.subscribe({ ...input, email: input.email.toUpperCase() }, '203.0.113.9');
    expect(await prisma.client.subscriber.count({ where: { email: { equals: input.email, mode: 'insensitive' } } })).toBe(1);
  });
});

describe('what a stranger typing somebody else\'s address must not be able to do', () => {
  it('leave an address that unsubscribed exactly as it was', async () => {
    const email = `gone-${run}@example.com`;
    const unsubscribedAt = new Date('2026-08-01T10:00:00.000Z');
    await prisma.client.subscriber.create({ data: { email, consentAt: new Date('2026-01-01'), unsubscribedAt } });
    await prisma.client.suppression.create({ data: { email, reason: 'unsubscribe' } });

    await expect(passes.subscribe(submission({ email }), '203.0.113.9')).resolves.toEqual({ status: 'subscribed' });

    const after = await prisma.client.subscriber.findUniqueOrThrow({ where: { email } });
    expect(after.unsubscribedAt).toEqual(unsubscribedAt);
    expect(await prisma.client.suppression.count({ where: { email } })).toBe(1);
  });

  it('leave a bounced or complained-about address suppressed, whatever the form says', async () => {
    for (const reason of ['hard_bounce', 'complaint', 'manual']) {
      const email = `${reason}-${run}@example.com`;
      await prisma.client.suppression.create({ data: { email, reason } });

      await expect(passes.subscribe(submission({ email }), '203.0.113.9')).resolves.toEqual({ status: 'subscribed' });

      // Recorded, so the person is not lost — and still suppressed, so no campaign reaches them.
      expect(await prisma.client.suppression.count({ where: { email } })).toBe(1);
    }
  });

  it('learn anything from the answer: it is the same for a new address and one that asked to be left alone', async () => {
    const fresh = await passes.subscribe(submission(), '203.0.113.9');
    const email = `asked-${run}@example.com`;
    await prisma.client.suppression.create({ data: { email, reason: 'unsubscribe' } });
    const suppressed = await passes.subscribe(submission({ email }), '203.0.113.9');
    expect(suppressed).toEqual(fresh);
  });
});

describe('the bot defences', () => {
  it('discards a submission whose honeypot is filled, and says it worked', async () => {
    const input = submission({ referenceCode: 'I am a bot' });
    await expect(passes.subscribe(input, '203.0.113.9')).resolves.toEqual({ status: 'subscribed' });
    expect(await count(input.email)).toBe(0);
  });

  it('refuses a submission that failed the bot check, and stores nothing', async () => {
    const input = submission();
    await expect(fails.subscribe(input, '203.0.113.9')).rejects.toBeInstanceOf(ForbiddenException);
    expect(await count(input.email)).toBe(0);
  });
});
