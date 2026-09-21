import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import type { ServiceDetailView, ServicesIndexView } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

/**
 * What the services family has to prove before `CONTENT_DATABASE_FIRST=services` is turned
 * on: the page the API builds out of the imported rows is the page the approved snapshot
 * already shows. Every section, in order, with the same words.
 *
 * The import reads a rendered page backwards into a record, so this is the only check that
 * the round trip loses nothing — a heading dropped, a section the mapper decides to leave
 * out, a technology linked to the wrong row. A unit test cannot ask it, because the answer
 * depends on rows three importers wrote and on the mapper's own ordering and limits.
 *
 * The database is created on the same server as DATABASE_URL, migrated and dropped
 * afterwards, so the seed and fixtures the other suites rely on are never touched.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_services_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const services = new ServicesService(prisma);

const index = snapshot('services/index.json') as ServicesIndexView;
const slugs = index.groups.flatMap((group) => group.services.map((service) => service.slug));

function snapshot(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(snapshotDir, relPath), 'utf8'));
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * The two fields that cannot match and say nothing about the page.
 *
 * `id` is the row's surrogate key, and the snapshot carries the ids of the database it was
 * exported from; it reaches the page only as a list key and an anchor. `updatedAt` is when
 * the record last changed, and importing it changed it — it is a freshness signal for the
 * sitemap, not copy. Everything else has to be equal.
 */
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
 * Everything but the three things the snapshots themselves disagree about, which the owner
 * chose on 2026-09-21 to leave as they are and settle in the admin (docs/08-decisions.md, 45).
 *
 * - **A card's tags.** A service page tags Truvia Labs "SaaS" and the industries index
 *   names the same record "SaaS and technology"; the cards also carry a platform chip the
 *   card mapper does not build. One row holds one name.
 * - **A card's alt text.** A card describes its photograph one way and the case study's own
 *   cover describes the same file another. `Project.coverImageAlt` holds one of them.
 * - **Which client is quoted.** The approved nextjs-development page quotes a client whose
 *   case study that page does not list, so nothing in the record says to choose it.
 *
 * Named here rather than hidden: the test below still checks that the cards are the same
 * case studies, in the same order, with the same figures and the same photographs, so this
 * exception cannot quietly widen into a card that went missing.
 */
function asideFromTheKnownDisagreements(view: ServiceDetailView): unknown {
  const { proof, testimonial, ...rest } = view;
  return comparable({
    ...rest,
    proof:
      proof === null
        ? null
        : {
            ...proof,
            caseStudies: proof.caseStudies.map((card) => ({
              slug: card.slug,
              clientName: card.clientName,
              summary: card.summary,
              metrics: card.metrics,
              image: card.image === null ? null : { src: card.image.src },
            })),
          },
    testimonial: testimonial === null ? null : { heading: testimonial.heading },
  });
}

/** The case studies a page shows, as the facts a reader would check them by. */
function cards(view: ServiceDetailView): unknown {
  return (view.proof?.caseStudies ?? []).map((card) => ({
    slug: card.slug,
    clientName: card.clientName,
    summary: card.summary,
    metrics: card.metrics,
    src: card.image?.src ?? null,
  }));
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

describe('the services family, built from the imported rows', () => {
  it('has a service to check', () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('builds /services/ as the snapshot shows it', async () => {
    expect(comparable(await services.findIndex())).toEqual(comparable(index));
  });

  for (const slug of slugs) {
    it(`builds /services/${slug}/ as the snapshot shows it`, async () => {
      const built = await services.findBySlug(slug);
      if (built === null) throw new Error(`the API has no page for ${slug}`);
      const approved = snapshot(`services/${slug}.json`) as ServiceDetailView;

      expect(asideFromTheKnownDisagreements(built)).toEqual(asideFromTheKnownDisagreements(approved));
      // The proof is the same proof: same case studies, same order, same figures.
      expect(cards(built)).toEqual(cards(approved));
    });
  }
});
