import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load(env: { api?: string; source?: string } = {}) {
  vi.stubEnv('API_INTERNAL_URL', env.api ?? '');
  vi.stubEnv('CONTENT_SOURCE', env.source ?? '');
  return import('./search');
}

/**
 * The snapshot search (docs/08-decisions.md, 62): what the site searches while its pages render
 * from the committed snapshots, in the shape the Postgres search answers in.
 */
describe('searching the snapshots', () => {
  it('finds a service by its name first', async () => {
    const { searchSnapshots } = await load();
    const { results } = searchSnapshots({ q: 'shopify' });
    expect(results[0]).toMatchObject({ type: 'service', href: '/services/shopify-development/' });
  });

  it('finds glossary terms, articles and the questions on the FAQ page and on service pages', async () => {
    const { searchSnapshots } = await load();
    expect(searchSnapshots({ q: 'core web vitals' }).counts).toMatchObject({
      glossary: expect.any(Number) as unknown,
      insight: expect.any(Number) as unknown,
    });
    const vitals = searchSnapshots({ q: 'core web vitals' });
    expect(vitals.results.some((result) => result.href === '/glossary/core-web-vitals/')).toBe(true);
    expect(vitals.results.some((result) => result.type === 'insight')).toBe(true);
    const cost = searchSnapshots({ q: 'how much does a website cost', type: 'faq' });
    expect(cost.results.length).toBeGreaterThan(0);
    expect(cost.results.every((result) => result.type === 'faq')).toBe(true);
    expect(cost.results.map((result) => result.href)).toContain('/faq/');
  });

  it('needs every word of the query, and matches without accents or case', async () => {
    const { searchSnapshots } = await load();
    expect(searchSnapshots({ q: 'shopify zzzqqq' }).total).toBe(0);
    expect(searchSnapshots({ q: 'SHOPIFY' }).total).toBe(searchSnapshots({ q: 'shopify' }).total);
  });

  it('asks the API instead when pages come from the API', async () => {
    const counts = { service: 0, 'case-study': 0, insight: 0, glossary: 0, faq: 0 };
    const answer = { query: 'shopify', type: null, results: [], counts, total: 0 };
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(answer)));
    vi.stubGlobal('fetch', fetchMock);
    const { searchSite } = await load({ api: 'http://api.internal:4000' });
    expect(await searchSite({ q: 'shopify', type: 'faq' })).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledWith('http://api.internal:4000/search?q=shopify&type=faq', { cache: 'no-store' });
  });
});
