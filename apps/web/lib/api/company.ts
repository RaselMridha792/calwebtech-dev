import 'server-only';
import { COMPANY_VIEW_SCHEMAS, SITE_ROUTES } from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { companySnapshots } from '@/static-content/company';
import { findView } from './core';

/*
 * The company family's pages (docs/10-site-pages.md). Each is null when its copy is not
 * published (the API answers 404), and the page then calls notFound(). Without the API they
 * render the committed snapshots, validated with the same schemas.
 */

export const getCompanyAboutPage = cache(() =>
  findView('/pages/about', COMPANY_VIEW_SCHEMAS.about, companySnapshots.about),
);

export const getCompanyTeamPage = cache(() => findView('/pages/team', COMPANY_VIEW_SCHEMAS.team, companySnapshots.team));

export const getCompanyTestimonialsPage = cache(() =>
  findView('/pages/testimonials', COMPANY_VIEW_SCHEMAS.testimonials, companySnapshots.testimonials),
);

export const getCompanyAwardsPage = cache(() =>
  findView('/pages/awards', COMPANY_VIEW_SCHEMAS.awards, companySnapshots.awards),
);

export const getCompanyPartnersPage = cache(() =>
  findView('/pages/partners', COMPANY_VIEW_SCHEMAS.partners, companySnapshots.partners),
);

export const getCompanyTechnologyPage = cache(() =>
  findView('/pages/technology', COMPANY_VIEW_SCHEMAS.technology, companySnapshots.technology),
);

/** The published company pages, for sitemap.xml and /sitemap/. */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const pages = await Promise.all([
    getCompanyAboutPage().then((page) => page && { path: SITE_ROUTES.about, title: page.content.seo.title }),
    getCompanyTeamPage().then((page) => page && { path: SITE_ROUTES.team, title: page.content.seo.title }),
    getCompanyTestimonialsPage().then((page) => page && { path: SITE_ROUTES.testimonials, title: page.content.seo.title }),
    getCompanyAwardsPage().then((page) => page && { path: SITE_ROUTES.awards, title: page.content.seo.title }),
    getCompanyPartnersPage().then((page) => page && { path: SITE_ROUTES.partners, title: page.content.seo.title }),
    getCompanyTechnologyPage().then((page) => page && { path: SITE_ROUTES.technology, title: page.content.seo.title }),
  ]);
  return pages.flatMap((page) => (page ? [{ ...page, section: 'Company' }] : []));
}
