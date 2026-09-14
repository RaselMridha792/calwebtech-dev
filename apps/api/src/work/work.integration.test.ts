import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  WORK_COPY_SETTING_KEY,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workCopySchema,
  workIndexViewSchema,
  type WorkCopyInput,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { WorkService } from './work.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally, services
// in CI. The test writes its own rows under a unique slug and removes them afterwards, so it
// can run beside other tests on a shared database.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));
const db = prisma.client;
const run = randomUUID().slice(0, 8);
const slug = `integration-work-${run}`;
const draftSlug = `integration-work-draft-${run}`;
let createdCopy = false;

const question = (topic: string) => `What about the ${topic} for {client}?`;

/** Used only when the database has no `work.copy` setting yet; removed again afterwards. */
const COPY: WorkCopyInput = {
  index: {
    seo: { title: 'Integration work index', description: 'Integration test description.' },
    eyebrow: 'Integration',
    title: 'Integration work index',
    intro: 'Integration test introduction.',
    highlightsLabel: 'Integration highlights',
    summaryLabels: { caseStudies: 'Case studies', industries: 'Industries', services: 'Services', platforms: 'Platforms' },
    filters: { label: 'Filter', industry: 'Industry', service: 'Service', platform: 'Platform', all: 'All', clear: 'Clear' },
    resultsHeading: question('results'),
    empty: 'Nothing yet.',
    noMatches: 'No matches.',
    caseStudyLabel: 'Read it',
    proofHeading: question('proof'),
    ratingLabel: 'Rating',
  },
  caseStudy: {
    eyebrow: 'Case study',
    headlineLabel: 'Headline',
    headings: {
      metrics: question('metrics'),
      atAGlance: question('overview'),
      challenge: question('challenge'),
      approach: question('approach'),
      build: question('build'),
      gallery: question('gallery'),
      beforeAfter: question('comparison'),
      outcome: question('outcome'),
      quote: question('quote'),
      relatedServices: question('services'),
      relatedCaseStudies: question('related work'),
    },
    labels: {
      industry: 'Industry',
      services: 'Services',
      platform: 'Platform',
      location: 'Location',
      duration: 'Duration',
      year: 'Year',
      liveSite: 'Live site',
      visitSite: 'Visit',
      measurement: 'Measurement',
      serviceLink: 'Service',
      caseStudyLink: 'Case study',
      comparison: 'Compared',
      before: 'Before',
      after: 'After',
    },
    measurement: 'Integration measurement.',
  },
  beforeAndAfter: {
    seo: { title: 'Integration before and after', description: 'Integration test description.' },
    eyebrow: 'Integration',
    title: 'Integration before and after',
    intro: 'Integration test introduction.',
    comparisonHeading: question('redesign'),
    metricsLabel: 'Measured',
    beforeLabel: 'Before',
    afterLabel: 'After',
    caseStudyLabel: 'Read it',
    empty: 'Nothing yet.',
    emptyAction: { label: 'Work', href: '/work/' },
  },
};

const project = {
  title: 'Integration test case study',
  clientName: 'Integration test client',
  answerBlock:
    'This case study exists only while an integration test runs. It checks the queries behind the work pages. It is removed when the test ends.',
  summary: 'Integration test case study.',
  outcomeMetrics: [
    { value: 'A', label: 'Integration measure one' },
    { value: 'B', label: 'Integration measure two' },
    { value: 'C', label: 'Integration measure three' },
  ],
  challenge: 'First paragraph.\n\nSecond paragraph.',
  beforeImageUrl: 'https://images.example.com/before.png',
  afterImageUrl: 'https://images.example.com/after.png',
  beforeAfterMetrics: [{ label: 'Integration measure', before: 'A', after: 'B' }],
};

beforeAll(async () => {
  const existing = await db.setting.findUnique({ where: { key: WORK_COPY_SETTING_KEY } });
  if (!existing) {
    await db.setting.create({
      data: { key: WORK_COPY_SETTING_KEY, value: workCopySchema.parse(COPY) },
    });
    createdCopy = true;
  }
  await db.project.create({ data: { slug, status: 'PUBLISHED', ...project } });
  await db.project.create({ data: { slug: draftSlug, status: 'DRAFT', ...project } });
});

afterAll(async () => {
  await db.project.deleteMany({ where: { slug: { in: [slug, draftSlug] } } });
  if (createdCopy) await db.setting.deleteMany({ where: { key: WORK_COPY_SETTING_KEY } });
  await prisma.onModuleDestroy();
});

describe('work pages against the database', () => {
  it('lists a published case study on the index, and never a draft', async () => {
    const view = workIndexViewSchema.parse(await new WorkService(prisma).findIndex());
    const slugs = view.caseStudies.map((card) => card.slug);
    expect(slugs).toContain(slug);
    expect(slugs).not.toContain(draftSlug);
  });

  it('builds the case study page, and answers null for a draft or unknown slug', async () => {
    const service = new WorkService(prisma);
    const view = workCaseStudyViewSchema.parse(await service.findCaseStudy(slug));
    expect(view.challenge).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(view.beforeAfter?.metrics).toHaveLength(1);
    expect(await service.findCaseStudy(draftSlug)).toBeNull();
    expect(await service.findCaseStudy(`no-such-project-${run}`)).toBeNull();
  });

  it('shows the published before and after pair, linked to its case study', async () => {
    const view = workBeforeAndAfterViewSchema.parse(await new WorkService(prisma).findBeforeAndAfter());
    const comparison = view.comparisons.find((item) => item.slug === slug);
    expect(comparison?.clientName).toBe(project.clientName);
    expect(view.comparisons.some((item) => item.slug === draftSlug)).toBe(false);
  });
});
