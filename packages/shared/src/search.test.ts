import { describe, expect, it } from 'vitest';
import { SEARCH_LIMIT, searchQuerySchema, searchResults, searchTerms, type SearchResult } from './search';

const result = (type: SearchResult['type'], title: string): SearchResult => ({ type, title, summary: '', href: '/x/' });

describe('the search contract', () => {
  it('takes a query of two characters or more, and a type from the list', () => {
    expect(searchQuerySchema.safeParse({ q: ' shopify ' }).data).toEqual({ q: 'shopify' });
    expect(searchQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'shopify', type: 'insight' }).success).toBe(true);
    expect(searchQuerySchema.safeParse({ q: 'shopify', type: 'people' }).success).toBe(false);
  });

  it('reads a query as its words, accents and punctuation aside', () => {
    expect(searchTerms('Café, Next.js & A/B')).toEqual(['cafe', 'next', 'js']);
  });

  it('counts every type, keeps the chosen one in rank order, and caps the list', () => {
    const matches = [result('service', 'One'), result('faq', 'Two'), result('service', 'Three')];
    const all = searchResults('q', null, matches);
    expect(all.counts).toMatchObject({ service: 2, faq: 1, insight: 0 });
    expect(all.total).toBe(3);
    expect(searchResults('q', 'service', matches).results.map((match) => match.title)).toEqual(['One', 'Three']);
    const many = Array.from({ length: SEARCH_LIMIT + 5 }, (_, index) => result('glossary', String(index)));
    expect(searchResults('q', null, many).results).toHaveLength(SEARCH_LIMIT);
  });
});
