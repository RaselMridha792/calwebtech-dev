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
import { findView, getView } from './core';

/** `/industries/`: its copy and every published industry. Shared by the page and its metadata. */
export const getIndustriesIndex = cache(
  (): Promise<IndustriesIndexView> => getView('/pages/industries', industriesIndexViewSchema, industriesIndexSnapshot),
);

/** One industry's page, or null for a 404. Shared by the page and its metadata. */
export const getIndustryPage = cache(
  (slug: string): Promise<IndustryDetailView | null> =>
    findView(`/pages/industries/${encodeURIComponent(slug)}`, industryDetailViewSchema, industrySnapshots[slug]),
);

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
