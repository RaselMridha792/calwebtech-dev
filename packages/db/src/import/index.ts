import type { PrismaClient } from '../generated/prisma/client';
import { createImportContext, type ImportContext } from './core';

export { createImportContext } from './core';
export type { ImportContext } from './core';

/**
 * The snapshot import: rows the API needs that only the content snapshots
 * (apps/web/static-content) can supply, written once (docs/08-decisions.md, 43).
 *
 * Production launches with CONTENT_SOURCE=snapshot: the web app renders the approved demo
 * content from the snapshots, exactly as the Vercel demo does, while leads, the
 * calculator and brief drafts go to the API. The seed cannot prepare that database, because
 * it is placeholder-only and refuses production; `operational.ts` writes what the write
 * paths look up. When a content family moves into the database, its importer is appended
 * below, with a test that its API view equals its snapshot (the branch
 * wip/content-import-views has the first attempt and what it found).
 *
 * `node dist/import-snapshots.js` from the API image runs it
 * (apps/api/src/import-snapshots.ts); infra/scripts/deploy.sh does that on a stack with
 * IMPORT_SNAPSHOTS_ON_DEPLOY=true. The marker setting makes every later run a no-op, so
 * nothing a person has changed since is overwritten by a deploy; `--force` runs it again.
 */

export const IMPORT_MARKER_KEY = 'snapshots.import';

export interface SnapshotImporter {
  family: string;
  run(ctx: ImportContext): Promise<void>;
}

export type ImporterLoader = () => Promise<SnapshotImporter>;

export const IMPORTERS: readonly ImporterLoader[] = [
  () => import('./operational.js').then((module) => module.operationalImporter),
];

export interface ImportOptions {
  /** The snapshot directory. */
  dir: string;
  /** Run again although the marker says it already happened. */
  force?: boolean;
  log?: (line: string) => void;
  /** A subset of the registry, for tests. Defaults to every importer. */
  importers?: readonly ImporterLoader[];
}

export type ImportResult = { status: 'imported'; families: string[] } | { status: 'skipped'; importedAt: string };

export async function importSnapshots(db: PrismaClient, options: ImportOptions): Promise<ImportResult> {
  const log = options.log ?? (() => undefined);
  const marker = await db.setting.findUnique({ where: { key: IMPORT_MARKER_KEY } });
  const importedAt = markerDate(marker?.value);
  if (importedAt && !options.force) {
    log(`import: already done on ${importedAt}; pass --force to run it again`);
    return { status: 'skipped', importedAt };
  }

  const ctx = createImportContext(db, options.dir, log);
  const families: string[] = [];
  for (const load of options.importers ?? IMPORTERS) {
    const importer = await load();
    await importer.run(ctx);
    families.push(importer.family);
  }

  const value = { importedAt: new Date().toISOString(), source: 'apps/web/static-content', families };
  await db.setting.upsert({ where: { key: IMPORT_MARKER_KEY }, create: { key: IMPORT_MARKER_KEY, value }, update: { value } });
  return { status: 'imported', families };
}

function markerDate(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('importedAt' in value)) return null;
  return typeof value.importedAt === 'string' ? value.importedAt : null;
}
