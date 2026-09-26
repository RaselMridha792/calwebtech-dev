import { getHomePage } from '@/lib/api';
import { getIndustriesIndex } from '@/lib/api/industries';
import { getLocationsIndex } from '@/lib/api/locations';
import { getServicesIndex } from '@/lib/api/services';
import { getSiteChrome } from '@/lib/api/site';
import { buildLlmsTxt } from '@/lib/seo/llms';
import { siteOrigin } from '@/lib/seo/site';

// Read per request, like robots.txt: site.indexing flips without a redeploy, and a service
// published from the dashboard belongs in the list at once.
export const dynamic = 'force-dynamic';

/**
 * `/llms.txt` (docs/08-decisions.md, 62). Answered only while the site may be indexed: until
 * `site.indexing` is on, robots.txt disallows everything and this is a 404, so neither invites
 * a crawler to pages that are noindex.
 */
export async function GET(): Promise<Response> {
  const chrome = await getSiteChrome();
  if (!chrome.indexable) return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain' } });

  const [home, services, industries, locations] = await Promise.all([
    getHomePage(),
    getServicesIndex(),
    getIndustriesIndex(),
    getLocationsIndex(),
  ]);
  const body = buildLlmsTxt({
    origin: siteOrigin(),
    description: home.content.seo.description,
    chrome,
    services,
    industries,
    locations,
  });
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
