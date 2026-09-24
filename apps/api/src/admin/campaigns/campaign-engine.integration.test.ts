import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import type { CampaignWrite } from '@calwebtech/shared';
import { signUnsubscribeToken } from '@calwebtech/shared/unsubscribe-token';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import type { CampaignSweepQueue } from '../../queue/campaign-sweep-queue';
import type { EmailQueue } from '../../queue/email-queue';
import { UnsubscribeService } from '../../unsubscribe/unsubscribe.controller';
import { ResendWebhookService } from '../../webhooks/resend-webhook.controller';
import { AdminAudienceService } from '../audience/admin-audience.service';
import { AdminCampaignsService } from './admin-campaigns.service';

/**
 * The campaign engine's rules that only a real database can prove (Task 5.4):
 *
 * - a segment never counts a suppressed or unsubscribed address, however its case is written
 * - only a draft with a segment can be scheduled, and never into the past
 * - an unsubscribe link stops mail to one address and nothing else
 * - a permanent bounce or a complaint suppresses the address, a repeated webhook is applied once
 * - the report counts people, with each count including the ones past it
 *
 * The database is created beside DATABASE_URL and dropped afterwards. No queue is touched:
 * the two queues the campaign service holds are replaced by recorders.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const SECRET = 'integration-signing-secret-0123456789';
const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite', AUTH_SECRET: SECRET });
const run = Date.now().toString(36);
const databaseName = `calwebtech_campaigns_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const audit = new AuditService(prisma);
const audience = new AdminAudienceService(prisma, audit);

const queued: unknown[] = [];
const sweeps: string[] = [];
const emailQueue = {
  enqueue: (jobs: readonly unknown[]) => {
    queued.push(...jobs);
    return Promise.resolve();
  },
} as unknown as EmailQueue;
const sweepQueue = {
  sweepNow: (reason: string) => {
    sweeps.push(reason);
    return Promise.resolve();
  },
} as unknown as CampaignSweepQueue;
const campaigns = new AdminCampaignsService(prisma, audit, audience, emailQueue, sweepQueue, { ...env, AUTH_SECRET: SECRET });
const unsubscribes = new UnsubscribeService(prisma, audit, { ...env, AUTH_SECRET: SECRET });
const webhooks = new ResendWebhookService(prisma);

let ownerId = '';
const DAY = 24 * 60 * 60 * 1000;

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function draft(overrides: Partial<CampaignWrite> = {}): CampaignWrite {
  return {
    name: 'Autumn update',
    subject: 'News for {{firstName|you}}',
    preheader: null,
    templateKey: 'letter',
    segmentId: null,
    body: { blocks: [{ type: 'paragraph', text: 'Hi {{firstName|there}}.' }] },
    ...overrides,
  };
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);

  const owner = await db.user.create({
    data: { email: 'owner@calwebtech.test', name: 'The Owner', role: 'OWNER', passwordHash: 'x' },
    select: { id: true },
  });
  ownerId = owner.id;

  const now = Date.now();
  await db.subscriber.createMany({
    data: [
      { id: 'ava', email: 'ava@example.com', name: 'Ava Stone', consentAt: new Date(now - 5 * DAY), lastEngagedAt: new Date(now - DAY) },
      { id: 'ben', email: 'ben@example.org', name: 'Ben Hale', consentAt: new Date(now - 60 * DAY) },
      { id: 'cara', email: 'cara@example.com', consentAt: new Date(now - 200 * DAY), unsubscribedAt: new Date(now - 10 * DAY) },
      { id: 'eli', email: 'Eli@Example.com', name: 'Eli Moss', consentAt: new Date(now - 3 * DAY) },
    ],
  });
  await db.subscriberTag.createMany({
    data: ['ava', 'ben', 'cara', 'eli'].map((subscriberId) => ({ subscriberId, tagName: 'newsletter' })),
  });
  // Stored in lower case, the subscriber in mixed case: the comparison must not care.
  await db.suppression.create({ data: { email: 'eli@example.com', reason: 'hard_bounce' } });
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('segments', () => {
  it('never count a suppressed or unsubscribed address', async () => {
    const preview = await audience.preview({ match: 'all', conditions: [{ field: 'tag', op: 'has', value: 'newsletter' }] });
    expect(preview.count).toBe(2);
    expect(preview.sample.map((person) => person.email).sort()).toEqual(['ava@example.com', 'ben@example.org']);
  });

  it('evaluate relative dates against now', async () => {
    const recent = await audience.preview({ match: 'all', conditions: [{ field: 'subscribed', op: 'withinDays', days: 30 }] });
    expect(recent.sample.map((person) => person.email)).toEqual(['ava@example.com']);
    const quiet = await audience.preview({ match: 'all', conditions: [{ field: 'engaged', op: 'notWithinDays', days: 30 }] });
    expect(quiet.sample.map((person) => person.email)).toEqual(['ben@example.org']);
  });

  it('cannot be deleted while a campaign uses one', async () => {
    const segment = await audience.createSegment({ name: 'In use', description: null, rules: { match: 'all', conditions: [] } }, ownerId);
    await campaigns.create(draft({ segmentId: segment.id }), ownerId);
    await expect(audience.deleteSegment(segment.id, ownerId)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('scheduling', () => {
  it('needs a segment, refuses the past, locks the draft and can be taken back', async () => {
    const campaign = await campaigns.create(draft(), ownerId);
    await expect(campaigns.schedule(campaign.id, { sendAt: null }, ownerId)).rejects.toBeInstanceOf(ConflictException);

    const segment = await audience.createSegment(
      { name: 'Newsletter', description: null, rules: { match: 'all', conditions: [{ field: 'tag', op: 'has', value: 'newsletter' }] } },
      ownerId,
    );
    await campaigns.update(campaign.id, draft({ segmentId: segment.id }), ownerId);
    await expect(
      campaigns.schedule(campaign.id, { sendAt: new Date(Date.now() - DAY).toISOString() }, ownerId),
    ).rejects.toBeInstanceOf(BadRequestException);

    const later = new Date(Date.now() + DAY).toISOString();
    const scheduled = await campaigns.schedule(campaign.id, { sendAt: later }, ownerId);
    expect(scheduled.status).toBe('SCHEDULED');
    expect(sweeps).toEqual([]);
    await expect(campaigns.update(campaign.id, draft({ segmentId: segment.id }), ownerId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect((await campaigns.unschedule(campaign.id, ownerId)).status).toBe('DRAFT');
    expect((await campaigns.schedule(campaign.id, { sendAt: null }, ownerId)).status).toBe('SCHEDULED');
    expect(sweeps).toHaveLength(1);

    const entries = await db.auditLog.findMany({ where: { entityId: campaign.id }, select: { action: true } });
    expect(entries.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['campaign.created', 'campaign.scheduled', 'campaign.unscheduled']),
    );
  });
});

describe('unsubscribing', () => {
  it('stops mail to that address, once, and a forged link does nothing', async () => {
    const token = signUnsubscribeToken('ben', SECRET);
    expect(await unsubscribes.view(token)).toEqual({ email: 'b**@example.org', unsubscribed: false });
    await unsubscribes.unsubscribe(token);
    await unsubscribes.unsubscribe(token);

    const ben = await db.subscriber.findUniqueOrThrow({ where: { id: 'ben' } });
    expect(ben.unsubscribedAt).not.toBeNull();
    expect(await db.suppression.count({ where: { email: 'ben@example.org', reason: 'unsubscribe' } })).toBe(1);

    await expect(unsubscribes.view(signUnsubscribeToken('ava', 'another-secret-of-length'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const ava = await db.subscriber.findUniqueOrThrow({ where: { id: 'ava' } });
    expect(ava.unsubscribedAt).toBeNull();
  });
});

describe('delivery events and the report', () => {
  it('stamp recipients, suppress on a hard bounce or complaint, and count people', async () => {
    const campaign = await campaigns.create(draft({ name: 'Reported' }), ownerId);
    const sentAt = new Date();
    await db.campaignRecipient.createMany({
      data: [
        { campaignId: campaign.id, subscriberId: 'ava', email: 'ava@example.com', sentAt, providerId: 'p-ava' },
        { campaignId: campaign.id, email: 'bounce@example.net', sentAt, providerId: 'p-bounce' },
        { campaignId: campaign.id, email: 'soft@example.net', sentAt, providerId: 'p-soft' },
        { campaignId: campaign.id, email: 'spam@example.net', sentAt, providerId: 'p-spam' },
        { campaignId: campaign.id, email: 'skipped@example.net', failedAt: sentAt, error: 'suppressed' },
      ],
    });

    const event = (type: string, emailId: string, to: string, extra: Record<string, unknown> = {}) => ({
      type,
      created_at: new Date().toISOString(),
      data: { email_id: emailId, to: [to], ...extra },
    });
    await webhooks.receive('m1', event('email.delivered', 'p-ava', 'ava@example.com'));
    await webhooks.receive('m2', event('email.opened', 'p-ava', 'ava@example.com'));
    await webhooks.receive('m3', event('email.clicked', 'p-ava', 'ava@example.com'));
    expect(await webhooks.receive('m3', event('email.clicked', 'p-ava', 'ava@example.com'))).toEqual({ status: 'duplicate' });
    await webhooks.receive('m4', event('email.bounced', 'p-bounce', 'bounce@example.net', { bounce: { type: 'Permanent' } }));
    await webhooks.receive('m5', event('email.bounced', 'p-soft', 'soft@example.net', { bounce: { type: 'Transient' } }));
    await webhooks.receive('m6', event('email.complained', 'p-spam', 'spam@example.net'));
    expect(await webhooks.receive('m7', event('email.sent', 'p-ava', 'ava@example.com'))).toEqual({ status: 'ignored' });

    const suppressed = await db.suppression.findMany({
      where: { email: { in: ['bounce@example.net', 'soft@example.net', 'spam@example.net'] } },
      select: { email: true, reason: true },
      orderBy: { email: 'asc' },
    });
    expect(suppressed).toEqual([
      { email: 'bounce@example.net', reason: 'hard_bounce' },
      { email: 'spam@example.net', reason: 'complaint' },
    ]);
    expect((await db.subscriber.findUniqueOrThrow({ where: { id: 'ava' } })).lastEngagedAt?.getTime()).toBeGreaterThan(
      sentAt.getTime() - 1000,
    );
    expect(await db.emailEvent.count()).toBe(6);

    const report = await campaigns.report(campaign.id, { page: 1 });
    expect(report.totals).toEqual({
      recipients: 5,
      sent: 4,
      notSent: 1,
      delivered: 1,
      opened: 1,
      clicked: 1,
      bounced: 2,
      complained: 1,
      unsubscribed: 0,
    });
    const states = Object.fromEntries(report.recipients.items.map((item) => [item.email, item.state]));
    expect(states).toEqual({
      'ava@example.com': 'clicked',
      'bounce@example.net': 'bounced',
      'skipped@example.net': 'not_sent',
      'soft@example.net': 'bounced',
      'spam@example.net': 'complained',
    });
    const bounced = await campaigns.report(campaign.id, { page: 1, state: 'bounced' });
    expect(bounced.recipients.items.map((item) => item.email)).toEqual(['bounce@example.net', 'soft@example.net']);
  });
});
