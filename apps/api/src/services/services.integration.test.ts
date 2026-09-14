import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@calwebtech/db';
import {
  SERVICES_SETTING_KEYS,
  serviceDetailViewSchema,
  servicesIndexViewSchema,
  type LeadSubmission,
  type ServiceContentInput,
  type ServicesIndexContentInput,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { LeadsService } from '../leads/leads.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { ServicesService } from './services.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally, services
// in CI. Every row it writes carries this run's prefix and is removed afterwards, so parallel
// suites and the seeded placeholder rows are left alone.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv(process.env);
const prisma = new PrismaService(env);
const db = prisma.client;
const run = `it-services-${Date.now().toString(36)}`;
const slug = (name: string) => `${run}-${name}`;
const hour = 60 * 60 * 1000;

const CONTENT: ServiceContentInput = {
  hero: { outcome: 'An integration test outcome line.', primaryCtaLabel: 'Get a quote' },
  price: { currency: 'USD', min: 1500, unit: 'MONTH' },
  included: { heading: 'What is included?' },
  process: { heading: 'How does it run?' },
  technology: { heading: 'Which technologies?' },
  proof: { heading: 'What has it delivered?', linkLabel: 'See the work' },
  industries: { heading: 'Which industries?' },
  testimonial: { heading: 'What do clients say?' },
  faq: { heading: 'What do buyers ask?' },
  enquiry: { heading: 'How do I get a quote?', submitLabel: 'Send' },
  formSuccess: { heading: 'Integration success heading.', body: 'Integration success body.' },
  related: { heading: 'What goes with it?' },
};

const INDEX_CONTENT: ServicesIndexContentInput = {
  seo: { title: 'Integration services', description: 'Integration test index.' },
  title: 'Integration services',
  answerBlock: 'This index exists for an integration test. It is removed when the test finishes.',
  intro: 'Integration intro.',
  otherGroupName: 'Integration other group',
  otherGroupHeading: 'Which integration services are left?',
  empty: 'Nothing published.',
  cardLinkLabel: 'See it',
  guidance: { heading: 'Integration guidance?', body: 'Integration body.', primaryCta: { label: 'Contact', href: '/contact/' } },
};

const ANSWER =
  'This service exists only for an integration test. It checks which records the services pages are allowed to show.';

let createdIndexSetting = false;

function serviceData(name: string, overrides: Partial<Prisma.ServiceUncheckedCreateInput> = {}): Prisma.ServiceUncheckedCreateInput {
  return {
    slug: slug(name),
    title: `Integration ${name}`,
    shortDescription: `Integration ${name} summary.`,
    answerBlock: ANSWER,
    status: 'PUBLISHED',
    publishedAt: new Date(Date.now() - hour),
    order: 9000,
    ...overrides,
  };
}

beforeAll(async () => {
  const existing = await db.setting.findUnique({ where: { key: SERVICES_SETTING_KEYS.index } });
  if (!existing) {
    await db.setting.create({ data: { key: SERVICES_SETTING_KEYS.index, value: INDEX_CONTENT } });
    createdIndexSetting = true;
  }

  const category = await db.serviceCategory.create({ data: { slug: slug('category'), name: 'Integration category', order: 9000 } });
  const industryPublished = await db.industry.create({
    data: { slug: slug('industry'), name: 'Integration industry', answerBlock: ANSWER, heroCopy: 'Industry line.', status: 'PUBLISHED' },
  });
  const industryDraft = await db.industry.create({
    data: { slug: slug('industry-draft'), name: 'Integration draft industry', answerBlock: ANSWER, status: 'DRAFT' },
  });
  const projectPublished = await db.project.create({
    data: {
      slug: slug('project'),
      title: 'Integration project',
      clientName: 'Integration client',
      answerBlock: ANSWER,
      summary: 'Integration project summary.',
      outcomeMetrics: [
        { value: '+1', label: 'First' },
        { value: '+2', label: 'Second' },
        { value: '+3', label: 'Third' },
      ],
      status: 'PUBLISHED',
    },
  });
  const projectDeleted = await db.project.create({
    data: {
      slug: slug('project-deleted'),
      title: 'Integration deleted project',
      clientName: 'Deleted client',
      answerBlock: ANSWER,
      summary: 'Deleted project summary.',
      outcomeMetrics: [{ value: '+9', label: 'Hidden' }],
      status: 'PUBLISHED',
      deletedAt: new Date(),
    },
  });
  await db.testimonial.createMany({
    data: [
      { clientName: `${run} unconsented`, quote: 'Not approved for publication.', projectId: projectPublished.id, featured: true },
      { clientName: `${run} consented`, quote: 'Approved for publication.', projectId: projectPublished.id, consentAt: new Date() },
    ],
  });

  await db.service.create({
    data: {
      ...serviceData('published', {
        categoryId: category.id,
        content: CONTENT as Prisma.InputJsonObject,
        deliverables: ['Integration deliverable'],
      }),
      projects: { connect: [{ id: projectPublished.id }, { id: projectDeleted.id }] },
      industries: { connect: [{ id: industryPublished.id }, { id: industryDraft.id }] },
      faqs: { create: [{ question: 'Is this an integration test?', answer: 'Yes.' }, { question: 'Not a question', answer: 'Left out.' }] },
    },
  });
  await db.service.create({ data: serviceData('uncategorised', { order: 9001 }) });
  await db.service.create({ data: serviceData('draft', { status: 'DRAFT' }) });
  await db.service.create({ data: serviceData('scheduled-past', { status: 'SCHEDULED', publishedAt: new Date(Date.now() - hour) }) });
  await db.service.create({ data: serviceData('scheduled-future', { status: 'SCHEDULED', publishedAt: new Date(Date.now() + 24 * hour) }) });
  await db.service.create({ data: serviceData('deleted', { deletedAt: new Date() }) });
});

afterAll(async () => {
  const services = { slug: { startsWith: run } };
  const emails = { startsWith: `${run}@` };
  await db.lead.deleteMany({ where: { email: emails } });
  await db.contact.deleteMany({ where: { email: emails } });
  await db.faq.deleteMany({ where: { service: services } });
  await db.service.deleteMany({ where: services });
  await db.testimonial.deleteMany({ where: { clientName: { startsWith: run } } });
  await db.project.deleteMany({ where: { slug: { startsWith: run } } });
  await db.industry.deleteMany({ where: { slug: { startsWith: run } } });
  await db.serviceCategory.deleteMany({ where: { slug: { startsWith: run } } });
  if (createdIndexSetting) await db.setting.deleteMany({ where: { key: SERVICES_SETTING_KEYS.index } });
  await prisma.onModuleDestroy();
});

describe('services views against Postgres', () => {
  it('shows a published service with only published, undeleted and consented proof', async () => {
    const view = serviceDetailViewSchema.parse(await new ServicesService(prisma).findBySlug(slug('published')));
    expect(view.price).toEqual({ label: 'From $1,500 a month', amount: { currency: 'USD', min: 1500, max: null, unit: 'MONTH' } });
    expect(view.proof?.caseStudies.map((study) => study.slug)).toEqual([slug('project')]);
    expect(view.testimonial?.quote.clientName).toBe(`${run} consented`);
    expect(view.industries?.items.map((item) => item.slug)).toEqual([slug('industry')]);
    expect(view.faq?.items.map((item) => item.question)).toEqual(['Is this an integration test?']);
    expect(view.enquiry.success).toEqual(CONTENT.formSuccess);
  });

  it('shows a scheduled service once its time has passed, and nothing that is draft, future or deleted', async () => {
    const services = new ServicesService(prisma);
    expect(await services.findBySlug(slug('scheduled-past'))).not.toBeNull();
    expect(await services.findBySlug(slug('draft'))).toBeNull();
    expect(await services.findBySlug(slug('scheduled-future'))).toBeNull();
    expect(await services.findBySlug(slug('deleted'))).toBeNull();
  });

  it('lists published services on the index, grouped by category, uncategorised last', async () => {
    const view = servicesIndexViewSchema.parse(await new ServicesService(prisma).findIndex());
    const listed = view.groups.flatMap((group) => group.services.map((service) => service.slug)).filter((item) => item.startsWith(run));
    expect(listed.sort()).toEqual([slug('published'), slug('scheduled-past'), slug('uncategorised')].sort());
    const ours = view.groups.find((group) => group.slug === slug('category'));
    expect(ours?.services.map((service) => service.slug)).toEqual([slug('published')]);
    expect(view.groups.at(-1)?.slug).toBeNull();
    for (const group of view.groups) expect(group.heading.endsWith('?'), group.heading).toBe(true);
  });
});

describe('service enquiries against Postgres', () => {
  // No Turnstile secret outside production stores the lead without a verdict; no emails are sent.
  const queued: unknown[] = [];
  const emailQueue = { enqueue: (jobs: unknown[]) => Promise.resolve(void queued.push(...jobs)) } as unknown as EmailQueue;
  const leads = new LeadsService(prisma, new TurnstileService('', fetch, 15_000), new SettingsService(prisma), emailQueue);

  function enquiry(name: string, serviceSlug: string): LeadSubmission {
    return {
      type: 'SERVICE_ENQUIRY',
      formId: 'service-enquiry',
      name: 'Integration Person',
      email: `${run}@${name}.example.com`,
      serviceInterest: [],
      serviceSlug,
      attribution: {},
    };
  }

  it('links the lead to a published service, tags it with the title and uses its success copy', async () => {
    const input = enquiry('published', slug('published'));
    await leads.create(input, '203.0.113.9');
    const lead = await db.lead.findFirstOrThrow({ where: { email: input.email }, include: { service: true } });
    expect(lead.service?.slug).toBe(slug('published'));
    expect(lead.serviceInterest).toEqual(['Integration published']);
    expect(JSON.stringify(queued)).toContain('Integration success heading.');
  });

  it('stores the lead without a link when the service is not published', async () => {
    const input = enquiry('draft', slug('draft'));
    await leads.create(input, '203.0.113.9');
    const lead = await db.lead.findFirstOrThrow({ where: { email: input.email } });
    expect(lead.serviceId).toBeNull();
    expect(lead.serviceInterest).toEqual([]);
  });
});
