import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { IMPORT_MARKER_KEY, importSnapshots } from '@calwebtech/db/import';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { FAMILIES, type Check } from './checks';

/**
 * The content import's acceptance test (decision 43): on an empty, migrated database of its
 * own, after `importSnapshots`, every API view equals the snapshot the importer read.
 *
 * It creates that database on the same server as DATABASE_URL (the CI service and the local
 * Compose Postgres both let the application user do that), so the placeholder seed and the
 * fixtures the other integration tests and the end-to-end suite rely on are never touched,
 * and drops it afterwards. Views are JSON round-tripped before comparing, as the controller
 * would send them, so a Date and its ISO string compare equal and `undefined` disappears.
 *
 * Run one family while working on its importer:
 *   pnpm --filter @calwebtech/api exec vitest run import.integration -t "services:"
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv(process.env);
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const databaseName = `calwebtech_import_${Date.now().toString(36)}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });

// The checks are registered at collection time; each check constructs its services only
// when it runs.
const families = FAMILIES.map(({ family, checks }) => ({ family, checks: checks(prisma) }));

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${status} for ${databaseName}`);
  const result = await importSnapshots(prisma.client, { dir: snapshotDir, log: () => undefined });
  if (result.status !== 'imported') throw new Error('the import was skipped on an empty database');
}, 180_000);

afterAll(async () => {
  await prisma.client.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('content import', () => {
  it('records the marker, so a second run is a no-op', async () => {
    const marker = await prisma.client.setting.findUnique({ where: { key: IMPORT_MARKER_KEY } });
    expect(marker?.value).toMatchObject({ source: 'apps/web/static-content' });
    const again = await importSnapshots(prisma.client, { dir: snapshotDir });
    expect(again.status).toBe('skipped');
  });

  it('lists every snapshot family in the registry', () => {
    expect(families.map((entry) => entry.family).sort()).toEqual(
      ['calculator', 'company', 'forms', 'guides-glossary', 'home', 'industries', 'insights', 'landing', 'locations', 'services', 'static', 'work'],
    );
  });

  for (const { family, checks } of families) {
    describe(family, () => {
      if (checks.length === 0) {
        it.todo(`${family}: checks not written yet`);
      }
      for (const check of checks) {
        it(`${family}: ${check.title} equals ${check.snapshot}`, async () => {
          const expected = JSON.parse(readFileSync(path.join(snapshotDir, check.snapshot), 'utf8')) as unknown;
          const actual = roundTrip(await check.view());
          expect(actual).toEqual(expected);
        });
      }
    });
  }
});

export type { Check };
