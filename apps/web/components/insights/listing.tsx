import {
  INSIGHTS_ROUTE,
  insightsArticlePath,
  insightsCategoryPath,
  insightsListPath,
  paginate,
  type InsightsArticleCard,
  type InsightsCategoryView,
  type InsightsIndexCopy,
  type InsightsIndexView,
  type Paginated,
} from '@calwebtech/shared';
import { CardGrid, LinkCard } from '../site/cards';
import { EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

/**
 * `/insights/` and `/insights/<topic>/`: the topic filter written into the URL as a page of
 * its own, the featured article, the cards, and pagination past twelve. Every link is a
 * plain anchor, so the listing needs no client JavaScript.
 */

/**
 * What one page of `/insights/` or `/insights/<topic>/` holds, or null when the page is past
 * the end. The featured article is off the list on every page, not only the first, so the
 * pages hold the same articles whichever one a visitor lands on; it is rendered above the
 * list on page one alone.
 */
export function insightsResults(
  view: InsightsIndexView,
  topic: string | null,
  page: number,
): { results: Paginated<InsightsArticleCard>; featured: InsightsArticleCard | null } | null {
  const featured = topic === null ? (view.articles.find((card) => card.slug === view.featuredSlug) ?? null) : null;
  const results = paginate(
    view.articles.filter(
      (card) => card.slug !== featured?.slug && (topic === null || card.category?.slug === topic),
    ),
    page,
  );
  return results ? { results, featured: page === 1 ? featured : null } : null;
}

/** "Strategy · 7 min read · Sawkat Hasan" under a card's title. */
function cardMeta(article: InsightsArticleCard, readingTimeLabel: string): string {
  return [article.category?.name, `${String(article.readingTime)} ${readingTimeLabel}`, article.authorName]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

/**
 * A topic as a tab on a rule: the current one ink with a champagne rule drawn under it, the
 * others muted until the pointer draws theirs. The article count follows in `meta`.
 */
const pillClass = (current: boolean) =>
  `group relative -mb-px inline-flex items-center gap-2 py-3.5 text-[15px] font-semibold transition-colors duration-150 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:bg-gold-ink after:transition-transform after:duration-420 after:ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus motion-reduce:after:transition-none ${
    current ? 'text-ink after:scale-x-100' : 'text-ink-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100'
  }`;

/** The topics that have articles, each its own indexable page. */
export function TopicFilter({ view, current }: { view: InsightsIndexView; current: string | null }) {
  const topics = view.categories.filter((category) => category.articleCount > 0 || category.slug === current);
  if (topics.length === 0) return null;
  return (
    <nav aria-label={view.copy.topicsLabel} className="mt-10">
      <ul className="flex flex-wrap gap-x-8 border-b border-hairline">
        <li>
          <a href={INSIGHTS_ROUTE} className={pillClass(current === null)} {...(current === null ? { 'aria-current': 'page' as const } : {})}>
            {view.copy.allTopicsLabel}
          </a>
        </li>
        {topics.map((topic) => (
          <li key={topic.slug}>
            <a
              href={insightsCategoryPath(topic.slug)}
              className={pillClass(current === topic.slug)}
              {...(current === topic.slug ? { 'aria-current': 'page' as const } : {})}
            >
              {topic.name}
              {/* A space for the accessible name; flex layout ignores it. */}{' '}
              <span className="meta text-ink-muted">{`(${String(topic.articleCount)})`}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The article to read first, above the list, on the first page of the unfiltered index. */
export function FeaturedArticle({ article, copy }: { article: InsightsArticleCard; copy: InsightsIndexCopy }) {
  return (
    <article className="lift relative mt-10 grid overflow-hidden border border-hairline bg-canvas-raised lg:grid-cols-2" {...reveal()}>
      {article.image ? (
        <div className="relative aspect-video bg-canvas-sunken lg:h-full">
          {/* Not preloaded: the hero backdrop above it is the listing's LCP element (docs/09). */}
          <ResponsiveImage
            src={article.image.src}
            alt={article.image.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-col justify-center p-7 lg:p-10">
        <p className="text-[13px] font-semibold text-gold-ink">{copy.featuredLabel}</p>
        <h3 className="mt-3 font-display text-[24px] leading-snug font-extrabold text-ink lg:text-[30px]">
          <a href={insightsArticlePath(article.slug)} className="after:absolute after:inset-0 hover:text-gold-ink">
            {article.title}
          </a>
        </h3>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed">{article.excerpt}</p>
        <p className="mt-5 text-[13.5px]">{cardMeta(article, copy.readingTimeLabel)}</p>
      </div>
    </article>
  );
}

/** Pages of a listing, each addressable: `/insights/?page=2`, `/insights/strategy/?page=2`. */
export function Pagination({
  copy,
  topic,
  page,
  pageCount,
}: {
  copy: InsightsIndexCopy;
  topic: string | null;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const status = copy.pagination.status
    .replaceAll('{page}', String(page))
    .replaceAll('{pages}', String(pageCount));
  const linkClass = 'inline-flex h-10 min-w-10 items-center justify-center  border border-hairline px-3 text-[14.5px] hover:border-ink hover:text-ink';

  return (
    <nav aria-label={copy.pagination.label} className="mt-12 flex flex-wrap items-center justify-between gap-5">
      <p className="text-[14.5px]">{status}</p>
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <a href={insightsListPath(topic, page - 1)} className={linkClass} rel="prev">
              {copy.pagination.previous}
            </a>
          </li>
        ) : null}
        {pages.map((number) => (
          <li key={number}>
            <a
              href={insightsListPath(topic, number)}
              className={
                number === page ? `${linkClass} border-gold-ink bg-navy-500/5 font-semibold text-ink` : linkClass
              }
              {...(number === page ? { 'aria-current': 'page' as const } : {})}
            >
              {number}
            </a>
          </li>
        ))}
        {page < pageCount ? (
          <li>
            <a href={insightsListPath(topic, page + 1)} className={linkClass} rel="next">
              {copy.pagination.next}
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/** The listing shared by the index and every topic page. */
export function InsightsListing({
  view,
  topic,
  heading,
  results,
  featured,
}: {
  view: InsightsIndexView;
  /** The topic page this is, or null for the index. */
  topic: InsightsCategoryView | null;
  heading: string;
  results: Paginated<InsightsArticleCard>;
  /** Shown above the list on the first page of the unfiltered index. */
  featured: InsightsArticleCard | null;
}) {
  const { copy } = view;
  return (
    <Section id="insights-list" labelledBy="insights-list-heading" deferred={false}>
      <SectionHeading id="insights-list-heading" title={heading} className="mb-0" />
      <TopicFilter view={view} current={topic?.slug ?? null} />
      {featured ? <FeaturedArticle article={featured} copy={copy} /> : null}
      {results.items.length > 0 ? (
        <CardGrid columns={3} className="mt-10">
          {results.items.map((article, index) => (
            <LinkCard
              key={article.slug}
              href={insightsArticlePath(article.slug)}
              title={article.title}
              body={article.excerpt}
              eyebrow={cardMeta(article, copy.readingTimeLabel)}
              image={article.image}
              linkLabel={copy.cardLinkLabel}
              step={index}
            />
          ))}
        </CardGrid>
      ) : (
        <EmptyState className="mt-10" action={copy.emptyAction}>
          {copy.empty}
        </EmptyState>
      )}
      <Pagination copy={copy} topic={topic?.slug ?? null} page={results.page} pageCount={results.pageCount} />
    </Section>
  );
}
