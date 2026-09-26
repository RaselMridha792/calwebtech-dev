import { searchResults } from '@calwebtech/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchForm, SearchResultsList } from './search-results';

const matches = [
  { type: 'service' as const, title: 'Shopify development', summary: 'Test summary.', href: '/services/shopify-development/' },
  { type: 'faq' as const, title: 'Do you build on Shopify?', summary: 'Test answer.', href: '/faq/' },
];

describe('the search page', () => {
  it('searches with a labelled GET form that keeps the query', () => {
    const html = renderToStaticMarkup(<SearchForm query="shopify" />);
    expect(html).toContain('role="search"');
    expect(html).toContain('action="/search/" method="get"');
    expect(html).toContain('for="search-query"');
    expect(html).toContain('value="shopify"');
  });

  it('says what kind of page each result is, and filters by kind with counts', () => {
    const html = renderToStaticMarkup(<SearchResultsList results={searchResults('shopify', null, matches)} />);
    expect(html).toContain('href="/services/shopify-development/"');
    expect(html).toContain('>Services</p>');
    expect(html).toContain('href="/search/?q=shopify&amp;type=faq"');
    expect(html).toMatch(/aria-current="page"[^>]*>All/);
    // A kind with no matches is not offered.
    expect(html).not.toContain('type=glossary');
  });

  it('marks the chosen kind, and points somewhere useful when nothing matches', () => {
    const faqs = renderToStaticMarkup(<SearchResultsList results={searchResults('shopify', 'faq', matches)} />);
    expect(faqs).toMatch(/href="\/search\/\?q=shopify&amp;type=faq" aria-current="page"/);
    expect(faqs).not.toContain('href="/services/shopify-development/"');

    const none = renderToStaticMarkup(<SearchResultsList results={searchResults('zzz', null, [])} />);
    expect(none).toContain('Nothing matched');
    expect(none).toContain('href="/sitemap/"');
  });
});
