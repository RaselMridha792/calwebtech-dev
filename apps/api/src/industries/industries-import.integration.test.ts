import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import type { IndustriesIndexView, IndustryDetailView } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { IndustriesService } from './industries.service';

/**
 * What the industries family has to prove before `CONTENT_DATABASE_FIRST` names it: the page
 * the API builds out of the imported rows is the page the approved snapshot already shows.
 * Every section, in order, with the same words (docs/08-decisions.md, 58).
 *
 * The database is created on the same server as DATABASE_URL, migrated and dropped
 * afterwards, so the seed and fixtures the other suites rely on are never touched.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_industries_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const industries = new IndustriesService(prisma);

const index = snapshot('industries/index.json') as IndustriesIndexView;
const slugs = index.industries.map((industry) => industry.slug);

function snapshot(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(snapshotDir, relPath), 'utf8'));
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** `id` and `updatedAt` cannot match and say nothing about the page (as for services). */
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id' && key !== 'updatedAt')
        .map(([key, inner]) => [key, comparable(inner)]),
    );
  }
  return value;
}

/**
 * Everything but a case study card's tags and alt text, which the snapshots disagree about
 * as they do on the service pages (docs/08-decisions.md, 45): one project row holds one
 * location, one segment and one description of its cover. The cards are still checked
 * below for the same case studies, figures and photographs.
 */
function asideFromTheKnownDisagreements(view: IndustryDetailView): unknown {
  const { caseStudies, ...rest } = view;
  return comparable({
    ...rest,
    caseStudies:
      caseStudies === null
        ? null
        : {
            ...caseStudies,
            items: caseStudies.items.map((card) => ({
              slug: card.slug,
              clientName: card.clientName,
              summary: card.summary,
              metrics: card.metrics,
              image: card.image === null ? null : { src: card.image.src },
            })),
          },
  });
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const result = await importSnapshots(prisma.client, { dir: snapshotDir });
  if (result.status !== 'imported') throw new Error('the import was skipped on an empty database');
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('the industries family, built from the imported rows', () => {
  it('has an industry to check', () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('builds /industries/ as the snapshot shows it', async () => {
    expect(comparable(await industries.findIndex())).toEqual(comparable(index));
  });

  for (const slug of slugs) {
    it(`builds /industries/${slug}/ as the snapshot shows it`, async () => {
      const built = await industries.findPublished(slug);
      if (built === null) throw new Error(`the API has no page for ${slug}`);
      const approved = snapshot(`industries/${slug}.json`) as IndustryDetailView;

      expect(asideFromTheKnownDisagreements(built)).toEqual(asideFromTheKnownDisagreements(approved));
    });
  }

  it('leaves copy someone has edited alone when the import is forced', async () => {
    const [slug] = slugs;
    if (!slug) throw new Error('no industry to edit');
    const before = await prisma.client.industry.findUniqueOrThrow({ where: { slug } });
    const edited = { ...(before.content as Record<string, unknown>), title: 'An edited industry title' };
    await prisma.client.industry.update({ where: { slug }, data: { content: edited, answerBlock: 'Edited. Answer.' } });

    await importSnapshots(prisma.client, { dir: snapshotDir, force: true });
    const after = await prisma.client.industry.findUniqueOrThrow({ where: { slug } });
    expect((after.content as { title: string }).title).toBe('An edited industry title');
    expect(after.answerBlock).toBe('Edited. Answer.');
  });
});
