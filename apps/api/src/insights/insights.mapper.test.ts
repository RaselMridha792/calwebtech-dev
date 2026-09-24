import { INSIGHTS_TOC_MIN_WORDS, articleToc, insightsCopySchema, type InsightsCopyInput } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import {
  InsightsContractError,
  articleReadiness,
  authorView,
  clamp,
  toInsightsArticleView,
  toInsightsIndexView,
  type InsightsPostRecord,
  type InsightsProjectRecord,
} from './insights.mapper';

const COPY: InsightsCopyInput = {
  index: {
    seo: { title: 'Insights', description: 'Articles for people buying a website.' },
    title: 'Insights',
    featuredLabel: 'Featured',
    listHeading: 'What have we written lately?',
    topicsLabel: 'Topics',
    allTopicsLabel: 'All topics',
    readingTimeLabel: 'min read',
    cardLinkLabel: 'Read the article',
    empty: 'No articles are published yet.',
    pagination: { label: 'Pages', previous: 'Previous', next: 'Next', status: 'Page {page} of {pages}' },
  },
  article: {
    byLabel: 'By',
    publishedLabel: 'Published',
    updatedLabel: 'Updated',
    readingTimeLabel: 'min read',
    tocLabel: 'On this page',
    takeawaysLabel: 'Key takeaways',
    authorLabel: 'About the author',
    serviceCta: {
      eyebrow: 'Related service',
      body: 'This is the service behind the article.',
      linkLabel: 'See the service',
      contactCta: { label: 'Tell us what you need', href: '/contact/' },
    },
    servicesHeading: 'Which services put this into practice?',
    caseStudyLinkLabel: 'Read the case study',
    relatedHeading: 'What should you read next?',
    relatedLink: { label: 'All insights', href: '/insights/' },
    newsletter: {
      heading: 'Want the next one by email?',
      body: 'One article a month.',
      emailLabel: 'Work email',
      submitLabel: 'Subscribe',
      privacyNote: 'Your details stay in our own database.',
      success: { heading: 'You are on the list.', body: 'The next article comes by email.' },
      unavailable: 'We could not send that just now.',
    },
  },
  categoryFallback: {
    seoTitle: '{topic} articles',
    seoDescription: 'Articles about {topic} for people buying a website.',
    title: '{topic}',
    listHeading: 'Which articles cover this topic?',
  },
  categories: {},
};

const ANSWER =
  'A website redesign rebuilds an existing site around what the business needs now. It usually takes six to fourteen weeks, depending on integrations.';

const BODY = [
  '## Key takeaways',
  '',
  '- Budget for the content, not only the build.',
  '- Integrations move the number more than page count does.',
  '',
  '## What does a redesign cost?',
  '',
  'Most projects land in two bands, set out on the [website redesign](/services/website-redesign/) page,',
  'and [Northmark Supply](/work/northmark-supply/) sat at the top of the first one. We also covered this',
  'in [Next.js development](/services/nextjs-development/) and in [care plans](/services/care-plans/) and',
  'in [AI search visibility](/services/ai-search-visibility/).',
  '',
  '### What moves the number?',
  '',
  'Integrations, mostly.',
].join('\n');

function post(overrides: Partial<InsightsPostRecord> = {}): InsightsPostRecord {
  return {
    id: 'post-1',
    title: 'What a website redesign should actually cost in 2026',
    slug: 'website-redesign-cost-2026',
    excerpt: 'A line-by-line breakdown of where the money goes.',
    answerBlock: ANSWER,
    coverImage: 'https://images.unsplash.com/photo-1',
    body: BODY,
    readingTime: null,
    featured: false,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-09-01T09:00:00.000Z'),
    seo: null,
    createdAt: new Date('2026-08-20T09:00:00.000Z'),
    updatedAt: new Date('2026-09-01T09:00:00.000Z'),
    authorId: 'team-1',
    categoryId: 'category-1',
    category: { slug: 'strategy', name: 'Strategy' },
    author: {
      slug: 'sawkat-hasan',
      name: 'Sawkat Hasan',
      role: 'Founder',
      bio: 'Joins every first call and every proposal.',
      photo: 'https://images.unsplash.com/photo-team',
      skills: ['Founder, Calwebtech', 'Twelve years in B2B commerce'],
    },
    ...overrides,
  };
}

const MEDIA = [
  { url: 'https://images.unsplash.com/photo-1', altText: 'A notebook and a laptop on a desk' },
];

const project = (overrides: Partial<InsightsProjectRecord> = {}): InsightsProjectRecord =>
  ({
    slug: 'northmark-supply',
    clientName: 'Northmark Supply',
    clientAlias: null,
    summary: 'A catalogue of 40,000 parts behind a contact form.',
    location: 'Ohio, USA',
    segment: 'B2B, Distribution',
    coverImageUrl: 'https://images.unsplash.com/photo-work',
    coverImageAlt: 'Two colleagues reviewing printed figures',
    outcomeMetrics: [
      { value: '+312%', label: 'Quote requests' },
      { value: '12 min', label: 'Quote turnaround, from 3 days' },
      { value: '−41%', label: 'Support calls' },
    ],
    status: 'PUBLISHED',
    industry: { name: 'Distribution', status: 'PUBLISHED' },
    technologies: [{ name: 'Next.js' }],
    ...overrides,
  }) as InsightsProjectRecord;

const SERVICES = [
  { slug: 'website-redesign', title: 'Website redesign', shortDescription: 'Rebuild a site that stopped working.' },
  { slug: 'nextjs-development', title: 'Next.js development', shortDescription: 'Fast, maintainable sites on Next.js.' },
  { slug: 'care-plans', title: 'Website care plans', shortDescription: 'Patching, backups and monitoring.' },
  { slug: 'ai-search-visibility', title: 'AI search visibility', shortDescription: 'Technical SEO and citations.' },
];

const indexView = (sources: Partial<Parameters<typeof toInsightsIndexView>[0]> = {}) =>
  toInsightsIndexView({
    copySetting: COPY,
    categories: [{ slug: 'strategy', name: 'Strategy' }],
    posts: [post()],
    media: MEDIA,
    ...sources,
  });

const articleView = (sources: Partial<Parameters<typeof toInsightsArticleView>[0]> = {}) => {
  const record = sources.post ?? post();
  const readiness = articleReadiness(record);
  if (!readiness.ready) throw new Error(readiness.reason);
  return toInsightsArticleView({
    copySetting: COPY,
    post: record,
    readiness,
    services: SERVICES,
    project: project(),
    others: [],
    media: MEDIA,
    ...sources,
  });
};

describe('the insights copy setting', () => {
  it('names the setting when it is missing or malformed', () => {
    expect(() => indexView({ copySetting: null })).toThrow(InsightsContractError);
    expect(() => indexView({ copySetting: null })).toThrow(/insights.copy/);
  });

  it('gives a topic nobody has written copy for a complete page', () => {
    const view = indexView({ categories: [{ slug: 'ai-search', name: 'AI search' }], posts: [] });
    expect(view.categories[0]?.copy.seo.title).toBe('AI search articles');
    expect(view.categories[0]?.articleCount).toBe(0);
  });
});

describe('the insights index', () => {
  it('renders with nothing published: no articles, no featured article, topics at zero', () => {
    const view = indexView({ posts: [] });
    expect(view.articles).toEqual([]);
    expect(view.featuredSlug).toBeNull();
    expect(view.categories.map((category) => category.articleCount)).toEqual([0]);
  });

  it('counts articles per topic and features the featured one, not just the newest', () => {
    const older = post({
      id: 'post-2',
      slug: 'why-your-b2b-website-is-not-generating-leads',
      featured: true,
      publishedAt: new Date('2026-06-01T09:00:00.000Z'),
    });
    const view = indexView({ posts: [post(), older] });
    expect(view.articles.map((article) => article.slug)).toEqual([
      'website-redesign-cost-2026',
      'why-your-b2b-website-is-not-generating-leads',
    ]);
    expect(view.featuredSlug).toBe('why-your-b2b-website-is-not-generating-leads');
    expect(view.categories[0]?.articleCount).toBe(2);
  });

  it('leaves off an article whose body breaks the heading rules, and says why', () => {
    const skipped: string[] = [];
    const view = indexView({
      posts: [post({ slug: 'broken-article', body: '## Costs\n\nA section heading that is not a question.' })],
      onSkipped: (slug, reason) => skipped.push(`${slug}: ${reason}`),
    });
    expect(view.articles).toEqual([]);
    expect(skipped[0]).toMatch(/broken-article: has a body to fix/);
  });

  it('leaves off an article that would take a topic page’s URL', () => {
    const skipped: string[] = [];
    const view = indexView({
      posts: [post({ slug: 'strategy' })],
      onSkipped: (slug, reason) => skipped.push(`${slug}: ${reason}`),
    });
    expect(view.articles).toEqual([]);
    expect(skipped[0]).toMatch(/same slug as a topic page/);
  });

  it('shows a cover image only when the media library has alt text for it', () => {
    expect(indexView().articles[0]?.image).toEqual({
      src: 'https://images.unsplash.com/photo-1',
      alt: 'A notebook and a laptop on a desk',
    });
    expect(indexView({ media: [] }).articles[0]?.image).toBeNull();
  });
});

describe('an article page', () => {
  it('lifts the key takeaways out of the body and counts what is left', () => {
    const view = articleView();
    expect(view.takeaways).toEqual([
      'Budget for the content, not only the build.',
      'Integrations move the number more than page count does.',
    ]);
    expect(view.body.startsWith('## What does a redesign cost?')).toBe(true);
    expect(view.wordCount).toBeGreaterThan(0);
    expect(view.readingTime).toBe(1);
  });

  it('keeps the reading time an editor set on the record', () => {
    expect(articleView({ post: post({ readingTime: 7 }) }).readingTime).toBe(7);
  });

  it('shows a table of contents only past the length that needs one', () => {
    const view = articleView();
    expect(articleToc(view)).toEqual([]);
    expect(articleToc({ body: view.body, wordCount: INSIGHTS_TOC_MIN_WORDS + 1 }).map((item) => item.id)).toEqual([
      'what-does-a-redesign-cost',
      'what-moves-the-number',
    ]);
  });

  it('links the services the body links to, in that order, and at most three', () => {
    expect(articleView().services.map((service) => service.slug)).toEqual([
      'website-redesign',
      'nextjs-development',
      'care-plans',
    ]);
  });

  it('leaves out a service that is not published, and takes the next one the article links to', () => {
    const view = articleView({ services: SERVICES.filter((service) => service.slug !== 'website-redesign') });
    expect(view.services.map((service) => service.slug)).toEqual([
      'nextjs-development',
      'care-plans',
      'ai-search-visibility',
    ]);
  });

  it('shows the case study card with its tags and figures, and none when it is unpublished', () => {
    expect(articleView().caseStudy).toMatchObject({
      slug: 'northmark-supply',
      clientName: 'Northmark Supply',
      tags: ['Ohio, USA', 'B2B', 'Distribution', 'Next.js'],
    });
    expect(articleView().caseStudy?.metrics).toHaveLength(3);
    expect(articleView({ project: null }).caseStudy).toBeNull();
  });

  it('leaves out a case study with no outcome figures', () => {
    expect(articleView({ project: project({ outcomeMetrics: [] }) }).caseStudy).toBeNull();
  });

  it('relates the same topic first, never itself, and at most three', () => {
    const others = [
      post({ id: 'a', slug: 'other-topic-one', category: { slug: 'engineering', name: 'Engineering' } }),
      post({ id: 'b', slug: 'same-topic-one' }),
      post({ id: 'c', slug: 'other-topic-two', category: { slug: 'engineering', name: 'Engineering' } }),
      post({ id: 'd', slug: 'other-topic-three', category: { slug: 'engineering', name: 'Engineering' } }),
    ];
    const view = articleView({ others });
    expect(view.relatedArticles.map((article) => article.slug)).toEqual([
      'same-topic-one',
      'other-topic-one',
      'other-topic-two',
    ]);
    expect(view.relatedArticles.map((article) => article.slug)).not.toContain(view.slug);
  });

  it('builds the author block from the team member, with alt text on the photograph', () => {
    const view = articleView();
    expect(view.author).toEqual({
      slug: 'sawkat-hasan',
      name: 'Sawkat Hasan',
      role: 'Founder',
      bio: 'Joins every first call and every proposal.',
      photo: { src: 'https://images.unsplash.com/photo-team', alt: 'Sawkat Hasan, Founder' },
      credentials: ['Founder, Calwebtech', 'Twelve years in B2B commerce'],
    });
    expect(authorView(post({ author: null }))).toBeNull();
  });

  it('ignores credentials that are not a list of lines', () => {
    expect(articleView({ post: post({ author: { ...post().author, skills: { a: 1 } } as never }) }).author?.credentials).toEqual(
      [],
    );
  });

  it('falls back to the title and excerpt for metadata, within the length limits', () => {
    const view = articleView();
    expect(view.seo.title).toBe('What a website redesign should actually cost in 2026');
    expect(view.seo.description).toBe('A line-by-line breakdown of where the money goes.');
    expect(clamp('Word '.repeat(20), 24)).toBe('Word Word Word Word Word');
  });

  it('uses the record’s own metadata when an editor has written it', () => {
    const view = articleView({
      post: post({ seo: { title: 'Website redesign cost in 2026', description: 'What a redesign costs.' } }),
    });
    expect(view.seo).toEqual({
      title: 'Website redesign cost in 2026',
      description: 'What a redesign costs.',
      ogImage: null,
    });
  });

  it('dates the article by its publish date, and updates it only when it changed later', () => {
    expect(articleView().updatedAt).toBe('2026-09-01T09:00:00.000Z');
    const edited = articleView({ post: post({ updatedAt: new Date('2026-09-10T09:00:00.000Z') }) });
    expect(edited.updatedAt).toBe('2026-09-10T09:00:00.000Z');
    expect(edited.publishedAt).toBe('2026-09-01T09:00:00.000Z');
  });

  it('refuses an answer block that is not two or three sentences', () => {
    expect(articleReadiness(post({ answerBlock: 'Too short.' }))).toEqual({
      ready: false,
      reason: 'needs an answer block of two or three complete sentences',
    });
  });

  it('carries the copy the page renders, including the subscribe block', () => {
    expect(articleView().copy.newsletter.heading).toBe(insightsCopySchema.parse(COPY).article.newsletter.heading);
  });
});
