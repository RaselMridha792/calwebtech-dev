import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.controller';

/**
 * Site search in Postgres against the imported content (docs/08-decisions.md, 62): typed,
 * ranked with titles first, filterable, published pages only, and fast.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_search_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const search = new SearchService(prisma);

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
  const answer = 'Test answer about zephyrine migrations. It names the word twice: zephyrine. It is a test.';
  await db.post.create({
    data: {
      title: 'Test zephyrine post',
      slug: 'test-zephyrine-post',
      excerpt: 'A test post about zephyrine.',
      answerBlock: answer,
      body: 'Body.',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01'),
    },
  });
  await db.post.create({
    data: { title: 'Test zephyrine draft', slug: 'test-zephyrine-draft', excerpt: 'Draft.', answerBlock: answer, body: 'Body.' },
  });
  await db.glossaryTerm.create({
    data: { term: 'Zephyrine', slug: 'zephyrine', shortDefinition: 'A test term.', body: 'Test body.', status: 'PUBLISHED' },
  });
  await db.faq.create({ data: { question: 'Does zephyrine cost extra?', answer: 'No, a test answer.', group: 'pricing' } });
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('site search in Postgres', () => {
  it('finds a service by its name first, with its address and summary', async () => {
    const { results, counts } = await search.search({ q: 'shopify' });
    expect(results[0]).toMatchObject({ type: 'service', href: '/services/shopify-development/' });
    expect(results[0]?.summary.length).toBeGreaterThan(10);
    expect(counts.service).toBeGreaterThan(0);
  });

  it('finds published case studies, questions on live pages, and nothing unpublished', async () => {
    const { results, counts } = await search.search({ q: 'zephyrine' });
    expect(results.map((result) => `${result.type} ${result.href}`)).toEqual(
      expect.arrayContaining([
        'insight /insights/test-zephyrine-post/',
        'glossary /glossary/zephyrine/',
        'faq /faq/',
      ]),
    );
    expect(results.some((result) => result.href.includes('draft'))).toBe(false);
    expect(counts.insight).toBe(1);

    const work = await search.search({ q: 'Cascadia' });
    expect(work.results).toContainEqual(expect.objectContaining({ type: 'case-study', href: '/work/cascadia-health/' }));
  });

  it('filters by type and still counts every type', async () => {
    const all = await search.search({ q: 'website' });
    const faqs = await search.search({ q: 'website', type: 'faq' });
    expect(faqs.results.every((result) => result.type === 'faq')).toBe(true);
    expect(faqs.counts).toEqual(all.counts);
    expect(faqs.total).toBe(all.total);
  });

  it('answers in under 300 ms', async () => {
    const started = performance.now();
    await search.search({ q: 'ecommerce platform migration' });
    expect(performance.now() - started).toBeLessThan(300);
  });
});
