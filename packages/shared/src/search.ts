import { z } from 'zod';

/**
 * Site search (docs/06-build-plan.md, task 4.3; docs/08-decisions.md, 62): services, case
 * studies, insights, glossary terms and questions, typed and filterable, with no search vendor.
 * The API searches Postgres with its own full-text engine; while pages render from snapshots,
 * the web app searches the same content in the snapshots, and both answer in this shape.
 */
export const SEARCH_ROUTE = '/search/';

export const SEARCH_TYPES = ['service', 'case-study', 'insight', 'glossary', 'faq'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const searchTypeSchema = z.enum(SEARCH_TYPES);

/** The filter's words, in the order the page offers them. */
export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  service: 'Services',
  'case-study': 'Case studies',
  insight: 'Insights',
  glossary: 'Glossary',
  faq: 'Questions',
};

/** Most results a page shows; a query that matches more asks for a narrower query or a type. */
export const SEARCH_LIMIT = 30;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: searchTypeSchema.optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.object({
  type: searchTypeSchema,
  title: z.string().min(1),
  /** One or two lines under the title. */
  summary: z.string(),
  /** A site path. */
  href: z.string().startsWith('/'),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

/** What a search returns: the results of the chosen type, and how many each type matched. */
export const searchResultsSchema = z.object({
  query: z.string(),
  type: searchTypeSchema.nullable(),
  results: z.array(searchResultSchema).max(SEARCH_LIMIT),
  counts: z.record(searchTypeSchema, z.number().int().min(0)),
  total: z.number().int().min(0),
});
export type SearchResults = z.infer<typeof searchResultsSchema>;

/** A query's words, lower-cased, without punctuation or the shortest ones. */
export function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2);
}

/**
 * Filters and counts a list of matches already in rank order: the shape both engines return,
 * so the page cannot tell them apart.
 */
export function searchResults(query: string, type: SearchType | null, matches: readonly SearchResult[]): SearchResults {
  const counts = Object.fromEntries(SEARCH_TYPES.map((key) => [key, 0])) as Record<SearchType, number>;
  for (const match of matches) counts[match.type] += 1;
  const chosen = type ? matches.filter((match) => match.type === type) : matches;
  return { query, type, results: chosen.slice(0, SEARCH_LIMIT), counts, total: matches.length };
}
