import {
  INSIGHTS_ROUTE,
  insightsArticlePath,
  insightsCategoryPath,
  insightsListPath,
  insightsOgImagePath,
  paginate,
  readInsightsPage,
  type InsightsArticleView,
  type InsightsCategoryView,
} from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleBodySection } from '@/components/insights/article-page';
import {
  ArticleCover,
  ArticleMeta,
  ArticleServicesSection,
  RelatedArticlesSection,
} from '@/components/insights/article-sections';
import { articleJsonLd } from '@/components/insights/json-ld';
import { InsightsListing } from '@/components/insights/listing';
import { listingPageSeo } from '@/components/insights/page-seo';
import { JsonLd } from '@/components/seo/json-ld';
import { PageHero } from '@/components/site/page-hero';
import { getInsightsArticle, getInsightsIndex, getInsightsTopic } from '@/lib/api/insights';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

/**
 * `/insights/<slug>/` is one URL space: a topic listing when a `PostCategory` has the slug,
 * an article otherwise. The API leaves an article off `/insights/` when a topic already owns
 * its URL, so the two can never both answer.
 */
type Resolved = { kind: 'topic'; topic: InsightsCategoryView } | { kind: 'article'; article: InsightsArticleView };

async function resolve(slug: string): Promise<Resolved | null> {
  const topic = await getInsightsTopic(slug);
  if (topic) return { kind: 'topic', topic };
  const article = await getInsightsArticle(slug);
  return article ? { kind: 'article', article } : null;
}

const crumbs = (trail: { name: string; path: string }[]) => [{ name: 'Insights', path: INSIGHTS_ROUTE }, ...trail];

export async function generateMetadata({ params, searchParams }: PageProps<'/insights/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolve(slug);
  if (!resolved) return { robots: { index: false, follow: false } };

  if (resolved.kind === 'topic') {
    const page = readInsightsPage(await searchParams);
    if (page === null) return { robots: { index: false, follow: false } };
    const { topic } = resolved;
    return sitePageMetadata({
      ...listingPageSeo(topic.copy.seo, page),
      path: insightsListPath(topic.slug, page),
      ogImage: topic.copy.seo.ogImage ?? insightsOgImagePath(topic.slug),
      // A topic with nothing published in it is a page with nothing to read.
      noindex: topic.articleCount === 0,
    });
  }

  const { article } = resolved;
  return sitePageMetadata({
    title: article.seo.title,
    description: article.seo.description,
    path: insightsArticlePath(article.slug),
    // Every article shares with the image generated for it (opengraph-image.tsx).
    ogImage: article.seo.ogImage ?? insightsOgImagePath(article.slug),
    ogImageAlt: article.title,
    type: 'article',
  });
}

export default async function InsightsSlugPage({ params, searchParams }: PageProps<'/insights/[slug]'>) {
  const { slug } = await params;
  const resolved = await resolve(slug);
  if (!resolved) notFound();
  if (resolved.kind === 'article') return <ArticlePage article={resolved.article} />;

  const page = readInsightsPage(await searchParams);
  if (page === null) notFound();
  return <TopicPage topic={resolved.topic} page={page} />;
}

/** A topic listing: the same list as the index, filtered to one `PostCategory`. */
async function TopicPage({ topic, page }: { topic: InsightsCategoryView; page: number }) {
  const view = await getInsightsIndex();
  const results = paginate(
    view.articles.filter((article) => article.category?.slug === topic.slug),
    page,
  );
  if (!results) notFound();

  return (
    <>
      <PageHero
        crumbs={crumbs([{ name: topic.name, path: insightsCategoryPath(topic.slug) }])}
        eyebrow={view.copy.eyebrow}
        title={topic.copy.title}
        intro={topic.copy.intro}
        backdrop={view.copy.backdrop}
      />
      <InsightsListing view={view} topic={topic} heading={topic.copy.listHeading} results={results} featured={null} />
    </>
  );
}

/** An article: the answer block under the H1, then the body, its proof and what to read next. */
function ArticlePage({ article }: { article: InsightsArticleView }) {
  const path = insightsArticlePath(article.slug);
  return (
    <>
      <PageHero
        ground="light"
        crumbs={crumbs([
          ...(article.category
            ? [{ name: article.category.name, path: insightsCategoryPath(article.category.slug) }]
            : []),
          { name: article.title, path },
        ])}
        eyebrow={article.category?.name}
        title={article.title}
        answer={article.answerBlock}
        intro={article.excerpt}
        aside={article.cover ? <ArticleCover image={article.cover} /> : null}
      >
        <ArticleMeta view={article} />
      </PageHero>
      <ArticleBodySection view={article} path={path} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY} />
      <ArticleServicesSection view={article} />
      <RelatedArticlesSection view={article} />
      <JsonLd data={articleJsonLd({ view: article, path })} />
    </>
  );
}
