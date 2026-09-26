import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { adminBriefFunnelSchema, adminLeadQuerySchema } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLeadsService } from './admin-leads.service';

/**
 * Where start-a-project briefs stop (decision 69), counted from real rows: briefs left at
 * steps 3 to 6, sent briefs, a brief from before the period, and leads that are not briefs.
 * The inbox's brief filter and its row marker read the same answers.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_brief_funnel_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const leads = new AdminLeadsService(prisma, new AuditService(prisma));

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** A brief as the forms service stores one: a PROJECT lead whose answers carry the draft. */
function brief(name: string, furthestStep: number, options: { sent?: boolean; daysAgo?: number } = {}) {
  const at = new Date(now.getTime() - (options.daysAgo ?? 1) * DAY_MS);
  return db.lead.create({
    data: {
      type: 'PROJECT',
      name,
      email: `${name.toLowerCase()}@example.com`,
      createdAt: at,
      answers: {
        draft: {
          token: 'token',
          formId: 'start-a-project',
          step: furthestStep,
          furthestStep,
          startedAt: at.toISOString(),
          updatedAt: at.toISOString(),
          ...(options.sent ? { completedAt: at.toISOString() } : {}),
        },
      },
    },
  });
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);

  await brief('Ana', 3);
  await brief('Ben', 3);
  await brief('Cal', 4);
  await brief('Dee', 5);
  await brief('Eve', 6);
  await brief('Fay', 6, { sent: true });
  await brief('Gus', 6, { sent: true });
  // Outside a 30-day window.
  await brief('Hal', 4, { daysAgo: 45 });
  // Not briefs at all.
  await db.lead.create({ data: { type: 'CONTACT', name: 'Ivy', email: 'ivy@example.com' } });
  await db.lead.create({ data: { type: 'PROJECT', name: 'Jon', email: 'jon@example.com' } });
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('the brief drop-off report', () => {
  it('counts how far each stored brief got, and where the unsent ones stopped', async () => {
    const funnel = adminBriefFunnelSchema.parse(await leads.briefFunnel(30, now));
    expect(funnel.started).toBe(7);
    expect(funnel.finished).toBe(2);
    expect(funnel.steps.map((step) => [step.step, step.reached, step.stoppedHere, step.measured])).toEqual([
      [1, 7, 0, false],
      [2, 7, 0, false],
      [3, 7, 2, true],
      [4, 5, 1, true],
      [5, 4, 1, true],
      [6, 3, 1, true],
    ]);
  });

  it('widens with the period', async () => {
    const funnel = await leads.briefFunnel(90, now);
    expect(funnel.started).toBe(8);
    expect(funnel.steps[3]).toMatchObject({ step: 4, stoppedHere: 2 });
  });
});

describe('the inbox brief filter', () => {
  const list = (params: Record<string, string>) =>
    leads.list(adminLeadQuerySchema.parse({ received: 'this-quarter', includeClosed: 'true', ...params }), 'nobody');

  it('shows only unsent briefs, each with the step it stopped at', async () => {
    const unfinished = await list({ brief: 'unfinished', received: 'last-90-days' });
    expect(unfinished.items.map((lead) => lead.name).sort()).toEqual(['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Hal']);
    expect(unfinished.items.find((lead) => lead.name === 'Dee')?.unfinishedBriefStep).toBe(5);
  });

  it('shows only sent briefs, which carry no marker', async () => {
    const finished = await list({ brief: 'finished', received: 'last-90-days' });
    expect(finished.items.map((lead) => lead.name).sort()).toEqual(['Fay', 'Gus']);
    expect(finished.items.every((lead) => lead.unfinishedBriefStep === null)).toBe(true);
  });

  it('combines with the other filters, and marks nothing that is not a brief', async () => {
    const all = await list({ received: 'last-90-days' });
    expect(all.items.find((lead) => lead.name === 'Ivy')?.unfinishedBriefStep).toBeNull();
    expect(all.items.find((lead) => lead.name === 'Jon')?.unfinishedBriefStep).toBeNull();
    const searched = await list({ brief: 'unfinished', search: 'ana', received: 'last-90-days' });
    expect(searched.items.map((lead) => lead.name)).toEqual(['Ana']);
  });
});
