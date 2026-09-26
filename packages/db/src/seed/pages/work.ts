import { WORK_COPY_SETTING_KEY, workCopySchema, type WorkCopyInput } from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for `/work/`, `/work/<slug>/` and `/before-and-after/`, safe on a URL
 * someone can open (content.ts rules): no names, figures, ratings or promises. Case
 * studies and comparisons come from Project records, which the launch seed leaves empty,
 * so both index pages render their empty state.
 */
export const WORK_PLACEHOLDER_COPY: WorkCopyInput = {
  index: {
    seo: {
      title: 'Placeholder: case studies',
      description: 'Placeholder description of the case studies page.',
    },
    eyebrow: 'Placeholder eyebrow',
    title: 'Placeholder: case studies',
    intro: 'Placeholder introduction. The approved copy explains what the case studies show and how they were measured.',
    highlightsLabel: 'Placeholder headline results label',
    summaryLabels: {
      caseStudies: 'Case studies',
      industries: 'Industries',
      services: 'Services',
      platforms: 'Platforms',
    },
    filters: {
      label: 'Filter case studies',
      industry: 'Industry',
      service: 'Service',
      platform: 'Platform',
      all: 'All',
      clear: 'Clear filters',
    },
    resultsHeading: 'Placeholder: which case studies match?',
    empty: 'No case studies are published yet.',
    noMatches: 'No case studies match these filters.',
    caseStudyLabel: 'Read the case study',
    proofHeading: 'Placeholder: what does the proof band show?',
    proofIntro: null,
    ratingLabel: 'Placeholder rating label',
    targets: [],
  },
  caseStudy: {
    eyebrow: 'Case study',
    headlineLabel: 'Placeholder headline label',
    headings: {
      metrics: 'Placeholder: what changed for {client}?',
      atAGlance: 'Placeholder: what did the {client} project cover?',
      challenge: 'Placeholder: what did {client} need to solve?',
      approach: 'Placeholder: how was the {client} project approached?',
      build: 'Placeholder: what was built for {client}?',
      gallery: 'Placeholder: what does the gallery show?',
      beforeAfter: 'Placeholder: what did the {client} site look like before and after?',
      outcome: 'Placeholder: how did the outcome come about?',
      quote: 'Placeholder: what did {client} say?',
      relatedServices: 'Placeholder: which services did this project use?',
      relatedCaseStudies: 'Placeholder: which projects are similar?',
    },
    labels: {
      industry: 'Industry',
      services: 'Services',
      platform: 'Platform',
      location: 'Location',
      duration: 'Duration',
      year: 'Year',
      liveSite: 'Live site',
      visitSite: 'Visit the site',
      measurement: 'How the figures were measured',
      serviceLink: 'See the service',
      caseStudyLink: 'Read the case study',
      comparison: 'Measured before and after',
      before: 'Before',
      after: 'After',
    },
    measurement: 'Placeholder. The approved copy explains how published figures are measured and agreed with the client.',
  },
  beforeAndAfter: {
    seo: {
      title: 'Placeholder: before and after',
      description: 'Placeholder description of the before and after page.',
    },
    eyebrow: 'Placeholder eyebrow',
    title: 'Placeholder: before and after',
    intro: 'Placeholder introduction. The approved copy explains what each comparison shows.',
    backdrop: null,
    comparisonHeading: 'Placeholder: what changed for {client}?',
    metricsLabel: 'Placeholder measures label',
    beforeLabel: 'Before',
    afterLabel: 'After',
    caseStudyLabel: 'Read the case study',
    empty: 'No before and after comparisons are published yet.',
    emptyAction: { label: 'See all case studies', href: '/work/' },
  },
};

export const workSeed: PageSeed = {
  family: 'work',
  content: WORK_PLACEHOLDER_COPY,
  async seed(db: PrismaClient) {
    // Created once and never overwritten, so copy a person has set since survives a re-seed.
    const existing = await db.setting.findUnique({ where: { key: WORK_COPY_SETTING_KEY } });
    if (existing) return;
    const value = workCopySchema.parse(WORK_PLACEHOLDER_COPY) as Prisma.InputJsonObject;
    await db.setting.create({ data: { key: WORK_COPY_SETTING_KEY, value } });
  },
};

/** Slug of the proof-shaped case study the end-to-end tests open. */
export const WORK_FIXTURE_SLUG = 'e2e-fixture-case-study';

const FIXTURE_PROJECT = {
  title: 'Test fixture: case study',
  clientName: 'Test fixture client',
  answerBlock:
    'This is a test fixture for the case study template. It exists only in development and end-to-end test databases. It is never seeded where anyone else can open it.',
  summary: 'Test fixture for the case study template.',
  location: 'Test fixture location',
  segment: 'Test fixture segment',
  challenge: 'Test fixture challenge, first paragraph.\n\nTest fixture challenge, second paragraph.',
  approach: 'Test fixture approach.',
  buildNotes: 'Test fixture build notes.',
  outcome: 'Test fixture outcome.',
  outcomeMetrics: [
    { value: 'A', label: 'Fixture measure one' },
    { value: 'B', label: 'Fixture measure two' },
    { value: 'C', label: 'Fixture measure three' },
  ],
  status: 'PUBLISHED' as const,
  // Not featured: the homepage and the menus show featured projects, and their tests
  // expect the placeholder empty states.
  featured: false,
};

const fixtureImage = (id: string, alt: string) => ({
  src: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=70`,
  alt,
});

/**
 * A comparison on `/before-and-after/` for the slider's end-to-end test (decision 70). Not
 * marked for the homepage, whose tests expect the placeholder empty state.
 */
const FIXTURE_COMPARISON = {
  clientName: 'Test fixture client',
  heading: 'What changed in the test fixture?',
  summary: 'Test fixture for the before and after page.',
  before: fixtureImage('photo-1498050108023-c5249f4df085', 'Test fixture picture before'),
  after: fixtureImage('photo-1460925895917-afdab827c52f', 'Test fixture picture after'),
  metrics: [{ label: 'Fixture measure', before: 'A', after: 'B' }],
  order: 0,
  onHomepage: false,
  status: 'PUBLISHED' as const,
};

/**
 * A complete case study for the end-to-end tests (development only, `pnpm db:seed:fixtures`).
 * It has no testimonial, because the homepage lists every consented testimonial.
 */
export const workFixtures: PageSeed = {
  family: 'work',
  content: { project: FIXTURE_PROJECT, comparison: FIXTURE_COMPARISON },
  async seed(db: PrismaClient) {
    const project = await db.project.upsert({
      where: { slug: WORK_FIXTURE_SLUG },
      create: { slug: WORK_FIXTURE_SLUG, ...FIXTURE_PROJECT },
      update: FIXTURE_PROJECT,
      select: { id: true },
    });
    const comparison = { ...FIXTURE_COMPARISON, projectId: project.id, deletedAt: null };
    const existing = await db.comparison.findFirst({ where: { heading: FIXTURE_COMPARISON.heading }, select: { id: true } });
    if (existing) await db.comparison.update({ where: { id: existing.id }, data: comparison });
    else await db.comparison.create({ data: comparison });
  },
};
