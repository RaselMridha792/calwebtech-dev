import 'server-only';
import {
  SITE_ROUTES,
  caseStudyPath,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexPath,
  workIndexViewSchema,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { workBeforeAndAfterSnapshot, workCaseStudySnapshots, workIndexSnapshot } from '@/static-content/work';
import { findView, getView } from './core';

/** Every published case study, the filter values they carry, the proof band and the page copy. */
export const getWorkIndex = cache(() => getView('/pages/work', workIndexViewSchema, workIndexSnapshot));

/** A published case study, or null for a 404. */
export const getCaseStudy = cache((slug: string) =>
  findView(
    `/pages/work/${encodeURIComponent(slug)}`,
    workCaseStudyViewSchema,
    // Own keys only, so a slug such as "constructor" is a 404 rather than an object's method.
    Object.hasOwn(workCaseStudySnapshots, slug) ? workCaseStudySnapshots[slug] : null,
  ),
);

/** Every published before and after comparison. */
export const getBeforeAndAfter = cache(() =>
  getView('/pages/before-and-after', workBeforeAndAfterViewSchema, workBeforeAndAfterSnapshot),
);

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
