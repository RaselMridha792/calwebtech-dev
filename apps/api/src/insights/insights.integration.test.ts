import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  INSIGHTS_COPY_SETTING_KEY,
  insightsArticleViewSchema,
  insightsCopySchema,
  insightsIndexViewSchema,
  type InsightsCopyInput,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally, services
// in CI. The test writes its own rows under unique slugs and removes them afterwards, so it
// can run beside other tests on a shared database.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));
const db = prisma.client;
const run = randomUUID().slice(0, 8);
const slug = `integration-insights-${run}`;
const draftSlug = `integration-insights-draft-${run}`;
const brokenSlug = `integration-insights-broken-${run}`;
const topicSlug = `integration-topic-${run}`;
const authorSlug = `integration-author-${run}`;
const coverUrl = `https://images.example.com/integration-${run}.png`;
let createdCopy = false;

/** Used only when the database has no `insights.copy` setting yet; removed again afterwards. */
const COPY: InsightsCopyInput = {
  index: {
    seo: { title: 'Integration insights', description: 'Integration test description.' },
    title: 'Integration insights',
    featuredLabel: 'Start here',
    listHeading: 'Which integration articles are published?',
    topicsLabel: 'Topics',
    allTopicsLabel: 'All topics',
    readingTimeLabel: 'min read',
    cardLinkLabel: 'Read it',
    empty: 'Nothing yet.',
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
      body: 'Integration test body.',
      linkLabel: 'See the service',
      contactCta: { label: 'Contact', href: '/contact/' },
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
      privacyNote: 'Stored in our own database.',
      success: { heading: 'You are on the list.', body: 'The next article comes by email.' },
      unavailable: 'We could not send that just now.',
    },
  },
  categoryFallback: {
    seoTitle: '{topic} articles',
    seoDescription: 'Integration articles about {topic}.',
    title: '{topic}',
    listHeading: 'Which articles cover {topic}?',
  },
  categories: {},
};

const BODY = [
  '## Key takeaways',
  '',
  '- Integration takeaway one.',
  '- Integration takeaway two.',
  '',
  '## What does this integration test check?',
  '',
  'It checks the queries behind the insights pages against a real database.',
  '',
  '### Which pages does it cover?',
  '',
  'The index, a topic listing and one article page.',
  '',
  '## Where does the service link come from?',
  '',
  'From the body, which links [a service](/services/care-plans/) and a [case study](/work/no-such-project/).',
].join('\n');

const post = {
  title: 'Integration test article',
  excerpt: 'Integration test excerpt.',
  answerBlock:
    'This article exists only while an integration test runs. It checks the queries behind the insights pages. It is removed when the test ends.',
  body: BODY,
  coverImage: coverUrl,
  status: 'PUBLISHED' as const,
};

beforeAll(async () => {
  const existing = await db.setting.findUnique({ where: { key: INSIGHTS_COPY_SETTING_KEY } });
  if (!existing) {
    await db.setting.create({ data: { key: INSIGHTS_COPY_SETTING_KEY, value: insightsCopySchema.parse(COPY) } });
    createdCopy = true;
  }
  const [topic, author] = await Promise.all([
    db.postCategory.create({ data: { slug: topicSlug, name: 'Integration topic', order: 990 } }),
    db.teamMember.create({
      data: {
        slug: authorSlug,
        name: 'Integration test author',
        role: 'Integration role',
        bio: 'Integration test biography.',
        photo: 'https://images.example.com/integration-author.png',
        skills: ['Integration', 'Testing'],
      },
    }),
  ]);
  await db.mediaAsset.create({
    data: { url: coverUrl, altText: 'Integration test cover', mimeType: 'image/png' },
  });
  await db.post.create({
    data: { ...post, slug, publishedAt: new Date('2026-01-02T00:00:00.000Z'), categoryId: topic.id, authorId: author.id },
  });
  await db.post.create({ data: { ...post, slug: draftSlug, status: 'DRAFT', publishedAt: null } });
  // Published, but its headings are not questions, so it has no page and is left off the index.
  await db.post.create({
    data: {
      ...post,
      slug: brokenSlug,
      body: '## Our process\n\nA heading that is not a question.',
      publishedAt: new Date('2026-01-03T00:00:00.000Z'),
    },
  });
});

afterAll(async () => {
  await db.post.deleteMany({ where: { slug: { in: [slug, draftSlug, brokenSlug] } } });
  await db.postCategory.deleteMany({ where: { slug: topicSlug } });
  await db.teamMember.deleteMany({ where: { slug: authorSlug } });
  await db.mediaAsset.deleteMany({ where: { url: coverUrl } });
  if (createdCopy) await db.setting.deleteMany({ where: { key: INSIGHTS_COPY_SETTING_KEY } });
  await prisma.onModuleDestroy();
});

describe('insights pages against the database', () => {
  it('lists a published article on the index, with its topic counted, and never a draft', async () => {
    const view = insightsIndexViewSchema.parse(await new InsightsService(prisma).findIndex());
    const slugs = view.articles.map((card) => card.slug);
    expect(slugs).toContain(slug);
    expect(slugs).not.toContain(draftSlug);
    // A published article whose body breaks the heading rules has no page, so it is left off.
    expect(slugs).not.toContain(brokenSlug);

    const topic = view.categories.find((category) => category.slug === topicSlug);
    expect(topic?.articleCount).toBe(1);
    expect(topic?.copy.title).toBe('Integration topic');
    expect(topic?.copy.listHeading).toMatch(/\?$/);
  });

  it('builds the article page from the record and its body', async () => {
    const service = new InsightsService(prisma);
    const view = insightsArticleViewSchema.parse(await service.findArticle(slug));

    expect(view.takeaways).toEqual(['Integration takeaway one.', 'Integration takeaway two.']);
    expect(view.body, 'the key takeaways are lifted out of the body').not.toContain('Key takeaways');
    expect(view.wordCount).toBeGreaterThan(0);
    expect(view.readingTime).toBeGreaterThan(0);
    expect(view.publishedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(view.category?.slug).toBe(topicSlug);
    expect(view.cover).toEqual({ src: coverUrl, alt: 'Integration test cover' });

    expect(view.author?.name).toBe('Integration test author');
    expect(view.author?.credentials).toEqual(['Integration', 'Testing']);
    expect(view.author?.photo?.alt).toBe('Integration test author, Integration role');

    // The body links a case study nobody has published, so no card is offered for it.
    expect(view.caseStudy).toBeNull();
    // The service is only offered when it is published in this database.
    for (const service of view.services) expect(service.slug).toBe('care-plans');
    expect(view.relatedArticles.map((card) => card.slug)).not.toContain(slug);
  });

  it('answers null for a draft, an unknown slug, and an article whose body has no page', async () => {
    const service = new InsightsService(prisma);
    expect(await service.findArticle(draftSlug)).toBeNull();
    expect(await service.findArticle(brokenSlug)).toBeNull();
    expect(await service.findArticle(`no-such-article-${run}`)).toBeNull();
  });

  it('gives a topic page the URL when an article shares its slug', async () => {
    const clash = `integration-clash-${run}`;
    await db.postCategory.create({ data: { slug: clash, name: 'Integration clash', order: 991 } });
    await db.post.create({ data: { ...post, slug: clash, publishedAt: new Date('2026-01-04T00:00:00.000Z') } });
    try {
      const service = new InsightsService(prisma);
      expect(await service.findArticle(clash), 'the topic owns /insights/<slug>/').toBeNull();
      const view = insightsIndexViewSchema.parse(await service.findIndex());
      expect(view.articles.map((card) => card.slug)).not.toContain(clash);
      expect(view.categories.some((category) => category.slug === clash)).toBe(true);
    } finally {
      await db.post.deleteMany({ where: { slug: clash } });
      await db.postCategory.deleteMany({ where: { slug: clash } });
    }
  });

  // `PostCategory.name` is unbounded in the schema and the fallback SEO title is editable in
  // /admin, so their sum overflows the 60-character limit easily. This runs while the index is
  // built: a throw here would answer 500 for /insights/, every topic and every article at once.
  it('gives a topic with a very long name a page rather than failing the whole index', async () => {
    const longSlug = `integration-long-topic-${run}`;
    const name = 'Search engine optimisation and AI answer engine visibility'.slice(0, 58);
    await db.postCategory.create({ data: { slug: longSlug, name, order: 992 } });
    try {
      const view = insightsIndexViewSchema.parse(await new InsightsService(prisma).findIndex());
      const topic = view.categories.find((category) => category.slug === longSlug);
      expect(topic, 'the topic is on the index').toBeDefined();
      expect(topic?.copy.seo.title.length).toBeLessThanOrEqual(60);
      expect(topic?.copy.listHeading).toMatch(/\?$/);
    } finally {
      await db.postCategory.deleteMany({ where: { slug: longSlug } });
    }
  });
});
