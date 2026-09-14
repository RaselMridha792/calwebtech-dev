import type { SitemapSource } from './sitemap';

/**
 * Where sitemap.xml and the /sitemap/ page get their pages. Each site family appends one
 * line that loads its getter module and returns its published pages (docs/10-site-pages.md):
 *
 *   () => import('@/lib/api/services').then((module) => module.sitemapEntries()),
 */
export const SITEMAP_SOURCES: readonly SitemapSource[] = [
  () => import('./sitemap-core').then((module) => module.coreSitemapEntries()),
  // Site page families: one line each, below this one.
  () => import('@/lib/api/locations').then((module) => module.sitemapEntries()),
];
