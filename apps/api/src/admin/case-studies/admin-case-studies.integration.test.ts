import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { WORK_PLACEHOLDER_COPY } from '@calwebtech/db/seed';
import {
  CASE_STUDY_ERRORS,
  WORK_COPY_SETTING_KEY,
  caseStudyInputSchema,
  workCopySchema,
  type CaseStudyInputDraft,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkService } from '../../work/work.service';
import { AdminCaseStudiesService } from './admin-case-studies.service';

/**
 * A case study from the admin to /work/: a draft, refused publication until its page can
 * render, its services in the order the editor chose, redirects when a live address moves
 * or goes, a kept row, and an audit entry for every step.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_admin_work_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const caseStudies = new AdminCaseStudiesService(prisma, new AuditService(prisma));
const actor = { id: '', ip: '203.0.113.7' };

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const ANSWER =
  'Test Harbour Co needed berths booked online instead of by phone. We built a booking site on Next.js. Online bookings tripled in a season.';

function input(overrides: Partial<CaseStudyInputDraft> = {}) {
  return caseStudyInputSchema.parse({
    title: 'Test berths booked online for Test Harbour Co',
    slug: 'test-harbour-co',
    clientName: 'Test Harbour Co',
    summary: 'Test berth booking moved from the phone to the website.',
    answerBlock: ANSWER,
    ...overrides,
  });
}

const METRICS = [
  { value: '3x', label: 'Test online bookings' },
  { value: '-60%', label: 'Test phone calls' },
  { value: '1.4s', label: 'Test mobile load' },
];

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const user = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
  for (const [order, slug] of ['test-alpha', 'test-beta'].entries()) {
    await db.service.create({
      data: {
        slug,
        title: `Test ${slug}`,
        shortDescription: `Test ${slug} summary for the card.`,
        answerBlock: ANSWER,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-01-01'),
        order,
      },
    });
  }
  await db.technology.create({ data: { slug: 'test-platform', name: 'Test platform', category: 'frontend' } });
  // The copy around every case study, which a page cannot be built without.
  await db.setting.create({ data: { key: WORK_COPY_SETTING_KEY, value: workCopySchema.parse(WORK_PLACEHOLDER_COPY) } });
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('a case study edited in the admin', () => {
  let id = '';

  it('is created as a draft, and refused publication until it has three figures', async () => {
    const created = await caseStudies.create(input(), actor);
    id = created.id;
    expect(created.status).toBe('DRAFT');
    expect(created.notReady).toMatch(/at least 3/);
    await expect(caseStudies.publish(id, actor)).rejects.toMatchObject({ response: { error: CASE_STUDY_ERRORS.notReady } });
  });

  it('refuses a link to a service that does not exist, rather than dropping it', async () => {
    await expect(caseStudies.update(id, input({ services: ['test-missing'] }), actor)).rejects.toMatchObject({
      response: { error: CASE_STUDY_ERRORS.unknownLink },
    });
  });

  it('is live once complete and published, listing its services in the chosen order', async () => {
    await caseStudies.update(
      id,
      input({ metrics: METRICS, services: ['test-beta', 'test-alpha'], platforms: ['test-platform'], segment: 'B2B, Marinas' }),
      actor,
    );
    await caseStudies.publish(id, actor);

    const page = await new WorkService(prisma).findCaseStudy('test-harbour-co');
    expect(page?.headline.metric).toEqual(METRICS[0]);
    expect(page?.atAGlance.services.map((service) => service.slug)).toEqual(['test-beta', 'test-alpha']);
    expect(page?.atAGlance.platforms.map((platform) => platform.slug)).toEqual(['test-platform']);
    const detail = await caseStudies.detail(id);
    expect(detail?.record.services).toEqual(['test-beta', 'test-alpha']);
  });

  it('leaves a permanent redirect when a published address moves, and one to /work/ when removed', async () => {
    await caseStudies.update(id, input({ slug: 'test-harbour', metrics: METRICS }), actor);
    expect(await db.redirect.findFirst({ where: { fromPath: '/work/test-harbour-co/' } })).toMatchObject({
      toPath: '/work/test-harbour/',
      statusCode: 301,
    });

    await caseStudies.remove(id, actor);
    expect(await caseStudies.detail(id)).toBeNull();
    expect((await db.project.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect(await db.redirect.findFirst({ where: { fromPath: '/work/test-harbour/' } })).toMatchObject({ toPath: '/work/' });
    await expect(caseStudies.create(input({ slug: 'test-harbour' }), actor)).rejects.toMatchObject({
      response: { error: CASE_STUDY_ERRORS.duplicateSlug },
    });
  });

  it('writes every step to the audit log', async () => {
    const actions = (await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } })).map(
      (entry) => entry.action,
    );
    expect(actions).toEqual([
      'case_study.created',
      'case_study.updated',
      'case_study.published',
      'case_study.updated',
      'case_study.deleted',
    ]);
  });
});
