import type { ReviewSource } from '@calwebtech/db';
import {
  buildSiteChrome,
  homePageContentSchema,
  siteChromeViewSchema,
  siteContactSchema,
  siteIndexingSchema,
  type HomeProject,
  type SiteChromeView,
} from '@calwebtech/shared';
import { homeReviewSummary, projectView, type HomeProjectRecord } from '../home/home-page.mapper';

export interface SiteChromeRecords {
  contentSetting: unknown;
  contactSetting: unknown;
  proofSetting: unknown;
  indexingSetting: unknown;
  reviewSources: ReviewSource[];
  /** Service categories in order, each with its published services. */
  categories: { name: string; services: { slug: string; title: string }[] }[];
  /** Published services in order. */
  services: { slug: string; title: string }[];
  /** Published industries in order. */
  industries: { slug: string; name: string }[];
  /** Featured, published projects, newest first. Those without outcome figures are skipped. */
  projects: HomeProjectRecord[];
  /** Published locations with an address, head office first. */
  locations: { city: string; address: string | null }[];
}

/**
 * Builds the chrome every site page renders and validates it against the shared contract,
 * so malformed homepage copy or contact details fail here rather than rendering a page
 * without navigation. Site pages are noindex unless the `site.indexing` setting says
 * exactly `{ "index": true }`.
 */
export function toSiteChromeView(records: SiteChromeRecords): SiteChromeView {
  const indexing = siteIndexingSchema.safeParse(records.indexingSetting);
  return siteChromeViewSchema.parse(
    buildSiteChrome({
      indexable: indexing.success && indexing.data.index,
      content: homePageContentSchema.parse(records.contentSetting),
      contact: siteContactSchema.parse(records.contactSetting),
      reviews: homeReviewSummary(records.reviewSources, records.proofSetting),
      serviceGroups: records.categories,
      services: records.services,
      industries: records.industries,
      projects: records.projects.map(projectView).filter((project): project is HomeProject => project !== null),
      offices: records.locations,
    }),
  );
}
