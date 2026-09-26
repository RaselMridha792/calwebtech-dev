import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { INDUSTRY_ERRORS, industryInputSchema, templateIndustryContent, type IndustryInputDraft } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { IndustriesService } from '../../industries/industries.service';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminIndustriesService } from './admin-industries.service';

/**
 * An industry from the admin to the public page, and the rules that make that safe: a new
 * one is a draft, publishing puts it live, a published address that moves or goes leaves a
 * permanent redirect, a removed row is kept, and every step is in the audit log.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_admin_industries_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const industries = new AdminIndustriesService(prisma, new AuditService(prisma));
const actor = { id: '', ip: '203.0.113.7' };

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const ANSWER =
  'A test industry website helps a test buyer find a test service quickly. It is built for the test sector. It is edited from the dashboard.';

function input(overrides: Partial<IndustryInputDraft> = {}) {
  return industryInputSchema.parse({
    name: 'Test marinas',
    slug: 'test-marinas',
    answerBlock: ANSWER,
    heroCopy: 'Test berths booked online.',
    ...overrides,
  });
}

/** Filled-in copy, as an editor would leave it after starting from the template. */
function writtenContent() {
  const template = templateIndustryContent('Test marina website design');
  const point = (title: string) => ({ title, body: `${title} explained for the test sector.` });
  return {
    ...template,
    hero: { ...template.hero, intro: 'Test boat owners book berths from a phone at the quay.' },
    painPoints: { ...template.painPoints, items: [point('Test one'), point('Test two'), point('Test three'), point('Test four')] },
    integrations: { ...template.integrations, items: [{ name: 'Test berth system', body: 'Test availability kept in step.' }] },
  };
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const user = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('an industry edited in the admin', () => {
  let id = '';

  it('is created as a draft that the public site does not serve', async () => {
    const created = await industries.create(input(), actor);
    id = created.id;
    expect(created.status).toBe('DRAFT');
    expect(created.content).toBeNull();
    expect(await new IndustriesService(prisma).findPublished('test-marinas')).toBeNull();
  });

  it('refuses copy that is not complete, with the path of each field to fix', () => {
    const result = industryInputSchema.safeParse({ ...input(), content: templateIndustryContent('Test marina') });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('content.hero.intro');
    expect(paths).toContain('content.painPoints.items.0.title');
  });

  it('saves its copy and questions, and is live once published', async () => {
    const faqs = [{ question: 'Can test berths be booked online?', answer: 'Yes, from the test page.' }];
    await industries.update(id, input({ content: writtenContent(), faqs }), actor);
    await industries.publish(id, actor);

    const page = await new IndustriesService(prisma).findPublished('test-marinas');
    expect(page?.title).toBe('Test marina website design');
    expect(page?.painPoints?.items).toHaveLength(4);
    expect(page?.faq?.items.map((item) => item.question)).toEqual([faqs[0]?.question]);
  });

  it('leaves a permanent redirect when a published address moves, and refuses one that is taken', async () => {
    await industries.update(id, input({ slug: 'test-harbours', content: writtenContent() }), actor);
    const redirect = await db.redirect.findFirst({ where: { fromPath: '/industries/test-marinas/' } });
    expect(redirect).toMatchObject({ toPath: '/industries/test-harbours/', statusCode: 301 });

    const other = await industries.create(input({ name: 'Test other', slug: 'test-other' }), actor);
    await expect(industries.update(other.id, input({ slug: 'test-harbours' }), actor)).rejects.toMatchObject({
      response: { error: INDUSTRY_ERRORS.duplicateSlug },
    });
  });

  it('is kept when removed, and its address redirects to the index', async () => {
    await industries.remove(id, actor);
    expect(await industries.detail(id)).toBeNull();
    expect((await db.industry.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect(await db.redirect.findFirst({ where: { fromPath: '/industries/test-harbours/' } })).toMatchObject({
      toPath: '/industries/',
    });
    // The slug stays taken, so nothing new inherits the old page's redirect.
    await expect(industries.create(input({ slug: 'test-harbours' }), actor)).rejects.toMatchObject({
      response: { error: INDUSTRY_ERRORS.duplicateSlug },
    });
  });

  it('writes every step to the audit log', async () => {
    const actions = (await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } })).map(
      (entry) => entry.action,
    );
    expect(actions).toEqual([
      'industry.created',
      'industry.updated',
      'industry.published',
      'industry.updated',
      'industry.deleted',
    ]);
  });
});
