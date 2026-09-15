import { INSIGHTS_COPY_SETTING_KEY, insightsCopySchema, type InsightsCopyInput } from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for `/insights/`, `/insights/<topic>/` and `/insights/<slug>/`, safe on a
 * URL someone can open (content.ts rules): no names, figures, ratings or promises. The
 * articles themselves are `Post` records, which the launch seed leaves empty, so the index
 * renders its empty state and every article URL answers 404.
 */
export const INSIGHTS_PLACEHOLDER_COPY: InsightsCopyInput = {
  index: {
    seo: {
      title: 'Placeholder: insights',
      description: 'Placeholder description of the insights index.',
    },
    eyebrow: 'Placeholder eyebrow',
    title: 'Placeholder: insights',
    intro: 'Placeholder introduction. The approved copy says who the articles are for and what they cover.',
    backdrop: null,
    featuredLabel: 'Placeholder featured label',
    listHeading: 'Placeholder: which articles are published?',
    topicsLabel: 'Topics',
    allTopicsLabel: 'All topics',
    readingTimeLabel: 'min read',
    cardLinkLabel: 'Read the article',
    empty: 'No articles are published yet.',
    emptyAction: { label: 'Tell us what you need', href: '/contact/' },
    pagination: {
      label: 'Pages',
      previous: 'Previous',
      next: 'Next',
      status: 'Page {page} of {pages}',
    },
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
      eyebrow: 'Placeholder eyebrow',
      body: 'Placeholder. The approved copy says how the service behind the article is delivered.',
      linkLabel: 'See the service',
      contactCta: { label: 'Tell us what you need', href: '/contact/' },
    },
    servicesHeading: 'Placeholder: which services put this into practice?',
    caseStudyLinkLabel: 'Read the case study',
    relatedHeading: 'Placeholder: what should you read next?',
    relatedLink: { label: 'All insights', href: '/insights/' },
    newsletter: {
      heading: 'Placeholder: would you like the next article by email?',
      body: 'Placeholder. The approved copy says what a subscriber gets and how often.',
      nameLabel: 'Full name',
      emailLabel: 'Work email',
      submitLabel: 'Subscribe',
      privacyNote: 'Placeholder. The approved copy says where the details are stored and how to unsubscribe.',
      success: {
        heading: 'Placeholder: you are subscribed.',
        body: 'Placeholder confirmation. The approved copy says what arrives next.',
      },
      unavailable: 'We could not send that just now. Please try again, or call us.',
    },
  },
  categoryFallback: {
    seoTitle: '{topic} articles',
    seoDescription: 'Placeholder description of the articles published under {topic}.',
    title: '{topic}',
    listHeading: 'Placeholder: which articles cover {topic}?',
  },
  categories: {},
};

export const insightsSeed: PageSeed = {
  family: 'insights',
  content: INSIGHTS_PLACEHOLDER_COPY,
  async seed(db: PrismaClient) {
    // Created once and never overwritten, so copy a person has set since survives a re-seed.
    const existing = await db.setting.findUnique({ where: { key: INSIGHTS_COPY_SETTING_KEY } });
    if (existing) return;
    const value = insightsCopySchema.parse(INSIGHTS_PLACEHOLDER_COPY) as Prisma.InputJsonObject;
    await db.setting.create({ data: { key: INSIGHTS_COPY_SETTING_KEY, value } });
  },
};

/** Slug of the topic page the end-to-end tests open. */
export const INSIGHTS_FIXTURE_CATEGORY_SLUG = 'e2e-fixture-topic';

const FIXTURE_CATEGORY = { name: 'Test fixture topic', order: 900 };

/**
 * A topic with no articles in it, for the end-to-end tests of the topic template
 * (development only, `pnpm db:seed:fixtures`). No article is published with it: every
 * published article shows on the homepage, whose tests expect that section empty.
 */
export const insightsFixtures: PageSeed = {
  family: 'insights',
  content: FIXTURE_CATEGORY,
  async seed(db: PrismaClient) {
    await db.postCategory.upsert({
      where: { slug: INSIGHTS_FIXTURE_CATEGORY_SLUG },
      create: { slug: INSIGHTS_FIXTURE_CATEGORY_SLUG, ...FIXTURE_CATEGORY },
      update: FIXTURE_CATEGORY,
    });
  },
};
