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
 * IMPORT_SNAPSHOTS_ON_DEPLOY=true.
 *
 * The marker names the families that have run. A later deploy runs the ones it does not
 * name and leaves the rest alone, so a family added after launch reaches a live database
 * without re-importing the families somebody has since edited. `--force` runs them all.
 */

export const IMPORT_MARKER_KEY = 'snapshots.import';

export interface SnapshotImporter {
  family: string;
  run(ctx: ImportContext): Promise<void>;
}

export type ImporterLoader = () => Promise<SnapshotImporter>;

export const IMPORTERS: readonly ImporterLoader[] = [
  () => import('./operational.js').then((module) => module.operationalImporter),
  // Independent of the content families: the page's copy, one consultation type and its hours.
  () => import('./booking.js').then((module) => module.bookingImporter),
  // Before any family that links to them: a service page shows technologies and
  // industries, and cannot move into the database while those rows live only in a snapshot.
  () => import('./references.js').then((module) => module.referencesImporter),
  // After references, because a case study names the industry it was for.
  () => import('./work.js').then((module) => module.workImporter),
  // A service links to the technologies, industries and case studies above.
  () => import('./services.js').then((module) => module.servicesImporter),
  // After services, because an industry page names the services it lists. Its own family so
  // a database that imported `references` before it existed receives the pages' copy.
  () => import('./industries.js').then((module) => module.industriesImporter),
  // After services, which links a project's services; brings what a case study page needs.
  () => import('./case-studies.js').then((module) => module.caseStudiesImporter),
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
  const done = options.force ? new Set<string>() : markerFamilies(marker?.value);

  const ctx = createImportContext(db, options.dir, log);
  const families: string[] = [];
  for (const load of options.importers ?? IMPORTERS) {
    const importer = await load();
    // A family the marker already names has run against this database. Running it again
    // would overwrite rows somebody has edited since, which is what the marker prevents.
    if (done.has(importer.family)) continue;
    await importer.run(ctx);
    families.push(importer.family);
  }

  if (families.length === 0 && importedAt) {
    log(`import: every family already imported, on ${importedAt}; pass --force to run them again`);
    return { status: 'skipped', importedAt };
  }

  const value = {
    importedAt: new Date().toISOString(),
    source: 'apps/web/static-content',
    families: [...done, ...families],
  };
  await db.setting.upsert({ where: { key: IMPORT_MARKER_KEY }, create: { key: IMPORT_MARKER_KEY, value }, update: { value } });
  if (done.size > 0) log(`import: ${families.join(', ')}; the rest had already run`);
  return { status: 'imported', families };
}

function markerDate(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('importedAt' in value)) return null;
  return typeof value.importedAt === 'string' ? value.importedAt : null;
}

/**
 * The families a previous run recorded. A marker from before they were recorded, or one
 * written by hand, names none, so everything runs again — the safe reading of a marker
 * nobody can interpret.
 */
function markerFamilies(value: unknown): Set<string> {
  if (typeof value !== 'object' || value === null || !('families' in value)) return new Set();
  const listed = value.families;
  if (!Array.isArray(listed)) return new Set();
  return new Set(listed.filter((entry): entry is string => typeof entry === 'string'));
}
