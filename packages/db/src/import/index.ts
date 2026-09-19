import type { PrismaClient } from '../generated/prisma/client';
import { createImportContext, type ImportContext } from './core';

export { IMPORTED_AT, createImportContext } from './core';
export type { ImportContext } from './core';

/**
 * The snapshot importer: loads the demo content in apps/web/static-content into the
 * database, once (docs/08-decisions.md, 43). Each snapshot file is one API view; after the
 * import, the API returns those views from the database, and the owner edits the content
 * from there. It is not the seed: the seed stays placeholder-only and refuses production,
 * this runs on production exactly once.
 *
 * `node dist/import-content.js` from the API image runs it (apps/api/src/import-content.ts);
 * infra/scripts/deploy.sh does that on a stack with IMPORT_CONTENT_ON_DEPLOY=true. The
 * marker setting below makes every later run a no-op, so the owner's edits are never
 * overwritten by a deploy; `--force` re-imports on purpose.
 */

export const IMPORT_MARKER_KEY = 'content.import';

export interface SnapshotImporter {
  family: string;
  run(ctx: ImportContext): Promise<void>;
}

export type ImporterLoader = () => Promise<SnapshotImporter>;

/**
 * In this order. `proof` first: the shared records every page embeds. Then the homepage
 * and the landing page, then the site page families (docs/10-site-pages.md), which link
 * to proof by slug and add the columns their own pages need.
 */
export const IMPORTERS: readonly ImporterLoader[] = [
  () => import('./proof.js').then((module) => module.proofImporter),
  () => import('./home.js').then((module) => module.homeImporter),
  () => import('./landing.js').then((module) => module.landingImporter),
  () => import('./services.js').then((module) => module.servicesImporter),
  () => import('./industries.js').then((module) => module.industriesImporter),
  () => import('./work.js').then((module) => module.workImporter),
  () => import('./company.js').then((module) => module.companyImporter),
  () => import('./static.js').then((module) => module.staticImporter),
  () => import('./locations.js').then((module) => module.locationsImporter),
  () => import('./insights.js').then((module) => module.insightsImporter),
  () => import('./guides-glossary.js').then((module) => module.guidesGlossaryImporter),
  () => import('./calculator.js').then((module) => module.calculatorImporter),
  () => import('./forms.js').then((module) => module.formsImporter),
];

export interface ImportOptions {
  /** The snapshot directory. */
  dir: string;
  /** Import again although the marker says it already happened. */
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
    log(`import: already done on ${importedAt}; pass --force to import again`);
    return { status: 'skipped', importedAt };
  }

  const ctx = createImportContext(db, options.dir, log);
  const families: string[] = [];
  for (const load of options.importers ?? IMPORTERS) {
    const importer = await load();
    log(`import: ${importer.family}`);
    await importer.run(ctx);
    families.push(importer.family);
  }

  const value = { importedAt: new Date().toISOString(), source: 'apps/web/static-content', families };
  await db.setting.upsert({ where: { key: IMPORT_MARKER_KEY }, create: { key: IMPORT_MARKER_KEY, value }, update: { value } });
  return { status: 'imported', families };
}

function markerDate(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('importedAt' in value)) return null;
  const importedAt = (value as { importedAt: unknown }).importedAt;
  return typeof importedAt === 'string' ? importedAt : null;
}
