import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { industryDetailViewSchema, type IndustryContentInput } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { IndustriesService } from './industries.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally,
// services in CI. The test writes its own uniquely named rows and removes them afterwards,
// so it runs beside other families' tests on the same database.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));
const run = randomUUID().slice(0, 8);
const slug = (name: string) => `it-industries-${run}-${name}`;
const INDUSTRY = slug('industry');
const HIDDEN_INDUSTRY = slug('draft-industry');

const point = (title: string) => ({ title, body: `Integration test body for ${title}.` });
const CONTENT: IndustryContentInput = {
  title: 'Integration test industry websites',
  hero: { intro: 'Integration test hero introduction.' },
  painPoints: {
    heading: 'Which integration test problems come up?',
    items: [point('One'), point('Two'), point('Three'), point('Four')],
  },
  services: { heading: 'Which integration test services fit?', items: [] },
  caseStudies: { heading: 'Which integration test projects exist?', linkLabel: 'See all integration test work' },
  results: { heading: 'What did the integration test projects change?' },
  integrations: { heading: 'Which integration test systems connect?', items: [{ name: 'Test system', body: 'Test body.' }] },
  faq: { heading: 'What do integration test buyers ask?' },
};
const metrics = [
  { value: '1', label: 'Integration figure one' },
  { value: '2', label: 'Integration figure two' },
  { value: '3', label: 'Integration figure three' },
];

beforeAll(async () => {
  const db = prisma.client;
  const industry = await db.industry.create({
    data: {
      slug: INDUSTRY,
      name: 'Integration test industry',
      answerBlock: 'This industry exists only for an integration test. It is removed again when the test finishes.',
      content: CONTENT,
      status: 'PUBLISHED',
      faqs: {
        create: [
          { question: 'What is the second integration test question?', answer: 'The second answer.', order: 1 },
          { question: 'What is the first integration test question?', answer: 'The first answer.', order: 0 },
        ],
      },
    },
    select: { id: true },
  });
  await db.industry.create({
    data: { slug: HIDDEN_INDUSTRY, name: 'Draft test industry', answerBlock: 'Draft. Not shown.', status: 'DRAFT' },
  });

  const past = new Date(Date.now() - 60_000);
  await db.service.create({
    data: {
      slug: slug('service'),
      title: 'Integration test service',
      shortDescription: 'Integration test service summary.',
      answerBlock: 'Integration test service.',
      status: 'PUBLISHED',
      publishedAt: past,
      industries: { connect: { id: industry.id } },
    },
  });
  await db.service.create({
    data: {
      slug: slug('draft-service'),
      title: 'Draft integration test service',
      shortDescription: 'Never shown.',
      answerBlock: 'Never shown.',
      status: 'DRAFT',
      industries: { connect: { id: industry.id } },
    },
  });

  const project = (name: string, extra: object) => ({
    slug: slug(name),
    title: `Integration test project ${name}`,
    clientName: `Integration client ${name}`,
    answerBlock: 'Integration test project.',
    summary: 'Integration test project summary.',
    outcomeMetrics: metrics,
    industryId: industry.id,
    ...extra,
  });
  await db.project.create({
    data: {
      ...project('published', { status: 'PUBLISHED' }),
      testimonials: {
        create: [
          { clientName: 'Unconsented reviewer', quote: 'Never shown.' },
          { clientName: 'Consented reviewer', quote: 'Shown with consent.', consentAt: past },
        ],
      },
    },
  });
  await db.project.create({ data: project('draft', { status: 'DRAFT' }) });
  await db.project.create({ data: project('deleted', { status: 'PUBLISHED', deletedAt: past }) });
});

afterAll(async () => {
  const db = prisma.client;
  const mine = { startsWith: `it-industries-${run}-` };
  await db.testimonial.deleteMany({ where: { project: { slug: mine } } });
  await db.project.deleteMany({ where: { slug: mine } });
  await db.service.deleteMany({ where: { slug: mine } });
  await db.faq.deleteMany({ where: { industry: { slug: mine } } });
  await db.industry.deleteMany({ where: { slug: mine } });
  await prisma.onModuleDestroy();
});

describe('industry pages against the database', () => {
  it('builds a published industry from its copy and only published, undeleted, consented records', async () => {
    const view = industryDetailViewSchema.parse(await new IndustriesService(prisma).findPublished(INDUSTRY));
    expect(view.title).toBe(CONTENT.title);
    expect(view.painPoints?.items).toHaveLength(4);
    expect(view.services?.items.map((item) => item.slug)).toEqual([slug('service')]);
    expect(view.caseStudies?.items.map((item) => item.slug)).toEqual([slug('published')]);
    expect(view.caseStudies?.link.href).toBe(`/work/?industry=${INDUSTRY}`);
    expect(view.results?.metrics).toHaveLength(3);
    expect(view.results?.testimonial?.clientName).toBe('Consented reviewer');
    expect(view.faq?.items.map((item) => item.question)).toEqual([
      'What is the first integration test question?',
      'What is the second integration test question?',
    ]);
  });

  it('finds nothing for a draft or unknown industry', async () => {
    const service = new IndustriesService(prisma);
    expect(await service.findPublished(HIDDEN_INDUSTRY)).toBeNull();
    expect(await service.findPublished(slug('missing'))).toBeNull();
  });
});
