import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { HOME_CONTENT, PLACEHOLDER_CONTACT, WORK_PLACEHOLDER_COPY } from '@calwebtech/db/seed';
import {
  COMPARISON_ERRORS,
  SETTING_KEYS,
  WORK_COPY_SETTING_KEY,
  caseStudyInputSchema,
  comparisonInputSchema,
  workCopySchema,
  type ComparisonInputDraft,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { HomePageService } from '../../home/home-page.service';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkService } from '../../work/work.service';
import { AdminCaseStudiesService } from '../case-studies/admin-case-studies.service';
import { AdminComparisonsService } from './admin-comparisons.service';

/**
 * A comparison from the dashboard to `/before-and-after/` and the homepage (decision 70): a
 * draft, published, linked to a case study only while that page is live, edited, marked for
 * the homepage, removed but kept, and an audit entry for every step. Both pages are built by
 * the API's own services, so what they show is what the site renders.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_admin_comparisons_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const comparisons = new AdminComparisonsService(prisma);
const actor = { id: '', ip: '203.0.113.9' };

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Each page as the site would render it now; a new service each time, so no cached view. */
const beforeAndAfter = () => new WorkService(prisma).findBeforeAndAfter();
const homepage = () => new HomePageService(prisma).find();

const PICTURE = { width: 1448, height: 1086 };

function input(overrides: Partial<ComparisonInputDraft> = {}) {
  return comparisonInputSchema.parse({
    clientName: 'Test Harbour Co',
    heading: 'What changed when Test Harbour Co was redesigned?',
    summary: 'Test berth booking moved from the phone to the website.',
    before: { src: '/media/test-before.jpg', alt: 'Test harbour site before', ...PICTURE },
    after: { src: '/media/test-after.jpg', alt: 'Test harbour site after', ...PICTURE },
    metrics: [{ label: 'Test bookings', before: '3', after: '9' }],
    ...overrides,
  });
}

const ANSWER =
  'Test Harbour Co needed berths booked online instead of by phone. We built a booking site on Next.js. Online bookings tripled in a season.';

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const user = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
  // The copy around both pages, which neither can be built without.
  await db.setting.createMany({
    data: [
      { key: WORK_COPY_SETTING_KEY, value: workCopySchema.parse(WORK_PLACEHOLDER_COPY) },
      { key: SETTING_KEYS.homeContent, value: HOME_CONTENT },
      { key: SETTING_KEYS.contact, value: PLACEHOLDER_CONTACT },
    ],
  });
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('a comparison edited in the dashboard', () => {
  let id = '';
  let caseStudyId = '';

  it('is created as a draft, which neither page shows', async () => {
    const created = await comparisons.create(input({ onHomepage: true }), actor);
    id = created.id;
    expect(created.status).toBe('DRAFT');
    expect(created.record).toMatchObject({ clientName: 'Test Harbour Co', order: 0, onHomepage: true, projectId: null });
    expect((await beforeAndAfter()).comparisons).toEqual([]);
    expect((await homepage()).beforeAfter).toBeNull();
  });

  it('refuses a link to a case study that does not exist, rather than dropping it', async () => {
    await expect(comparisons.update(id, input({ projectId: 'test-missing' }), actor)).rejects.toMatchObject({
      response: { error: COMPARISON_ERRORS.unknownLink },
    });
  });

  it('is on both pages once published: the same pictures, words and figures', async () => {
    const published = await comparisons.publish(id, actor);
    expect(published.shownOnHomepage).toBe(true);

    const [page] = (await beforeAndAfter()).comparisons;
    expect(page).toEqual({
      slug: null,
      clientName: 'Test Harbour Co',
      heading: 'What changed when Test Harbour Co was redesigned?',
      summary: 'Test berth booking moved from the phone to the website.',
      before: { src: '/media/test-before.jpg', alt: 'Test harbour site before', ...PICTURE },
      after: { src: '/media/test-after.jpg', alt: 'Test harbour site after', ...PICTURE },
      metrics: [{ label: 'Test bookings', before: '3', after: '9' }],
      onHomepage: true,
    });
    expect((await homepage()).beforeAfter).toEqual({
      clientName: page?.clientName,
      before: page?.before,
      after: page?.after,
      metrics: page?.metrics,
    });
  });

  it('links its case study only while that page is published', async () => {
    const caseStudies = new AdminCaseStudiesService(prisma, new AuditService(prisma));
    const study = await caseStudies.create(
      caseStudyInputSchema.parse({
        title: 'Test berths booked online for Test Harbour Co',
        slug: 'test-harbour-co',
        clientName: 'Test Harbour Co',
        summary: 'Test berth booking moved from the phone to the website.',
        answerBlock: ANSWER,
        metrics: [
          { value: '3x', label: 'Test online bookings' },
          { value: '-60%', label: 'Test phone calls' },
          { value: '1.4s', label: 'Test mobile load' },
        ],
      }),
      actor,
    );
    caseStudyId = study.id;
    await comparisons.update(id, input({ onHomepage: true, projectId: caseStudyId }), actor);
    expect((await beforeAndAfter()).comparisons[0]?.slug).toBeNull();

    await caseStudies.publish(caseStudyId, actor);
    expect((await beforeAndAfter()).comparisons[0]?.slug).toBe('test-harbour-co');
    expect((await comparisons.list()).items[0]?.caseStudy).toEqual({ id: caseStudyId, clientName: 'Test Harbour Co', slug: 'test-harbour-co' });
  });

  it('reaches both pages when edited, and the homepage follows the mark in the page’s order', async () => {
    await comparisons.update(
      id,
      input({ projectId: caseStudyId, onHomepage: true, summary: 'Test summary changed in the dashboard.', metrics: [] }),
      actor,
    );
    const second = await comparisons.create(
      input({ clientName: 'Test Second Co', heading: 'What changed for Test Second Co?', order: 1, onHomepage: true }),
      actor,
    );
    await comparisons.publish(second.id, actor);

    const page = await beforeAndAfter();
    expect(page.comparisons.map((item) => [item.clientName, item.summary])).toEqual([
      ['Test Harbour Co', 'Test summary changed in the dashboard.'],
      ['Test Second Co', 'Test berth booking moved from the phone to the website.'],
    ]);
    expect((await homepage()).beforeAfter).toMatchObject({ clientName: 'Test Harbour Co', metrics: [] });

    // Unmarking the first hands the homepage to the next one marked.
    await comparisons.update(id, input({ projectId: caseStudyId, onHomepage: false }), actor);
    expect((await homepage()).beforeAfter?.clientName).toBe('Test Second Co');
    const list = await comparisons.list();
    expect(list.items.map((item) => [item.clientName, item.shownOnHomepage])).toEqual([
      ['Test Harbour Co', false],
      ['Test Second Co', true],
    ]);

    // Unpublished, it leaves both pages.
    await comparisons.unpublish(second.id, actor);
    expect((await beforeAndAfter()).comparisons.map((item) => item.clientName)).toEqual(['Test Harbour Co']);
    expect((await homepage()).beforeAfter).toBeNull();
  });

  it('is kept when removed, and shown nowhere', async () => {
    await comparisons.remove(id, actor);
    expect(await comparisons.detail(id)).toBeNull();
    expect((await db.comparison.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect((await beforeAndAfter()).comparisons).toEqual([]);
    expect((await comparisons.list()).items.map((item) => item.clientName)).toEqual(['Test Second Co']);
  });

  it('writes every step to the audit log, with the fields an edit changed', async () => {
    const entries = await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(entries.map((entry) => entry.action)).toEqual([
      'comparison.created',
      'comparison.published',
      'comparison.updated',
      'comparison.updated',
      'comparison.updated',
      'comparison.deleted',
    ]);
    expect(entries.every((entry) => entry.userId === actor.id && entry.entityType === 'Comparison')).toBe(true);
    expect(entries[3]?.after).toMatchObject({ fields: ['metrics', 'summary'], summary: 'Test summary changed in the dashboard.' });
    expect(entries[3]?.before).toMatchObject({ summary: 'Test berth booking moved from the phone to the website.' });
    expect(entries[5]?.before).toMatchObject({ clientName: 'Test Harbour Co', status: 'PUBLISHED' });
  });
});
