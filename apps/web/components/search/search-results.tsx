import { SEARCH_ROUTE, SEARCH_TYPES, SEARCH_TYPE_LABELS, SITE_ROUTES, type SearchResults, type SearchType } from '@calwebtech/shared';

/**
 * The search form, the type filter and the results (docs/03-page-specs.md, Utility pages;
 * docs/08-decisions.md, 62). A plain GET form and links: no script, so the page costs nothing
 * in the budget and works before anything has loaded. Results are rows on hairlines, each
 * saying what kind of page it is before its title.
 */
function hrefFor(query: string, type: SearchType | null): string {
  const params = new URLSearchParams({ q: query, ...(type ? { type } : {}) });
  return `${SEARCH_ROUTE}?${params.toString()}`;
}

export function SearchForm({ query }: { query: string }) {
  return (
    <form role="search" action={SEARCH_ROUTE} method="get" className="max-w-[640px]">
      <label htmlFor="search-query" className="eyebrow block text-ink-muted">
        Search the site
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="search-query"
          type="search"
          name="q"
          defaultValue={query}
          minLength={2}
          maxLength={100}
          required
          autoComplete="off"
          placeholder="Services, case studies, articles, terms"
          className="h-14 w-full min-w-0 border border-hairline bg-canvas-raised px-4 text-ink placeholder:text-ink-muted/60 focus:border-gold-ink"
        />
        <button
          type="submit"
          className="button-label inline-flex h-14 shrink-0 items-center justify-center bg-navy-900 px-8 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export function SearchResultsList({ results }: { results: SearchResults }) {
  const filters: { type: SearchType | null; label: string; count: number }[] = [
    { type: null, label: 'All', count: results.total },
    ...SEARCH_TYPES.map((type) => ({ type, label: SEARCH_TYPE_LABELS[type], count: results.counts[type] })),
  ];

  if (results.total === 0) {
    return (
      <p className="body-lg mt-12 max-w-[46rem] border-t border-hairline pt-8 text-ink-muted" role="status">
        {`Nothing matched “${results.query}”. Try fewer or different words, or browse `}
        <a href={SITE_ROUTES.sitemap} className="text-ink underline decoration-hairline-gold underline-offset-4">
          every page on the sitemap
        </a>
        .
      </p>
    );
  }

  return (
    <div className="mt-12">
      <nav aria-label="Filter the results by kind of page">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-hairline pt-6">
          {filters
            .filter((filter) => filter.type === null || filter.count > 0)
            .map((filter) => {
              const current = filter.type === results.type;
              return (
                <li key={filter.label}>
                  <a
                    href={hrefFor(results.query, filter.type)}
                    aria-current={current ? 'page' : undefined}
                    className={`meta inline-flex min-h-11 items-center gap-2 border-b-2 ${
                      current ? 'border-gold-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                    }`}
                  >
                    {filter.label}
                    <span className="tabular-nums">{filter.count}</span>
                  </a>
                </li>
              );
            })}
        </ul>
      </nav>

      <p className="body-sm mt-6 text-ink-muted" role="status">
        {results.total === 1 ? '1 page matches' : `${String(results.total)} pages match`}
        {` “${results.query}”`}
        {results.type ? ` · showing ${SEARCH_TYPE_LABELS[results.type].toLowerCase()}` : ''}
      </p>

      <ol className="mt-4 max-w-[56rem]">
        {results.results.map((result) => (
          <li key={`${result.type} ${result.href} ${result.title}`} className="border-t border-hairline py-6">
            <p className="eyebrow text-gold-ink">{SEARCH_TYPE_LABELS[result.type]}</p>
            <h2 className="heading-md mt-2 text-ink">
              <a href={result.href} className="hover:underline hover:decoration-hairline-gold hover:underline-offset-4">
                {result.title}
              </a>
            </h2>
            {result.summary ? <p className="body-base mt-2 text-ink-muted">{result.summary}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
