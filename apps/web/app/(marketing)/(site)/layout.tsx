import { SiteShell } from '@/components/site/site-shell';
import { getSiteChrome } from '@/lib/api/site';

// Every site page renders per request, like the homepage (docs/08-decisions.md, 30 and 35).
// The CI build cannot reach the API to prerender, and site.indexing and published records
// must apply without a redeploy. The API caches each view for 30 seconds.
export const dynamic = 'force-dynamic';

/** The frame of every site page (docs/10-site-pages.md). Pages render only their content. */
export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const chrome = await getSiteChrome();
  return <SiteShell chrome={chrome}>{children}</SiteShell>;
}
