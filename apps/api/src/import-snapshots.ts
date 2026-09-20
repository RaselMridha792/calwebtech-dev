import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';

/**
 * `node dist/import-snapshots.js [--dir <snapshots>] [--force]`: writes the rows the API
 * needs from the content snapshots, once (packages/db/src/import, decision 43).
 *
 * The API image carries a copy of apps/web/static-content next to dist/, so on the server
 * infra/scripts/deploy.sh runs this with no arguments when IMPORT_SNAPSHOTS_ON_DEPLOY is
 * true. On a checkout the snapshots are found in apps/web. A marker setting makes a second
 * run a no-op unless --force is passed, so what a person changed since survives every deploy.
 */

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

function snapshotDirectory(explicit: string | undefined): string {
  const candidates = explicit
    ? [path.resolve(process.cwd(), explicit)]
    : [path.resolve(__dirname, '../static-content'), path.resolve(__dirname, '../../../apps/web/static-content')];
  const found = candidates.find((directory) => existsSync(path.join(directory, 'home.json')));
  if (!found) throw new Error(`import: no snapshots (home.json) in ${candidates.join(' or ')}`);
  return found;
}

function parseArgs(argv: readonly string[]): { dir?: string; force: boolean } {
  let dir: string | undefined;
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg === '--force') {
      force = true;
    } else if (arg === '--dir') {
      dir = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--dir=')) {
      dir = arg.slice('--dir='.length);
    } else {
      throw new Error(`import: unknown argument ${arg}`);
    }
  }
  return { dir, force };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('import: DATABASE_URL is required');
  const { dir, force } = parseArgs(process.argv.slice(2));
  const snapshots = snapshotDirectory(dir);
  const db = createPrismaClient(databaseUrl);
  try {
    const result = await importSnapshots(db, {
      dir: snapshots,
      force,
      log: (line) => {
        console.log(line);
      },
    });
    if (result.status === 'imported') {
      console.log(`import: done, ${result.families.length} families from ${snapshots}`);
    }
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
