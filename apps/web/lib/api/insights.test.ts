import { INSIGHTS_ROUTE, insightsArticleViewSchema, insightsIndexViewSchema } from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insightsArticleSnapshots, insightsIndexSnapshot } from '@/static-content/insights';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** A fresh module each time, so React's `cache` keeps nothing from the test before. */
async function load(apiUrl = '') {
  vi.stubEnv('API_INTERNAL_URL', apiUrl);
  return import('./insights');
}

const index = insightsIndexViewSchema.parse(insightsIndexSnapshot);
const [firstSlug = ''] = Object.keys(insightsArticleSnapshots);

describe('the insights getters without the API (the Vercel demo)', () => {
  it('serve the index from the snapshot, validated with the same schema as a live response', async () => {
    const { getInsightsIndex } = await load();
    expect(await getInsightsIndex()).toEqual(index);
  });

  it('serve a published article, and answer null for a slug nobody has published', async () => {
    const { getInsightsArticle } = await load();
    const article = await getInsightsArticle(firstSlug);
    expect(article).toEqual(insightsArticleViewSchema.parse(insightsArticleSnapshots[firstSlug]));
    expect(await getInsightsArticle('no-such-article')).toBeNull();
  });

  it('never read a slug off Object.prototype, so /insights/constructor/ is a 404 and not a 500', async () => {
    const { getInsightsArticle } = await load();
    for (const slug of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(await getInsightsArticle(slug), slug).toBeNull();
    }
  });

  it('resolve a topic from the index, and nothing for a slug no topic has', async () => {
    const { getInsightsTopic } = await load();
    const first = index.categories[0];
    expect(first).toBeDefined();
    expect(await getInsightsTopic(first?.slug ?? '')).toEqual(first);
    expect(await getInsightsTopic('no-such-topic')).toBeNull();
    // An article never answers as a topic: the two share one URL space.
    expect(await getInsightsTopic(firstSlug)).toBeNull();
  });
});

describe('the insights sitemap source', () => {
  it('lists the index, every topic that has something to read, and every article with its date', async () => {
    const { sitemapEntries } = await load();
    const entries = await sitemapEntries();
    const paths = entries.map((entry) => entry.path);

    expect(paths[0]).toBe(INSIGHTS_ROUTE);
    expect(new Set(paths).size, 'each page once').toBe(paths.length);
    for (const entry of entries) {
      expect(entry.path, entry.path).toMatch(/^\/insights\/([a-z0-9-]+\/)?$/);
      expect(entry.section).toBe('Insights');
      expect(entry.title.trim().length).toBeGreaterThan(0);
    }

    for (const topic of index.categories) {
      expect(paths.includes(`/insights/${topic.slug}/`), topic.slug).toBe(topic.articleCount > 0);
    }
    for (const article of index.articles) {
      const entry = entries.find((item) => item.path === `/insights/${article.slug}/`);
      expect(entry, article.slug).toBeDefined();
      expect(entry?.lastModified).toBe(article.updatedAt);
    }
  });
});

describe('the insights getters with the API', () => {
  it('read the index and an article from the API, never from the snapshot', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/pages/insights')) return Promise.resolve(Response.json(index));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getInsightsIndex, getInsightsArticle } = await load('http://api.test');

    expect(await getInsightsIndex()).toEqual(index);
    // The API owns what is published: a 404 there is a 404 here, even with a snapshot on disk.
    expect(await getInsightsArticle(firstSlug)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/pages/insights', { cache: 'no-store' });
    vi.unstubAllGlobals();
  });
});
