import {
  INDUSTRY_SETTING_KEYS,
  industriesIndexContentSchema,
  industryContentSchema,
  type IndustriesIndexContentInput,
  type IndustryContentInput,
} from '@calwebtech/shared';
import type { Prisma } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Copy of `/industries/`, placeholder-only like src/seed/content.ts: the page needs the
 * `industries.index` setting to render at all. The industry rows themselves come from the
 * homepage seed (HOME_INDUSTRIES), with no page copy, so their pages show the answer block only.
 */
export const INDUSTRIES_INDEX_PLACEHOLDER: IndustriesIndexContentInput = {
  seo: {
    title: 'Placeholder industries page',
    description: 'Placeholder. The approved description of the industries page replaces this text before launch.',
  },
  title: 'Industries',
  answerBlock: 'Placeholder. The approved two to three sentence answer replaces this text before launch.',
  intro: 'Placeholder. The approved copy introduces the industries served.',
  list: {
    heading: 'Which industries are listed here?',
    intro: null,
    empty: 'No industries are published yet.',
    cardLinkLabel: 'See the industry',
  },
  notListed: {
    heading: 'Not listed here?',
    body: 'Placeholder. The approved copy invites other industries to get in touch.',
    cta: { label: 'Start the conversation', href: '/contact/' },
  },
  approach: { heading: 'Placeholder approach heading?', intro: null, items: [] },
};

export const industriesSeed: PageSeed = {
  family: 'industries',
  content: INDUSTRIES_INDEX_PLACEHOLDER,
  async seed(db) {
    const key = INDUSTRY_SETTING_KEYS.index;
    // Created once; copy a person set since is never overwritten.
    const existing = await db.setting.findUnique({ where: { key } });
    if (existing) return;
    const value = industriesIndexContentSchema.parse(INDUSTRIES_INDEX_PLACEHOLDER) as Prisma.InputJsonObject;
    await db.setting.create({ data: { key, value } });
  },
};

/** A published industry with every section filled, for end-to-end tests. Development only. */
export const FIXTURE_INDUSTRY_SLUG = 'e2e-fixture-industry';

const fixturePoint = (title: string) => ({ title, body: `Test fixture body for ${title.toLowerCase()}.` });

const FIXTURE_CONTENT: IndustryContentInput = {
  title: 'Test fixture industry websites',
  hero: {
    intro: 'Test fixture hero introduction.',
    primaryCta: { label: 'Test fixture call to action', href: '/contact/' },
  },
  painPoints: {
    heading: 'Which test fixture problems come up?',
    items: [fixturePoint('Fixture one'), fixturePoint('Fixture two'), fixturePoint('Fixture three'), fixturePoint('Fixture four')],
  },
  services: { heading: 'Which test fixture services fit?', items: [] },
  compliance: { heading: 'Which test fixture rules apply?', notes: [fixturePoint('Fixture rule')] },
  caseStudies: { heading: 'Which test fixture projects exist?', linkLabel: 'See all fixture work' },
  results: { heading: 'What did the test fixture projects change?' },
  integrations: { heading: 'Which test fixture systems connect?', items: [{ name: 'Fixture system', body: 'Test fixture integration.' }] },
  faq: { heading: 'What do test fixture buyers ask?' },
};

export const industriesFixtures: PageSeed = {
  family: 'industries',
  content: FIXTURE_CONTENT,
  async seed(db) {
    const data = {
      name: 'Test fixture industry',
      answerBlock: 'This is a test fixture industry for end-to-end tests. It fills every section of the industry template.',
      heroCopy: 'Test fixture card line.',
      content: industryContentSchema.parse(FIXTURE_CONTENT) as Prisma.InputJsonObject,
      order: 999,
      status: 'PUBLISHED' as const,
    };
    const industry = await db.industry.upsert({
      where: { slug: FIXTURE_INDUSTRY_SLUG },
      create: { slug: FIXTURE_INDUSTRY_SLUG, ...data },
      update: data,
      select: { id: true },
    });
    await db.faq.deleteMany({ where: { industryId: industry.id } });
    await db.faq.createMany({
      data: ['What is the first test fixture question?', 'What is the second test fixture question?'].map((question, order) => ({
        question,
        answer: 'A test fixture answer.',
        order,
        industryId: industry.id,
      })),
    });
  },
};
