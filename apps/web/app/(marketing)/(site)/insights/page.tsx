import { INSIGHTS_ROUTE, insightsListPath, readInsightsPage } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InsightsListing, insightsResults } from '@/components/insights/listing';
import { listingPageSeo } from '@/components/insights/page-seo';
import { PageHero } from '@/components/site/page-hero';
import { getInsightsIndex } from '@/lib/api/insights';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

const CRUMBS = [{ name: 'Insights', path: INSIGHTS_ROUTE }];

export async function generateMetadata({ searchParams }: PageProps<'/insights'>): Promise<Metadata> {
  const page = readInsightsPage(await searchParams);
  if (page === null) return { robots: { index: false, follow: false } };
  const { copy } = await getInsightsIndex();
  return sitePageMetadata({
    // Later pages are indexable in their own right, so each has its own title.
    ...listingPageSeo(copy.seo, page),
    path: insightsListPath(null, page),
    ogImage: copy.seo.ogImage,
  });
}

/**
 * `/insights/`: the featured article, then every published article, twelve to a page. The
 * topic filter is written into the URL as a page of its own, `/insights/<topic>/`.
 *
 * Reached from the homepage, from every article and from `/sitemap/`, but not yet from the
 * chrome: the five "Insights" and "News" links in the menus and the footer still point at the
 * homepage `#insights` section. `home.json` and `site-chrome.json` are foundation, so the
 * family's report asks for those five hrefs rather than editing them here.
 */
export default async function InsightsIndexPage({ searchParams }: PageProps<'/insights'>) {
  const page = readInsightsPage(await searchParams);
  if (page === null) notFound();
  const view = await getInsightsIndex();

  const listing = insightsResults(view, null, page);
  if (!listing) notFound();

  const { copy } = view;
  return (
    <>
      <PageHero
        crumbs={CRUMBS}
        eyebrow={copy.eyebrow}
        title={copy.title}
        intro={copy.intro}
        backdrop={copy.backdrop}
      />
      <InsightsListing
        view={view}
        topic={null}
        heading={copy.listHeading}
        results={listing.results}
        featured={listing.featured}
      />
    </>
  );
}
