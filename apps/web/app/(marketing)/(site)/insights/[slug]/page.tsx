import {
  INSIGHTS_ROUTE,
  insightsArticlePath,
  insightsCategoryPath,
  insightsListPath,
  insightsOgImagePath,
  readInsightsPage,
  type InsightsArticleView,
  type InsightsCategoryView,
} from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleBodySection } from '@/components/insights/article-page';
import {
  ArticleMeta,
  ArticleServicesSection,
  RelatedArticlesSection,
} from '@/components/insights/article-sections';
import { articleJsonLd } from '@/components/insights/json-ld';
import { InsightsListing, insightsResults } from '@/components/insights/listing';
import { listingPageSeo } from '@/components/insights/page-seo';
import { SubscribeForm } from '@/components/insights/subscribe-form';
import { JsonLd } from '@/components/seo/json-ld';
import { PageHero } from '@/components/site/page-hero';
import { getInsightsArticle, getInsightsIndex, getInsightsTopic } from '@/lib/api/insights';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';

/**
 * `/insights/<slug>/` is one URL space: a topic listing when a `PostCategory` has the slug,
 * an article otherwise. The topic wins, but the article is asked for first: articles are the
 * many and topics the few, and looking a topic up means fetching and validating the whole
 * index view. The invariant is upheld where the data is, not by the order here — the API
 * returns null for an article whose slug a topic owns (apps/api/src/insights/insights.service.ts)
 * and the snapshot test asserts no article snapshot has a topic's slug — so an article that
 * answers first can never be one a topic should have taken. Do not reorder these.
 */
type Resolved = { kind: 'topic'; topic: InsightsCategoryView } | { kind: 'article'; article: InsightsArticleView };

async function resolve(slug: string): Promise<Resolved | null> {
  const article = await getInsightsArticle(slug);
  if (article) return { kind: 'article', article };
  const topic = await getInsightsTopic(slug);
  return topic ? { kind: 'topic', topic } : null;
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
  const listing = insightsResults(view, topic.slug, page);
  if (!listing) notFound();

  return (
    <>
      <PageHero
        crumbs={crumbs([{ name: topic.name, path: insightsCategoryPath(topic.slug) }])}
        eyebrow={view.copy.eyebrow}
        title={topic.copy.title}
        intro={topic.copy.intro}
        backdrop={view.copy.backdrop ?? HERO_BACKDROPS.guides}
      />
      <InsightsListing view={view} topic={topic} heading={topic.copy.listHeading} results={listing.results} featured={null} />
    </>
  );
}

/** An article: the answer block under the H1, then the body, its proof and what to read next. */
function ArticlePage({ article }: { article: InsightsArticleView }) {
  const path = insightsArticlePath(article.slug);
  return (
    <>
      <PageHero
        backdrop={article.cover ? { src: article.cover.src } : HERO_BACKDROPS.guides}
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
      >
        <ArticleMeta view={article} />
      </PageHero>
      <ArticleBodySection
        view={article}
        subscribeForm={
          <SubscribeForm
            copy={article.copy.newsletter}
            sourcePage={path}
            turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
          />
        }
      />
      <ArticleServicesSection view={article} />
      <RelatedArticlesSection view={article} />
      <JsonLd data={articleJsonLd({ view: article, path })} />
    </>
  );
}
