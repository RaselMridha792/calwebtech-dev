import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import { OVERVIEW_TREND_DAYS, adminOverviewSchema } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { AdminOverviewService } from './admin-overview.service';

/**
 * The overview (docs/12-admin-dashboard.md, screen 1): what each role's first screen
 * carries, counted from the database rather than assumed, against the imported content and
 * a handful of leads placed at known ages.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_overview_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const overview = new AdminOverviewService(prisma, new SettingsService(prisma));

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const ago = (days: number): Date => new Date(now.getTime() - days * DAY_MS);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  await importSnapshots(db, { dir: snapshotDir });

  const lead = (name: string, days: number, extra: Record<string, unknown> = {}) =>
    db.lead.create({ data: { type: 'CONTACT', name, email: `${name.toLowerCase()}@example.com`, createdAt: ago(days), ...extra } });
  // Two this week, one the week before, one last month, one deleted.
  await lead('Ada', 1, { attribution: { create: { lastTouchUtm: { source: 'google', medium: 'cpc' } } } });
  await lead('Ben', 3, { status: 'CONTACTED', nextActionDate: ago(1) });
  await lead('Cleo', 10);
  await lead('Dev', 40, { status: 'WON' });
  await lead('Eve', 2, { deletedAt: now });
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('the overview', () => {
  it('counts leads by period, day, status and channel, leaving deleted ones out', async () => {
    const view = adminOverviewSchema.parse(await overview.overview('OWNER', now));
    const leads = view.leads;
    expect(leads).not.toBeNull();
    if (!leads) return;
    expect(leads.week).toEqual({ current: 2, previous: 1 });
    expect(leads.month).toEqual({ current: 3, previous: 1 });
    expect(leads.daily).toHaveLength(OVERVIEW_TREND_DAYS);
    expect(leads.daily.reduce((sum, day) => sum + day.count, 0)).toBe(3);
    expect(leads.byStatus).toMatchObject({ NEW: 2, CONTACTED: 1, WON: 1 });
    expect(leads.byChannel[0]).toEqual({ channel: 'direct', count: 2 });
    expect(leads.byChannel).toContainEqual({ channel: 'google-paid', count: 1 });
    expect(leads.latest.map((lead) => lead.name)).toEqual(['Ada', 'Ben', 'Cleo', 'Dev']);
    expect(leads.unassignedNew).toBe(2);
    expect(leads.overdue).toBe(1);
  });

  it('reads the imported content, newest edit first', async () => {
    const view = await overview.overview('OWNER', now);
    const content = view.content;
    expect(content).not.toBeNull();
    if (!content) return;
    const services = content.families.find((family) => family.kind === 'service');
    expect(services?.published).toBeGreaterThan(0);
    expect(content.recent.length).toBeGreaterThan(0);
    const times = content.recent.map((item) => Date.parse(item.updatedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(content.recent.every((item) => item.href.startsWith('/admin/'))).toBe(true);
  });

  it('carries only what the role can open', async () => {
    const editor = await overview.overview('EDITOR', now);
    expect(editor.leads).toBeNull();
    expect(editor.bookings).toBeNull();
    expect(editor.audience).toBeNull();
    expect(editor.campaigns).toBeNull();
    expect(editor.content).not.toBeNull();

    const sales = await overview.overview('SALES', now);
    expect(sales.leads).not.toBeNull();
    expect(sales.content).toBeNull();
    expect(sales.media).toBeNull();

    // A viewer reads everything but never sees an address.
    const viewer = await overview.overview('VIEWER', now);
    expect(JSON.stringify(viewer.leads)).not.toContain('@example.com');
  });
});
