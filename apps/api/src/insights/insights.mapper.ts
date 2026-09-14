import type { MediaAsset, Prisma } from '@calwebtech/db';
import {
  INSIGHTS_RELATED_LIMIT,
  answerBlockSchema,
  articleBodyProblems,
  articleLinkedSlugs,
  articleWordCount,
  caseStudyCardSchema,
  imageSchema,
  insightsArticleCardSchema,
  insightsArticleViewSchema,
  insightsAuthorSchema,
  insightsCategoryCopyFor,
  insightsCategoryViewSchema,
  insightsCopySchema,
  insightsIndexViewSchema,
  metricSchema,
  readingMinutes,
  seoSchema,
  splitKeyTakeaways,
  type CaseStudyCard,
  type Image,
  type InsightsArticleCard,
  type InsightsArticleView,
  type InsightsAuthor,
  type InsightsCategoryRef,
  type InsightsCategoryView,
  type InsightsCopy,
  type InsightsIndexView,
  type InsightsServiceLink,
} from '@calwebtech/shared';
import { z } from 'zod';

/**
 * Records to views for `/insights/`, `/insights/<topic>/` and `/insights/<slug>/`.
 *
 * An article is a `Post`. Everything the template needs beyond the columns is read out of
 * its Markdown body with the shared helpers (packages/shared/src/pages/insights.ts): the
 * key takeaways, the headings, and the service and case study pages it links to. The copy
 * around the articles is the `insights.copy` setting.
 */

/** Relations loaded for an article: its topic, its author, and nothing else. */
export const insightsPostInclude = {
  category: { select: { slug: true, name: true } },
  author: { select: { slug: true, name: true, role: true, bio: true, photo: true, skills: true } },
} satisfies Prisma.PostInclude;

export type InsightsPostRecord = Prisma.PostGetPayload<{ include: typeof insightsPostInclude }>;

/** The columns a linked service contributes to the contextual call to action. */
export const insightsServiceSelect = { slug: true, title: true, shortDescription: true } satisfies Prisma.ServiceSelect;
export type InsightsServiceRecord = Prisma.ServiceGetPayload<{ select: typeof insightsServiceSelect }>;

/** Relations loaded for the case study an article links to, for its card. */
export const insightsProjectInclude = {
  industry: { select: { name: true, status: true } },
  technologies: { orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { name: true } },
} satisfies Prisma.ProjectInclude;
export type InsightsProjectRecord = Prisma.ProjectGetPayload<{ include: typeof insightsProjectInclude }>;

/** A record or setting that does not meet the contract, named so the log says which to fix. */
export class InsightsContractError extends Error {
  constructor(
    readonly record: string,
    cause: unknown,
  ) {
    super(`${record} does not match the insights contract`, { cause });
    this.name = 'InsightsContractError';
  }
}

function parseAs<Schema extends z.ZodType>(record: string, schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InsightsContractError(record, result.error);
  return result.data;
}

export function parseInsightsCopy(setting: unknown): InsightsCopy {
  return parseAs('The "insights.copy" setting', insightsCopySchema, setting);
}

const present = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Shortens copy to `max` characters at a word boundary, for a title or description fallback. */
export function clamp(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const window = text.slice(0, max + 1);
  const boundary = window.lastIndexOf(' ');
  return (boundary > max * 0.6 ? window.slice(0, boundary) : text.slice(0, max)).replace(/[\s,;:.–-]+$/u, '');
}

/**
 * Alt text for an image in the media library, keyed by its URL. The library requires alt
 * text at upload, so an image with none is left out rather than rendered without it.
 */
export type AltTextByUrl = ReadonlyMap<string, string>;

export const altTextByUrl = (assets: readonly Pick<MediaAsset, 'url' | 'altText'>[]): AltTextByUrl =>
  new Map(assets.filter((asset) => present(asset.altText)).map((asset) => [asset.url, asset.altText]));

function coverImage(url: string | null, alt: AltTextByUrl): Image | null {
  if (!present(url)) return null;
  const altText = alt.get(url);
  if (!present(altText)) return null;
  const parsed = imageSchema.safeParse({ src: url, alt: altText });
  return parsed.success ? parsed.data : null;
}

/** Cover image URLs of a set of articles, so one query reads all their alt text. */
export const coverImageUrls = (posts: readonly InsightsPostRecord[]): string[] => [
  ...new Set(posts.map((post) => post.coverImage).filter(present)),
];

// ---------------------------------------------------------------- readiness

export interface ReadyArticle {
  ready: true;
  body: string;
  takeaways: string[];
  wordCount: number;
}

export type ArticleReadiness = ReadyArticle | { ready: false; reason: string };

/**
 * Whether a published article has a page: an answer block of two or three sentences and a
 * body whose headings are questions at `##` and `###`. An article that fails is left off
 * the index and its URL answers 404, rather than publishing a page that breaks the rules
 * every other page is held to.
 */
export function articleReadiness(post: Pick<InsightsPostRecord, 'answerBlock' | 'body'>): ArticleReadiness {
  if (!answerBlockSchema.safeParse(post.answerBlock).success) {
    return { ready: false, reason: 'needs an answer block of two or three complete sentences' };
  }
  const { body, takeaways } = splitKeyTakeaways(post.body);
  const problems = articleBodyProblems(body);
  if (problems.length > 0) return { ready: false, reason: `has a body to fix: ${problems.join(' ')}` };
  const wordCount = articleWordCount(body);
  if (wordCount === 0) return { ready: false, reason: 'has an empty body' };
  return { ready: true, body, takeaways, wordCount };
}

// ---------------------------------------------------------------- pieces

const categoryRef = (post: InsightsPostRecord): InsightsCategoryRef | null =>
  post.category ? { slug: post.category.slug, name: post.category.name } : null;

const publishedDate = (post: Pick<InsightsPostRecord, 'publishedAt' | 'createdAt'>): Date =>
  post.publishedAt ?? post.createdAt;

const credentialsSchema = z.array(z.string().trim().min(1).max(160)).max(6);

export function authorView(post: InsightsPostRecord): InsightsAuthor | null {
  const author = post.author;
  if (!author) return null;
  const credentials = credentialsSchema.safeParse(author.skills);
  const photo = present(author.photo) ? imageSchema.safeParse({ src: author.photo, alt: `${author.name}, ${author.role}` }) : null;
  return parseAs(`Team member "${author.slug}"`, insightsAuthorSchema, {
    slug: author.slug,
    name: author.name,
    role: author.role,
    bio: present(author.bio) ? author.bio : null,
    photo: photo?.success ? photo.data : null,
    credentials: credentials.success ? credentials.data : [],
  });
}

function cardOf(post: InsightsPostRecord, readiness: ReadyArticle, alt: AltTextByUrl): InsightsArticleCard {
  return parseAs(`Post "${post.slug}"`, insightsArticleCardSchema, {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: categoryRef(post),
    authorName: post.author?.name ?? null,
    readingTime: post.readingTime && post.readingTime > 0 ? post.readingTime : readingMinutes(readiness.wordCount),
    publishedAt: publishedDate(post).toISOString(),
    image: coverImage(post.coverImage, alt),
    featured: post.featured,
  });
}

/** Articles that have a page, as cards, in the order given. */
export function articleCards(
  posts: readonly InsightsPostRecord[],
  alt: AltTextByUrl,
  onSkipped?: (slug: string, reason: string) => void,
): InsightsArticleCard[] {
  return posts.flatMap((post) => {
    const readiness = articleReadiness(post);
    if (!readiness.ready) {
      onSkipped?.(post.slug, readiness.reason);
      return [];
    }
    return [cardOf(post, readiness, alt)];
  });
}

function serviceLinks(body: string, services: readonly InsightsServiceRecord[]): InsightsServiceLink[] {
  const bySlug = new Map(services.map((service) => [service.slug, service]));
  return articleLinkedSlugs(body, '/services/')
    .flatMap((slug) => {
      const service = bySlug.get(slug);
      return service ? [{ slug: service.slug, title: service.title, summary: service.shortDescription }] : [];
    })
    .slice(0, INSIGHTS_RELATED_LIMIT);
}

/** The card of the case study an article links to: the same tags and figures `/work/` shows. */
export function caseStudyCard(project: InsightsProjectRecord, alt: AltTextByUrl): CaseStudyCard | null {
  const metrics = z.array(metricSchema).safeParse(project.outcomeMetrics);
  if (!metrics.success || metrics.data.length === 0) return null;
  const tags = [
    project.location?.trim(),
    ...(project.segment ?? '').split(',').map((part) => part.trim()),
    ...project.technologies.map((technology) => technology.name),
  ].filter(present);
  const image =
    present(project.coverImageUrl) && present(project.coverImageAlt)
      ? { src: project.coverImageUrl, alt: project.coverImageAlt }
      : coverImage(project.coverImageUrl, alt);
  return parseAs(`Project "${project.slug}"`, caseStudyCardSchema, {
    slug: project.slug,
    clientName: project.clientAlias ?? project.clientName,
    summary: project.summary,
    tags: [...new Set(tags)].slice(0, 4),
    image,
    metrics: metrics.data.slice(0, 3),
  });
}

/**
 * Up to three articles to read next: the same topic first, newest first, then the rest.
 * The article itself and anything without a page are left out.
 */
export function relatedArticles(
  post: InsightsPostRecord,
  others: readonly InsightsPostRecord[],
  alt: AltTextByUrl,
): InsightsArticleCard[] {
  const topic = post.category?.slug ?? null;
  const candidates = others
    .filter((other) => other.slug !== post.slug)
    .map((other, order) => ({ other, order, sameTopic: topic !== null && other.category?.slug === topic }))
    .sort((a, b) => Number(b.sameTopic) - Number(a.sameTopic) || a.order - b.order)
    .map(({ other }) => other);
  return articleCards(candidates, alt).slice(0, INSIGHTS_RELATED_LIMIT);
}

function articleSeo(post: InsightsPostRecord, excerpt: string): unknown {
  const seo = seoSchema.safeParse(post.seo);
  const own = seo.success ? seo.data : {};
  return {
    title: own.title ?? clamp(post.title, 60),
    description: own.description ?? clamp(excerpt, 155),
    ogImage: own.ogImage ?? null,
  };
}

// ---------------------------------------------------------------- views

export interface InsightsIndexSources {
  copySetting: unknown;
  categories: { slug: string; name: string }[];
  posts: InsightsPostRecord[];
  media: Pick<MediaAsset, 'url' | 'altText'>[];
  /** Reports an article that is published but has no page, so the log names it. */
  onSkipped?: (slug: string, reason: string) => void;
}

export function toInsightsIndexView(sources: InsightsIndexSources): InsightsIndexView {
  const copy = parseInsightsCopy(sources.copySetting);
  const alt = altTextByUrl(sources.media);
  // A topic and an article cannot share a URL: the topic keeps it, the article is skipped.
  const topics = new Set(sources.categories.map((category) => category.slug));
  const posts = sources.posts.filter((post) => {
    if (!topics.has(post.slug)) return true;
    sources.onSkipped?.(post.slug, 'has the same slug as a topic page, which owns that URL');
    return false;
  });
  const cards = articleCards(posts, alt, sources.onSkipped);
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.category) counts.set(card.category.slug, (counts.get(card.category.slug) ?? 0) + 1);
  }

  const categories: InsightsCategoryView[] = sources.categories.map((category) =>
    parseAs(`Topic "${category.slug}"`, insightsCategoryViewSchema, {
      slug: category.slug,
      name: category.name,
      articleCount: counts.get(category.slug) ?? 0,
      copy: insightsCategoryCopyFor(copy, { slug: category.slug, name: category.name }),
    }),
  );

  const featured = cards.find((card) => card.featured) ?? cards[0] ?? null;
  return parseAs('The insights index', insightsIndexViewSchema, {
    copy: copy.index,
    categories,
    articles: cards,
    featuredSlug: featured?.slug ?? null,
  });
}

export interface InsightsArticleSources {
  copySetting: unknown;
  post: InsightsPostRecord;
  readiness: ReadyArticle;
  /** Published services the body links to, in any order. */
  services: InsightsServiceRecord[];
  /** The published case study the body links to first, when there is one. */
  project: InsightsProjectRecord | null;
  /** Other published articles, newest first, for the related strip. */
  others: InsightsPostRecord[];
  media: Pick<MediaAsset, 'url' | 'altText'>[];
}

export function toInsightsArticleView(sources: InsightsArticleSources): InsightsArticleView {
  const copy = parseInsightsCopy(sources.copySetting);
  const { post, readiness } = sources;
  const alt = altTextByUrl(sources.media);
  const publishedAt = publishedDate(post);
  const updatedAt = post.updatedAt > publishedAt ? post.updatedAt : publishedAt;

  return parseAs(`Post "${post.slug}"`, insightsArticleViewSchema, {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    answerBlock: post.answerBlock,
    seo: articleSeo(post, post.excerpt),
    category: categoryRef(post),
    author: authorView(post),
    publishedAt: publishedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    readingTime: post.readingTime && post.readingTime > 0 ? post.readingTime : readingMinutes(readiness.wordCount),
    wordCount: readiness.wordCount,
    cover: coverImage(post.coverImage, alt),
    takeaways: readiness.takeaways,
    body: readiness.body,
    services: serviceLinks(readiness.body, sources.services),
    caseStudy: sources.project ? caseStudyCard(sources.project, alt) : null,
    relatedArticles: relatedArticles(post, sources.others, alt),
    copy: copy.article,
  });
}
