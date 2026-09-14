import 'server-only';
import {
  INSIGHTS_ROUTE,
  insightsArticlePath,
  insightsArticleViewSchema,
  insightsCategoryPath,
  insightsIndexViewSchema,
  type InsightsCategoryView,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { insightsArticleSnapshots, insightsIndexSnapshot } from '@/static-content/insights';
import { findView, getView } from './core';

/**
 * The insights family's data (docs/10-site-pages.md). `/insights/<slug>/` is one URL space:
 * a topic page comes from the index view, an article from its own view, and the topic wins
 * when both exist, which the API enforces too.
 */
export const getInsightsIndex = cache(() =>
  getView('/pages/insights', insightsIndexViewSchema, insightsIndexSnapshot),
);

/** A published article, or null for a 404. */
export const getInsightsArticle = cache((slug: string) =>
  findView(
    `/pages/insights/${encodeURIComponent(slug)}`,
    insightsArticleViewSchema,
    // Own keys only, so a slug such as "constructor" is a 404 rather than an object's method.
    Object.hasOwn(insightsArticleSnapshots, slug) ? insightsArticleSnapshots[slug] : null,
  ),
);

/** A topic, or null when no `PostCategory` has that slug. */
export const getInsightsTopic = cache(async (slug: string): Promise<InsightsCategoryView | null> => {
  const index = await getInsightsIndex();
  return index.categories.find((category) => category.slug === slug) ?? null;
});

export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getInsightsIndex();
  return [
    { path: INSIGHTS_ROUTE, title: 'Insights', section: 'Insights' },
    // A topic with nothing published in it is a page with nothing to read.
    ...index.categories
      .filter((category) => category.articleCount > 0)
      .map((category) => ({ path: insightsCategoryPath(category.slug), title: category.copy.title, section: 'Insights' })),
    ...index.articles.map((article) => ({
      path: insightsArticlePath(article.slug),
      title: article.title,
      section: 'Insights',
      lastModified: article.updatedAt,
    })),
  ];
}
