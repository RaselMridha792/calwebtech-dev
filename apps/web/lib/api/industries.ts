import 'server-only';
import {
  SITE_ROUTES,
  industriesIndexViewSchema,
  industryDetailViewSchema,
  industryPath,
  type IndustriesIndexView,
  type IndustryDetailView,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { industriesIndexSnapshot, industrySnapshots } from '@/static-content/industries';
import { apiUrl, findViewDatabaseFirst, getView, isDatabaseFirst } from './core';

/**
 * The industries family reads the database first and falls back to its snapshot while
 * `CONTENT_DATABASE_FIRST` names it (decisions 44 and 58). An industry created in the admin
 * is live at once; one the database does not have keeps rendering from the snapshot.
 */
const FAMILY = 'industries';

/**
 * `/industries/`: its copy and every published industry. Shared by the page and its metadata.
 *
 * While the family is database-first the database's list comes first and any snapshot
 * industry it does not have follows, so a visitor sees one index. A slug in both belongs to
 * the database: it is the one an editor can change.
 */
export const getIndustriesIndex = cache(async (): Promise<IndustriesIndexView> => {
  if (!isDatabaseFirst(FAMILY)) {
    return getView('/pages/industries', industriesIndexViewSchema, industriesIndexSnapshot);
  }
  const response = await fetch(apiUrl('/pages/industries'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for /pages/industries`);
  const fromDatabase = industriesIndexViewSchema.parse(await response.json());
  return mergeIndustries(fromDatabase, industriesIndexViewSchema.parse(industriesIndexSnapshot));
});

/**
 * One industry's page, or null for a 404. Shared by the page and its metadata. The snapshot
 * lookup checks own keys only, so a path such as `/industries/constructor/` is a 404.
 */
export const getIndustryPage = cache(
  (slug: string): Promise<IndustryDetailView | null> =>
    findViewDatabaseFirst(
      FAMILY,
      `/pages/industries/${encodeURIComponent(slug)}`,
      industryDetailViewSchema,
      Object.hasOwn(industrySnapshots, slug) ? industrySnapshots[slug] : null,
    ),
);

/** The database's industries in its order, then the snapshot's that it does not have. */
export function mergeIndustries(database: IndustriesIndexView, snapshot: IndustriesIndexView): IndustriesIndexView {
  const known = new Set(database.industries.map((industry) => industry.slug));
  return {
    ...database,
    industries: [...database.industries, ...snapshot.industries.filter((industry) => !known.has(industry.slug))],
  };
}

/** The industries index and every published industry page, for sitemap.xml and /sitemap/. */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getIndustriesIndex();
  return [
    { path: SITE_ROUTES.industries, title: 'Industries', section: 'Industries' },
    ...index.industries.map((industry) => ({
      path: industryPath(industry.slug),
      title: industry.name,
      section: 'Industries',
    })),
  ];
}
