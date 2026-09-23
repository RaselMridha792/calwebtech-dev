import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { IMPORT_MARKER_KEY, importSnapshots } from '@calwebtech/db/import';
import { EMAIL_QUEUE, type CalculatorAnswers, type LeadSubmission } from '@calwebtech/shared';
import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { LeadsService } from '../leads/leads.service';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TURNSTILE_TEST } from '../turnstile/turnstile-test-keys';
import { TurnstileService } from '../turnstile/turnstile.service';

/**
 * The snapshot import's acceptance test (decision 43): on an empty, migrated database of
 * its own, which is what production is on its first deploy, the import alone must be enough
 * for every form on the snapshot-rendered site to store its lead and queue its emails.
 *
 * The database is created on the same server as DATABASE_URL (the CI service and the local
 * Compose Postgres both let the application user do that) and dropped afterwards, so the
 * placeholder seed and the fixtures the other suites rely on are never touched. Emails go
 * to a queue of this run's own that no worker consumes.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: TURNSTILE_TEST.alwaysPassesSecret });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_import_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const queueName = `${EMAIL_QUEUE}-import-integration-${String(process.pid)}-${run}`;
const emailQueue = new EmailQueue(env.REDIS_URL, queueName);
const inspectConnection = new Redis(env.REDIS_URL);
const inspect = new Queue(queueName, { connection: inspectConnection });
const leads = new LeadsService(
  prisma,
  new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000),
  new SettingsService(prisma),
  emailQueue,
);

/** What the contact page offers: the snapshot the web app renders in production. */
const offered = (
  JSON.parse(readFileSync(path.join(snapshotDir, 'static/contact.json'), 'utf8')) as { enquiryTypes: { slug: string; name: string }[] }
).enquiryTypes;

const ANSWERS: CalculatorAnswers = {
  projectType: 'ecommerce',
  timeline: 'within-8-weeks',
  pageCount: '50-150',
  designDepth: 'custom-design',
  content: 'write-it-for-us',
  integrations: ['payments', 'erp-inventory'],
  cms: 'shopify',
  support: 'ongoing-partner',
};

let sequence = 0;
function submission(overrides: Partial<LeadSubmission>): LeadSubmission {
  sequence += 1;
  return {
    type: 'CONTACT',
    formId: 'contact-form',
    name: 'Import Test',
    email: `import+${run}-${String(sequence)}@example.com`,
    serviceInterest: [],
    attribution: { landingPage: '/contact/' },
    turnstileToken: TURNSTILE_TEST.dummyToken,
    ...overrides,
  };
}

async function queuedTemplates(email: string): Promise<string[]> {
  const jobs = await inspect.getJobs(['waiting', 'prioritized', 'delayed']);
  return jobs
    .map((job) => job.data as { template: string; to: string[] })
    .filter((data) => data.to.includes(email))
    .map((data) => data.template);
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const result = await importSnapshots(db, { dir: snapshotDir });
  if (result.status !== 'imported') throw new Error('the import was skipped on an empty database');
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

describe('snapshot import on an empty database', () => {
  it('records the marker, so the next deploy changes nothing', async () => {
    const marker = await db.setting.findUnique({ where: { key: IMPORT_MARKER_KEY } });
    expect(marker?.value).toMatchObject({
      source: 'apps/web/static-content',
      families: ['operational', 'references', 'work', 'services'],
    });

    await db.enquiryType.update({ where: { slug: 'support' }, data: { mailbox: 'support@example.com' } });
    expect((await importSnapshots(db, { dir: snapshotDir })).status).toBe('skipped');
    expect((await db.enquiryType.findUniqueOrThrow({ where: { slug: 'support' } })).mailbox).toBe('support@example.com');
  });

  it('runs a family added after launch, and leaves the ones already imported alone', async () => {
    // What a deploy does the day a new family is appended to the registry: the marker names
    // the four that ran, so only the new one runs. This is the path that got the booking
    // rows onto a live database without re-importing content somebody had edited.
    await db.setting.update({
      where: { key: IMPORT_MARKER_KEY },
      data: { value: { importedAt: new Date().toISOString(), source: 'apps/web/static-content', families: ['operational'] } },
    });
    await db.technology.deleteMany({});

    const result = await importSnapshots(db, { dir: snapshotDir });
    expect(result).toMatchObject({ status: 'imported' });
    expect(result.status === 'imported' ? result.families : []).toEqual(['references', 'work', 'services']);
    expect(await db.technology.count()).toBeGreaterThan(0);
    // The mailbox belongs to the family that was skipped, so it is still there.
    expect((await db.enquiryType.findUniqueOrThrow({ where: { slug: 'support' } })).mailbox).toBe('support@example.com');

    const marker = await db.setting.findUniqueOrThrow({ where: { key: IMPORT_MARKER_KEY } });
    expect(marker.value).toMatchObject({ families: ['operational', 'references', 'work', 'services'] });
    expect((await importSnapshots(db, { dir: snapshotDir })).status).toBe('skipped');
  });

  it('keeps a mailbox a person set, even when the import is forced', async () => {
    expect((await importSnapshots(db, { dir: snapshotDir, force: true })).status).toBe('imported');
    expect((await db.enquiryType.findUniqueOrThrow({ where: { slug: 'support' } })).mailbox).toBe('support@example.com');
  });

  it('offers at least one enquiry type on the contact page', () => {
    expect(offered.length).toBeGreaterThan(0);
  });

  for (const type of offered) {
    it(`stores a contact enquiry of type "${type.slug}" and queues its confirmation`, async () => {
      const input = submission({ enquiryType: type.slug });
      await expect(leads.create(input, '203.0.113.9')).resolves.toEqual({ status: 'received' });

      const lead = await db.lead.findFirstOrThrow({ where: { email: input.email } });
      expect(lead.answers).toMatchObject({ enquiryType: type.slug });
      expect(await queuedTemplates(input.email)).toContain('lead-confirmation');
    });
  }

  it('still refuses an enquiry type the page does not offer', async () => {
    const input = submission({ enquiryType: 'not-a-type' });
    await expect(leads.create(input, '203.0.113.9')).rejects.toBeInstanceOf(BadRequestException);
    expect(await db.lead.count({ where: { email: input.email } })).toBe(0);
  });

  it('gives a calculator lead its estimate and the emailed copy the page promises', async () => {
    const input = submission({ type: 'CALCULATOR', formId: 'cost-calculator', answers: ANSWERS, attribution: { landingPage: '/cost-calculator/' } });
    const result = await leads.create(input, '203.0.113.9');
    expect(result).toMatchObject({ status: 'received', estimate: { budgetBand: expect.any(String) as unknown } });

    // The result email is worded from the imported "calculator.page" setting. Without the
    // import the visitor would get the standard confirmation instead (calculator-lead.ts).
    const templates = await queuedTemplates(input.email);
    expect(templates).toContain('calculator-result');
    expect(templates).not.toContain('lead-confirmation');
  });

  it('stores a project lead from a page that has no record yet', async () => {
    // Landing pages are snapshots alone, so the slug resolves to nothing and the lead is
    // stored anyway with the default acknowledgement. The services have rows now, so this
    // names one that does not: what a form on a retired page would still send.
    const input = submission({ type: 'PROJECT', formId: 'lp-hero', landingPageSlug: 'b2b-website-design', serviceSlug: 'retired-service' });
    await expect(leads.create(input, '203.0.113.9')).resolves.toEqual({ status: 'received' });
    expect(await queuedTemplates(input.email)).toContain('lead-confirmation');
  });
});
