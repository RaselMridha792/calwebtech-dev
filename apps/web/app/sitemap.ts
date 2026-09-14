import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';
import { sitemapEntries } from '@/lib/sitemap';

// Read per request: publishing a record adds its page without a redeploy.
export const dynamic = 'force-dynamic';

/** sitemap.xml, from the sources registered in lib/sitemap-sources.ts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await sitemapEntries();
  return entries.map((entry) => ({
    url: absoluteUrl(entry.path),
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
  }));
}
