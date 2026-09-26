import 'server-only';
import {
  SITE_ROUTES,
  caseStudyPath,
  homepageComparison,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexPath,
  workIndexViewSchema,
  type BeforeAfterView,
  type WorkBeforeAndAfterView,
  type WorkCaseStudyCard,
  type WorkIndexView,
  type WorkTerm,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { workBeforeAndAfterSnapshot, workCaseStudySnapshots, workIndexSnapshot } from '@/static-content/work';
import { apiUrl, findViewDatabaseFirst, getView, isDatabaseFirst, usesSnapshots } from './core';

/**
 * `/work/` and the case studies read the database first and fall back to their snapshots
 * while `CONTENT_DATABASE_FIRST` names `work` (decisions 44 and 58).
 */
const FAMILY = 'work';

/**
 * `/before-and-after/` and the homepage's comparison read the database while
 * `CONTENT_DATABASE_FIRST` names `before-and-after` (decision 70). The page is one list, so
 * there is no single record to fall back for: the family is named once the import has
 * written the snapshot's comparisons, and from then on the dashboard's list is the page.
 */
export const BEFORE_AND_AFTER_FAMILY = 'before-and-after';

/** Every published case study, the filter values they carry, the proof band and the page copy. */
export const getWorkIndex = cache(async (): Promise<WorkIndexView> => {
  if (!isDatabaseFirst(FAMILY)) return getView('/pages/work', workIndexViewSchema, workIndexSnapshot);
  const response = await fetch(apiUrl('/pages/work'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for /pages/work`);
  return mergeWorkIndex(workIndexViewSchema.parse(await response.json()), workIndexViewSchema.parse(workIndexSnapshot));
});

/** A published case study, or null for a 404. */
export const getCaseStudy = cache((slug: string) =>
  findViewDatabaseFirst(
    FAMILY,
    `/pages/work/${encodeURIComponent(slug)}`,
    workCaseStudyViewSchema,
    // Own keys only, so a slug such as "constructor" is a 404 rather than an object's method.
    Object.hasOwn(workCaseStudySnapshots, slug) ? workCaseStudySnapshots[slug] : null,
  ),
);

/**
 * One `/work/`: the database's case studies first and the snapshot's it does not have after
 * them, the filters each list offers, and the database's copy. The proof band is the
 * database's once it has figures; until then the snapshot's, because those figures are the
 * homepage's too and not this family's to import.
 */
export function mergeWorkIndex(database: WorkIndexView, snapshot: WorkIndexView): WorkIndexView {
  const known = new Set(database.caseStudies.map((study) => study.slug));
  const extra = snapshot.caseStudies.filter((study) => !known.has(study.slug));
  const caseStudies = [...database.caseStudies, ...extra];
  const slugsOf = (study: WorkCaseStudyCard, key: keyof WorkIndexView['filters']): string[] => {
    if (key === 'industries') return study.industry ? [study.industry] : [];
    return key === 'services' ? study.services : study.platforms;
  };
  const terms = (key: keyof WorkIndexView['filters']): WorkTerm[] => {
    // Only terms a listed case study carries, the database's name first, sorted as the API sorts.
    const used = new Set(caseStudies.flatMap((study) => slugsOf(study, key)));
    const bySlug = new Map<string, WorkTerm>();
    for (const term of [...database.filters[key], ...snapshot.filters[key]]) {
      if (used.has(term.slug) && !bySlug.has(term.slug)) bySlug.set(term.slug, term);
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  };
  return {
    ...database,
    caseStudies,
    filters: { industries: terms('industries'), services: terms('services'), platforms: terms('platforms') },
    proof: database.proof.statistics.length > 0 ? database.proof : snapshot.proof,
  };
}

/** Every published before and after comparison, in the page's order. */
export const getBeforeAndAfter = cache(async (): Promise<WorkBeforeAndAfterView> => {
  if (!isDatabaseFirst(BEFORE_AND_AFTER_FAMILY)) {
    return getView('/pages/before-and-after', workBeforeAndAfterViewSchema, workBeforeAndAfterSnapshot);
  }
  const response = await fetch(apiUrl('/pages/before-and-after'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for /pages/before-and-after`);
  return workBeforeAndAfterViewSchema.parse(await response.json());
});

/**
 * The homepage's comparison from the database: the one `/before-and-after/` marks for it, or
 * null when none is published and marked. Undefined while the homepage's own view already
 * says it: with the family off, both pages read their snapshots, which agree (work.test.ts);
 * with `CONTENT_SOURCE=api`, the API's homepage reads the same rows.
 */
export async function storedHomepageComparison(): Promise<BeforeAfterView | null | undefined> {
  if (!usesSnapshots() || !isDatabaseFirst(BEFORE_AND_AFTER_FAMILY)) return undefined;
  return homepageComparison(await getBeforeAndAfter());
}

export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getWorkIndex();
  return [
    { path: SITE_ROUTES.work, title: 'Case studies', section: 'Work' },
    // Deliberate filter targets are indexable pages of their own.
    ...index.copy.targets.map((target) => ({ path: workIndexPath(target.filters), title: target.title, section: 'Work' })),
    ...index.caseStudies.map((study) => ({ path: caseStudyPath(study.slug), title: study.clientName, section: 'Work' })),
    { path: SITE_ROUTES.beforeAndAfter, title: 'Before and after', section: 'Work' },
  ];
}
