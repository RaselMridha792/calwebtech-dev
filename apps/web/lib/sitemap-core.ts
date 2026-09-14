import { SITE_ROUTES } from '@calwebtech/shared';
import type { SitemapEntry } from './sitemap';

/** Pages that exist whatever is published: the homepage and the HTML sitemap. */
export function coreSitemapEntries(): Promise<SitemapEntry[]> {
  return Promise.resolve([
    { path: SITE_ROUTES.home, title: 'Home', section: 'Overview' },
    { path: SITE_ROUTES.sitemap, title: 'Sitemap', section: 'Legal' },
  ]);
}
