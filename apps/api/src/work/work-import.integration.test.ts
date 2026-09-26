import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import { PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import {
  SETTING_KEYS,
  homepageComparison,
  workBeforeAndAfterViewSchema,
  type WorkCaseStudyView,
  type WorkIndexView,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { HomePageService } from '../home/home-page.service';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { WorkService } from './work.service';

/**
 * What the case studies family has to prove before `CONTENT_DATABASE_FIRST` names `work`:
 * `/work/` and every case study the API builds out of the imported rows are the pages the
 * approved snapshots already show, section by section (docs/08-decisions.md, 58).
 *
 * The database is created on the same server as DATABASE_URL, migrated and dropped
 * afterwards, so the seed and fixtures the other suites rely on are never touched.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_work_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const work = new WorkService(prisma);

const index = snapshot('work/index.json') as WorkIndexView;
const slugs = index.caseStudies.map((study) => study.slug);

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
 * Everything but the proof band, which is not the family's to import: its figures and rating
 * come from the statistics and review sources the homepage also shows, and the two snapshots
 * disagree about them (docs/08-decisions.md, 43). The web app keeps the snapshot's band while
 * the database has no figures (`mergeWorkIndex`).
 */
function asideFromTheProofBand(view: WorkIndexView): unknown {
  return comparable({ ...view, proof: null });
}

/**
 * The two things the snapshots disagree with the rows about, named rather than hidden:
 *
 * - **"Headless CMS".** The technology row takes the service pages' spelling, "headless CMS"
 *   (docs/08-decisions.md, 45); the case study pages capitalise it. Only that name is
 *   folded, so any other difference in a platform or a tag still fails.
 * - **A related service's summary.** A case study describes each service it used in words
 *   of its own; the page built from the rows shows the service's own summary, which is the
 *   one on the services index. One row holds one summary. The services linked, and their
 *   order, are still checked.
 */
function asideFromTheKnownDisagreements(value: unknown): unknown {
  if (value === 'headless CMS') return 'Headless CMS';
  if (Array.isArray(value)) return value.map(asideFromTheKnownDisagreements);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === 'relatedServices' && Array.isArray(inner)
          ? inner.map((service: { slug: string; name: string }) => ({ slug: service.slug, name: service.name }))
          : asideFromTheKnownDisagreements(inner),
      ]),
    );
  }
  return value;
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

describe('the case studies family, built from the imported rows', () => {
  it('has a case study to check', () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('builds /work/ as the snapshot shows it', async () => {
    const built = asideFromTheProofBand(await work.findIndex());
    expect(asideFromTheKnownDisagreements(built)).toEqual(asideFromTheKnownDisagreements(asideFromTheProofBand(index)));
  });

  for (const slug of slugs) {
    it(`builds /work/${slug}/ as the snapshot shows it`, async () => {
      const built = await work.findCaseStudy(slug);
      if (built === null) throw new Error(`the API has no page for ${slug}`);
      const approved = snapshot(`work/${slug}.json`) as WorkCaseStudyView;
      expect(asideFromTheKnownDisagreements(comparable(built))).toEqual(asideFromTheKnownDisagreements(comparable(approved)));
    });
  }

  it('leaves a case study someone has edited alone when the import is forced', async () => {
    const [slug] = slugs;
    if (!slug) throw new Error('no case study to edit');
    await prisma.client.project.update({ where: { slug }, data: { segment: 'Test edited segment', gallery: [] } });
    await importSnapshots(prisma.client, { dir: snapshotDir, force: true });
    const after = await prisma.client.project.findUniqueOrThrow({ where: { slug } });
    expect(after.segment).toBe('Test edited segment');
    expect(after.gallery).toEqual([]);
  });
});

/**
 * What the `before-and-after` family has to prove before `CONTENT_DATABASE_FIRST` names it
 * (docs/08-decisions.md, 70): the page and the homepage's comparison, built from the imported
 * rows, are the snapshots'. Testimonials the dashboard edits now are kept by a forced run.
 */
describe('the before and after family, built from the imported rows', () => {
  const approved = snapshot('work/before-and-after.json');
  const home = snapshot('home.json') as { beforeAfter: unknown };

  it('builds /before-and-after/ as the snapshot shows it', async () => {
    const built = await work.findBeforeAndAfter();
    expect(built.comparisons.length).toBeGreaterThan(0);
    expect(built).toEqual(workBeforeAndAfterViewSchema.parse(approved));
  });

  it('gives the homepage the comparison the homepage snapshot shows', async () => {
    expect(homepageComparison(await work.findBeforeAndAfter())).toEqual(home.beforeAfter);
    // The API's homepage too, given the contact details the import leaves to settings-cli.
    await prisma.client.setting.upsert({
      where: { key: SETTING_KEYS.contact },
      create: { key: SETTING_KEYS.contact, value: PLACEHOLDER_CONTACT },
      update: {},
    });
    expect((await new HomePageService(prisma).find()).beforeAfter).toEqual(home.beforeAfter);
  });

  it('leaves comparisons and testimonials someone has edited alone when the import is forced', async () => {
    const db = prisma.client;
    const comparison = await db.comparison.findFirstOrThrow();
    await db.comparison.update({ where: { id: comparison.id }, data: { summary: 'Test summary edited in the dashboard.' } });
    const testimonial = await db.testimonial.findFirstOrThrow({ where: { projectId: { not: null } } });
    await db.testimonial.update({ where: { id: testimonial.id }, data: { quote: 'Test quote edited.', deletedAt: new Date() } });
    const counts = { comparisons: await db.comparison.count(), testimonials: await db.testimonial.count() };

    await importSnapshots(db, { dir: snapshotDir, force: true });
    expect((await db.comparison.findUniqueOrThrow({ where: { id: comparison.id } })).summary).toBe('Test summary edited in the dashboard.');
    const kept = await db.testimonial.findUniqueOrThrow({ where: { id: testimonial.id } });
    expect(kept.quote).toBe('Test quote edited.');
    expect(kept.deletedAt).not.toBeNull();
    expect({ comparisons: await db.comparison.count(), testimonials: await db.testimonial.count() }).toEqual(counts);
  });
});
