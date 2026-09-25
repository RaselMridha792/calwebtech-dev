import { SEARCH_ROUTE, searchQuerySchema } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { SearchForm, SearchResultsList } from '@/components/search/search-results';
import { PageHero } from '@/components/site/page-hero';
import { Section } from '@/components/site/section';
import { searchSite } from '@/lib/api/search';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

/**
 * `/search/` (docs/03-page-specs.md, Utility pages; build plan task 4.3; docs/08-decisions.md,
 * 62): services, case studies, insights, glossary terms and questions, typed and filterable.
 * Never indexed — a results page is not a page anyone should land on from a search engine —
 * and not in the sitemap.
 */
export function generateMetadata(): Promise<Metadata> {
  return sitePageMetadata({
    title: 'Search',
    description: 'Search Calwebtech’s services, case studies, articles, glossary and answers to common questions.',
    path: SEARCH_ROUTE,
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const params = await searchParams;
  const raw = {
    q: typeof params.q === 'string' ? params.q : '',
    ...(typeof params.type === 'string' ? { type: params.type } : {}),
  };
  const parsed = searchQuerySchema.safeParse(raw);
  // An unknown type is ignored rather than refused, so a mistyped link still searches.
  const query = parsed.success
    ? parsed.data
    : searchQuerySchema.safeParse({ q: raw.q }).data;
  const results = query ? await searchSite(query) : null;

  return (
    <>
      <PageHero
        backdrop={HERO_BACKDROPS.sitemap}
        crumbs={[{ name: 'Search', path: SEARCH_ROUTE }]}
        title="Search"
        intro="Find a service, a case study, an article, a term from the glossary or an answer to a common question."
      />
      <Section tone="white" deferred={false}>
        <SearchForm query={raw.q} />
        {results ? <SearchResultsList results={results} /> : null}
        {!results && raw.q.trim().length === 1 ? (
          <p className="body-base mt-6 text-ink-muted" role="status">
            Type at least two characters.
          </p>
        ) : null}
      </Section>
    </>
  );
}
