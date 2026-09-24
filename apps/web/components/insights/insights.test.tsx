import {
  INSIGHTS_ROUTE,
  articleToc,
  insightsArticlePath,
  insightsArticleViewSchema,
  insightsCategoryPath,
  insightsIndexViewSchema,
  paginate,
  type InsightsArticleView,
} from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { insightsArticleSnapshots, insightsIndexSnapshot } from '@/static-content/insights';
import { PageHero } from '../site/page-hero';
import { ArticleBodySection } from './article-page';
import { ArticleMeta, ArticleServicesSection, RelatedArticlesSection, ServiceCallToAction } from './article-sections';
import { articleJsonLd } from './json-ld';
import { InsightsListing, insightsResults } from './listing';
import { Blocks, articleBodyContext, articleTokens, safeHref, splitAtShare } from './markdown';
import { listingDocumentTitle, listingPageSeo } from './page-seo';
import { SubscribeForm } from './subscribe-form';

// The subscribe block's server action reaches the API, which cannot be imported outside a
// request. Only the action is stubbed, so the form below is the one the article renders.
vi.mock('../subscribe/actions', () => ({ subscribeToNewsletter: () => Promise.resolve({ status: 'idle' as const }) }));

const render = (node: ReactNode) => renderToStaticMarkup(node);
const index = insightsIndexViewSchema.parse(insightsIndexSnapshot);
const articles = Object.entries(insightsArticleSnapshots).map(
  ([slug, snapshot]): [string, InsightsArticleView] => [slug, insightsArticleViewSchema.parse(snapshot)],
);
const [, firstArticle] = articles[0] ?? [];

const levels = (html: string) => [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

/** One h1 first, and no heading more than one level below the one before it. */
function expectHeadingOrder(html: string): void {
  const found = levels(html);
  expect(found.filter((level) => level === 1)).toHaveLength(1);
  expect(found[0]).toBe(1);
  found.forEach((level, position) => {
    if (position > 0) expect(level, found.join(',')).toBeLessThanOrEqual((found[position - 1] ?? 1) + 1);
  });
}

/** Stands in for the only client component on the page, the way the route passes it in. */
const subscribeFormStub = <form data-testid="subscribe-form" />;

/** The article page as the route composes it, without the layout's chrome. */
function articleMarkup(view: InsightsArticleView, subscribeForm: ReactNode = subscribeFormStub): string {
  const path = insightsArticlePath(view.slug);
  return render(
    <>
      <PageHero
        ground="light"
        crumbs={[
          { name: 'Insights', path: INSIGHTS_ROUTE },
          ...(view.category ? [{ name: view.category.name, path: insightsCategoryPath(view.category.slug) }] : []),
          { name: view.title, path },
        ]}
        eyebrow={view.category?.name}
        title={view.title}
        answer={view.answerBlock}
        intro={view.excerpt}
      >
        <ArticleMeta view={view} />
      </PageHero>
      <ArticleBodySection view={view} subscribeForm={subscribeForm} />
      <ArticleServicesSection view={view} />
      <RelatedArticlesSection view={view} />
    </>,
  );
}

describe('the article template rendered from its snapshot', () => {
  it('opens with the answer block under the only h1, before any link in the body', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const html = articleMarkup(firstArticle);
    expectHeadingOrder(html);
    const h1 = html.indexOf('<h1');
    const answer = html.indexOf('data-answer-block');
    expect(answer, 'the answer block follows the h1').toBeGreaterThan(h1);
    expect(html.slice(h1, answer), 'no call to action between the h1 and the answer').not.toContain('<a ');
  });

  it('renders every article body on the server, with headings, anchors and tables', () => {
    for (const [slug, view] of articles) {
      const html = articleMarkup(view);
      expectHeadingOrder(html);
      for (const heading of articleToc(view)) {
        expect(html, `${slug} anchors ${heading.id}`).toContain(`id="${heading.id}"`);
        expect(html, `${slug} links to ${heading.id}`).toContain(`href="#${heading.id}"`);
      }
      // A scrollable table is a labelled region, so a keyboard user can reach and name it.
      if (view.body.includes('\n|')) expect(html, `${slug} table`).toContain('role="region"');
    }
  });

  it('renders plain anchors and no markup out of a body', () => {
    const sourced: string[] = [];
    for (const [slug, view] of articles) {
      const tokens = articleTokens(view.body);
      const body = render(<Blocks tokens={tokens} ctx={articleBodyContext(tokens)} />);
      // A body is Markdown, so nothing in it can become markup on the page.
      expect(body, `${slug} runs no script from a body`).not.toContain('<script');
      expect(body, `${slug} renders no iframe from a body`).not.toContain('<iframe');
      expect(body, `${slug} links a service from the body`).toContain('href="/services/');
      // ResponsiveImage markup, never the next/image client component.
      expect(articleMarkup(view), `${slug} images are server markup`).toContain('<img ');
      // Any published figure is linked to its public source (docs/10-site-pages.md, Content).
      if (body.includes('href="https://')) sourced.push(slug);
    }
    expect(sourced.length, 'articles that cite a public source').toBeGreaterThanOrEqual(articles.length - 2);
  });

  it('carries one BreadcrumbList, from Insights through the topic to the article', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const nodes = [...articleMarkup(firstArticle).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
      (match) => JSON.parse(match[1] ?? '{}') as { '@type'?: string; itemListElement?: { name: string }[] },
    );
    const crumbs = nodes.filter((node) => node['@type'] === 'BreadcrumbList');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]?.itemListElement?.map((item) => item.name)).toEqual([
      'Home',
      'Insights',
      firstArticle.category?.name,
      firstArticle.title,
    ]);
  });

  it('shows the author block with the photograph, role and credentials', () => {
    for (const [slug, view] of articles) {
      const html = articleMarkup(view);
      expect(view.author, slug).not.toBeNull();
      expect(html, slug).toContain(view.author?.name);
      expect(html, slug).toContain(view.author?.role);
      for (const credential of view.author?.credentials ?? []) expect(html, slug).toContain(credential);
    }
  });

  it('shows the publish date, the update date only when it changed, and the reading time', () => {
    for (const [slug, view] of articles) {
      const html = render(<ArticleMeta view={view} />);
      expect(html.toLowerCase(), slug).toContain(`datetime="${view.publishedAt.toLowerCase()}"`);
      expect(html, slug).toContain(`${String(view.readingTime)} ${view.copy.readingTimeLabel}`);
      const changed = view.updatedAt.slice(0, 10) > view.publishedAt.slice(0, 10);
      expect(html.includes(view.copy.updatedLabel), `${slug} updated line`).toBe(changed);
    }
  });

  it('offers the contextual service the article links to first, then the related strip', () => {
    for (const [slug, view] of articles) {
      const first = view.services[0];
      expect(first, slug).toBeDefined();
      const cta = render(<ServiceCallToAction view={view} />);
      expect(cta, slug).toContain(`href="/services/${first?.slug ?? ''}/"`);
      expect(cta, slug).toContain(view.copy.serviceCta.contactCta.href);

      const strip = render(<ArticleServicesSection view={view} />);
      for (const service of view.services) expect(strip, slug).toContain(`href="/services/${service.slug}/"`);
      if (view.caseStudy) expect(strip, slug).toContain(`/work/${view.caseStudy.slug}/`);
    }
  });

  it('links three related articles and never the article itself', () => {
    for (const [slug, view] of articles) {
      const html = render(<RelatedArticlesSection view={view} />);
      expect(html, slug).not.toContain(`href="${insightsArticlePath(slug)}"`);
      for (const related of view.relatedArticles) expect(html, slug).toContain(`href="${insightsArticlePath(related.slug)}"`);
    }
  });

  it('builds Article structured data with the author as a Person and the word count', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const data = articleJsonLd({ view: firstArticle, path: insightsArticlePath(firstArticle.slug) }) as Record<
      string,
      unknown
    >;
    expect(data['@type']).toBe('Article');
    expect(data.headline).toBe(firstArticle.title);
    expect(data.datePublished).toBe(firstArticle.publishedAt);
    expect(data.dateModified).toBe(firstArticle.updatedAt);
    expect(data.wordCount).toBe(firstArticle.wordCount);
    expect((data.author as { '@type'?: string })['@type']).toBe('Person');
    expect((data.author as { name?: string }).name).toBe(firstArticle.author?.name);
  });
});

describe('the Markdown renderer', () => {
  it('keeps only safe link targets', () => {
    expect(safeHref('/services/care-plans/')).toBe('/services/care-plans/');
    expect(safeHref('#what-does-it-cost')).toBe('#what-does-it-cost');
    expect(safeHref('https://web.dev/articles/vitals')).toBe('https://web.dev/articles/vitals');
    expect(safeHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('//evil.example.com')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });

  it('drops HTML in a body rather than rendering it', () => {
    const tokens = articleTokens('## Is this safe?\n\nBefore.\n\n<img src=x onerror=alert(1)>\n\nAfter.\n');
    const html = render(<Blocks tokens={tokens} ctx={articleBodyContext(tokens)} />);
    expect(html).toContain('Before.');
    expect(html).toContain('After.');
    expect(html).not.toContain('onerror');
  });

  it('splits the body at a heading near the subscribe block, keeping every token once', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const tokens = articleTokens(firstArticle.body);
    const [opening, rest] = splitAtShare(tokens, 0.6);
    expect(opening.length + rest.length).toBe(tokens.length);
    expect(opening.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest[0]?.type, 'the block sits before a heading').toBe('heading');
  });

  it('numbers repeated headings once across both halves of the body', () => {
    const tokens = articleTokens('## What now?\n\nOne.\n\n## What now?\n\nTwo.\n');
    const context = articleBodyContext(tokens);
    expect([...context.headingIds.values()]).toEqual(['what-now', 'what-now-2']);
  });
});

describe('the article body section, as the route composes it', () => {
  it('puts the subscribe block inside the body, between the two halves', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const html = render(<ArticleBodySection view={firstArticle} subscribeForm={subscribeFormStub} />);
    const toc = articleToc(firstArticle);
    const first = toc[0];
    const last = toc.at(-1);
    if (!first || !last) throw new Error('No heading on either side of the block');

    const block = html.indexOf('id="article-subscribe-label"');
    expect(block, 'the block is rendered').toBeGreaterThan(-1);
    expect(html.indexOf(`id="${first.id}"`), 'the first half is above it').toBeLessThan(block);
    expect(html.indexOf(`id="${last.id}"`), 'the second half is below it').toBeGreaterThan(block);
    // The form the route passes in is the block's content, not a second form beside it.
    expect(html.slice(block)).toContain('data-testid="subscribe-form"');
  });

  it('carries the takeaways, the contents, the service call to action and the author', () => {
    if (!firstArticle) throw new Error('No article snapshots');
    const html = render(<ArticleBodySection view={firstArticle} subscribeForm={subscribeFormStub} />);
    const { copy } = firstArticle;
    expect(html).toContain(copy.takeawaysLabel);
    expect(html).toContain(copy.tocLabel);
    expect(html).toContain('id="article-service-label"');
    expect(html).toContain(copy.authorLabel);
    // The body is rendered once, not once per half.
    expect(html.split('id="article-subscribe-label"')).toHaveLength(2);
  });
});

describe('the subscribe form', () => {
  const copy = firstArticle?.copy.newsletter;

  const markup = () => {
    if (!copy) throw new Error('No article snapshots');
    return render(<SubscribeForm copy={copy} sourcePage="/insights/an-article/" turnstileSiteKey={undefined} />);
  };

  it('asks for a labelled email address and nothing else, and names the article it sits on', () => {
    const html = markup();
    if (!copy) throw new Error('No article snapshots');
    expect(html).toContain('for="insights-subscribe-email"');
    expect(html).toContain('id="insights-subscribe-email"');
    expect(html).toContain(copy.emailLabel);
    // One address, as on the homepage (docs/08-decisions.md, 53): no name, no attribution.
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('name="attribution"');
    expect(html).toContain('name="sourcePage"');
    expect(html).toContain('value="/insights/an-article/"');
    expect(html).toContain(copy.submitLabel);
    expect(html).toContain(copy.privacyNote);
  });

  it('hides the honeypot from people without hiding it from a bot', () => {
    const html = markup();
    const honeypot = html.indexOf('name="referenceCode"');
    expect(honeypot, 'the honeypot is rendered').toBeGreaterThan(-1);
    const wrapper = html.lastIndexOf('<div', honeypot);
    expect(html.slice(wrapper, honeypot)).toContain('aria-hidden="true"');
    expect(html.slice(wrapper, honeypot)).toContain('left-[-10000px]');
    expect(html).toContain('tabindex="-1"');
    // Hidden, but still labelled, so it is a field a bot fills and a person never sees.
    expect(html).toContain('for="insights-subscribe-reference"');
  });
});

describe('the listing', () => {
  it('shows the featured article, the topic filter and every card, with no pagination on one page', () => {
    const listing = insightsResults(index, null, 1);
    if (!listing) throw new Error('No first page');
    const { results, featured } = listing;
    expect(featured?.slug).toBe(index.featuredSlug);
    const html = render(
      <InsightsListing view={index} topic={null} heading={index.copy.listHeading} results={results} featured={featured} />,
    );

    expect(html).toContain(index.copy.featuredLabel);
    expect(html).toContain(`href="${insightsArticlePath(featured?.slug ?? '')}"`);
    for (const card of results.items) expect(html, card.slug).toContain(`href="${insightsArticlePath(card.slug)}"`);
    for (const topic of index.categories) expect(html, topic.slug).toContain(`href="${insightsCategoryPath(topic.slug)}"`);
    expect(html, 'one page needs no pagination').not.toContain(index.copy.pagination.previous);
    expect(html, 'no empty state while articles are published').not.toContain(index.copy.empty);
  });

  it('marks the current topic and shows the empty state when a topic has nothing in it', () => {
    const topic = index.categories[0];
    if (!topic) throw new Error('No topics');
    const html = render(
      <InsightsListing
        view={index}
        topic={{ ...topic, articleCount: 0 }}
        heading={topic.copy.listHeading}
        results={{ items: [], page: 1, pageCount: 1 }}
        featured={null}
      />,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(index.copy.empty);
    expect(html).toContain(index.copy.emptyAction?.href ?? '/contact/');
  });

  it('keeps the same articles on every page, and shows the featured one on page one alone', () => {
    const many = {
      ...index,
      articles: Array.from({ length: 30 }, (_, position) => ({
        ...(index.articles[position % index.articles.length] ?? index.articles[0]),
        slug: `article-${String(position)}`,
        featured: position === 5,
      })),
      featuredSlug: 'article-5',
    } as typeof index;

    const pages = [1, 2, 3].map((page) => insightsResults(many, null, page));
    expect(pages.every((listing) => listing !== null)).toBe(true);
    expect(insightsResults(many, null, 4), 'a page past the end is a 404').toBeNull();
    // Every page counts the same total, and the featured article is on none of them.
    expect(pages.map((listing) => listing?.results.pageCount)).toEqual([3, 3, 3]);
    expect(pages.map((listing) => listing?.featured?.slug ?? null)).toEqual(['article-5', null, null]);
    const shown = pages.flatMap((listing) => listing?.results.items.map((card) => card.slug) ?? []);
    expect(new Set(shown).size, 'no article appears twice').toBe(shown.length);
    expect(shown).not.toContain('article-5');
    expect(shown).toHaveLength(29);
  });

  it('filters a topic page to its own topic, with no featured article', () => {
    const topic = index.categories.find((category) => category.articleCount > 1);
    if (!topic) throw new Error('No topic with articles');
    const listing = insightsResults(index, topic.slug, 1);
    expect(listing?.featured).toBeNull();
    expect(listing?.results.items.map((card) => card.category?.slug)).toEqual(
      Array.from({ length: topic.articleCount }, () => topic.slug),
    );
  });

  it('paginates past twelve, with every page addressable and the current one marked', () => {
    const many = Array.from({ length: 27 }, (_, position) => ({
      ...(index.articles[position % index.articles.length] ?? index.articles[0]),
      slug: `article-${String(position)}`,
    })) as typeof index.articles;
    const page = paginate(many, 2);
    if (!page) throw new Error('No second page');
    expect(page.pageCount).toBe(3);

    const html = render(
      <InsightsListing view={index} topic={null} heading={index.copy.listHeading} results={page} featured={null} />,
    );
    expect(html).toContain('href="/insights/?page=3"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain('Page 2 of 3');
    // The first page of the unfiltered index is the bare path, never "?page=1".
    expect(html).toContain(`href="${INSIGHTS_ROUTE}"`);
    expect(html).not.toContain('?page=1');
  });

  it('gives page two of a listing its own title and description, inside the limits', () => {
    const first = listingPageSeo(index.copy.seo, 1);
    const second = listingPageSeo(index.copy.seo, 2);
    expect(first.title).toBe(index.copy.seo.title);
    expect(second.title).not.toBe(first.title);
    expect(second.title).toContain('page 2');
    expect(second.description).toContain('Page 2.');
    expect(second.description.length).toBeLessThanOrEqual(155);
    expect(listingDocumentTitle(index.copy.seo, 2).length).toBeLessThanOrEqual(60);
  });
});
