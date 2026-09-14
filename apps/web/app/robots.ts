import type { MetadataRoute } from 'next';
import { getSiteChrome } from '@/lib/api/site';
import { absoluteUrl } from '@/lib/seo/site';

// Read per request: site.indexing flips without a redeploy, and the build cannot reach the API.
export const dynamic = 'force-dynamic';

/**
 * Answer engines retrieve from their own crawls, so they are welcomed by name
 * (docs/04-seo-keyword-map.md). A crawler with its own group ignores the `*` group, so each
 * group repeats the same rules.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
];

/**
 * Disallows all crawling until the `site.indexing` setting is on; site pages are also
 * noindex until then. The API shares the origin at /api and is never crawled.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const chrome = await getSiteChrome();
  if (!chrome.indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  const rules = { allow: '/', disallow: '/api/' };
  return {
    rules: [
      { userAgent: '*', ...rules },
      { userAgent: AI_CRAWLERS, ...rules },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
