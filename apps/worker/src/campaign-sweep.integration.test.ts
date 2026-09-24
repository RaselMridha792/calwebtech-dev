import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCampaignSweep } from './campaign-sweep';

/**
 * The sweep against a real database (Task 5.4): a due campaign starts once however many
 * sweeps race for it, its segment is counted at that moment with suppression applied, every
 * recipient not yet sent to is queued, and a campaign with nobody left is finished.
 *
 * The database is created beside DATABASE_URL, migrated with the db package's Prisma CLI and
 * dropped afterwards. The queue is a recorder: this is about what the sweep decides.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required for the worker integration tests');

const run = Date.now().toString(36);
const databaseName = `calwebtech_sweep_${run}`;
const databaseUrl = (() => {
  const parsed = new URL(DATABASE_URL);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
})();

const admin = createPrismaClient(DATABASE_URL);
const db = createPrismaClient(databaseUrl);
const logs: string[] = [];
const log = (line: string) => {
  logs.push(line);
};

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

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrate();
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);

  await db.subscriber.createMany({
    data: [
      { id: 'ava', email: 'ava@example.com', name: 'Ava', consentAt: new Date() },
      { id: 'ben', email: 'ben@example.org', name: 'Ben', consentAt: new Date() },
      { id: 'cara', email: 'cara@example.com', consentAt: new Date(), unsubscribedAt: new Date() },
      { id: 'eli', email: 'Eli@Example.com', consentAt: new Date() },
    ],
  });
  await db.suppression.create({ data: { email: 'eli@example.com', reason: 'hard_bounce' } });
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

async function campaign(scheduledAt: Date, withSegment = true): Promise<string> {
  const segment = withSegment
    ? await db.segment.create({ data: { name: `Everyone ${String(Math.random())}`, rules: { match: 'all', conditions: [] } } })
    : null;
  const row = await db.campaign.create({
    data: {
      name: 'Autumn',
      subject: 'Hi {{firstName|there}}',
      templateKey: 'letter',
      body: { blocks: [{ type: 'paragraph', text: 'Hello.' }] },
      status: 'SCHEDULED',
      scheduledAt,
      segmentId: segment?.id ?? null,
    },
  });
  return row.id;
}

describe('campaign sweep', () => {
  it('starts a due campaign once, counting its segment with suppression applied, and queues everyone', async () => {
    const id = await campaign(new Date(Date.now() - 1000));
    const queued: string[] = [];
    const enqueue = (ids: readonly string[]) => {
      queued.push(...ids);
      return Promise.resolve();
    };

    // Two sweeps at once: the conditional update lets exactly one start it.
    const results = await Promise.all([
      runCampaignSweep({ db, enqueue, canSend: true, log }),
      runCampaignSweep({ db, enqueue, canSend: true, log }),
    ]);
    expect(results.flatMap((result) => result.started)).toEqual([id]);

    const recipients = await db.campaignRecipient.findMany({ where: { campaignId: id }, orderBy: { email: 'asc' } });
    expect(recipients.map((row) => row.email)).toEqual(['ava@example.com', 'ben@example.org']);
    expect(new Set(queued)).toEqual(new Set(recipients.map((row) => row.id)));
    expect((await db.campaign.findUniqueOrThrow({ where: { id } })).status).toBe('SENDING');
  });

  it('finishes a campaign once nobody is left, SENT when anyone received it', async () => {
    const id = await campaign(new Date(Date.now() - 1000));
    await runCampaignSweep({ db, enqueue: () => Promise.resolve(), canSend: true, log });
    const [first, second] = await db.campaignRecipient.findMany({ where: { campaignId: id }, orderBy: { email: 'asc' } });
    if (!first || !second) throw new Error('expected two recipients');
    await db.campaignRecipient.update({ where: { id: first.id }, data: { sentAt: new Date(), providerId: 'p1' } });
    await db.campaignRecipient.update({ where: { id: second.id }, data: { failedAt: new Date(), error: 'suppressed' } });

    const requeued: string[] = [];
    const result = await runCampaignSweep({
      db,
      enqueue: (ids) => {
        requeued.push(...ids);
        return Promise.resolve();
      },
      canSend: true,
      log,
    });
    expect(result.finished).toContain(id);
    expect(requeued.filter((rid) => rid === first.id || rid === second.id)).toEqual([]);
    const done = await db.campaign.findUniqueOrThrow({ where: { id } });
    expect(done.status).toBe('SENT');
    expect(done.sentAt).not.toBeNull();
  });

  it('leaves a campaign scheduled when no unsubscribe link could be signed, and fails one with no segment', async () => {
    const waiting = await campaign(new Date(Date.now() - 1000));
    await runCampaignSweep({ db, enqueue: () => Promise.resolve(), canSend: false, log });
    expect((await db.campaign.findUniqueOrThrow({ where: { id: waiting } })).status).toBe('SCHEDULED');
    expect(logs.some((line) => line.includes('not started'))).toBe(true);

    const orphan = await campaign(new Date(Date.now() - 1000), false);
    await runCampaignSweep({ db, enqueue: () => Promise.resolve(), canSend: true, log });
    expect((await db.campaign.findUniqueOrThrow({ where: { id: orphan } })).status).toBe('FAILED');
  });

  it('does not start a campaign before its time', async () => {
    const later = await campaign(new Date(Date.now() + 60 * 60 * 1000));
    const result = await runCampaignSweep({ db, enqueue: () => Promise.resolve(), canSend: true, log });
    expect(result.started).not.toContain(later);
    expect((await db.campaign.findUniqueOrThrow({ where: { id: later } })).status).toBe('SCHEDULED');
  });
});
