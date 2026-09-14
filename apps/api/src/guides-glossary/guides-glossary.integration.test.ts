import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@calwebtech/db';
import {
  GUIDES_GLOSSARY_SETTING_KEYS,
  glossaryIndexViewSchema,
  glossaryTermViewSchema,
  guideDetailViewSchema,
  guidesIndexViewSchema,
  type GlossaryIndexContentInput,
  type GuidesIndexContentInput,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { GuidesGlossaryService } from './guides-glossary.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally,
// services in CI. The test creates its own uniquely named guide and terms, and the settings
// it needs only when they are missing, and removes everything it created afterwards.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));
const db = prisma.client;
const run = `${Date.now().toString(36)}-${String(process.pid)}`;
const slug = (name: string) => `it-gg-${name}-${run}`;

const ANSWER =
  'This is a test fixture answer for the integration test. It is two sentences long, so it satisfies the answer block contract.';

const GUIDES_CONTENT: GuidesIndexContentInput = {
  seo: { title: 'Test guides', description: 'Test description of the guides index.' },
  title: 'Test guides',
  answerBlock: ANSWER,
  intro: 'Test intro for the guides index.',
  list: { heading: 'Which test guides are here?', empty: 'No test guides are published.', cardLinkLabel: 'Read it' },
  gateNote: { heading: 'What does the test gate ask for?', body: 'A name and an email address.' },
  elsewhere: {
    heading: 'What if no test guide fits?',
    body: 'Ask a test question instead.',
    primaryCta: { label: 'Contact', href: '/contact/' },
  },
};

const GLOSSARY_CONTENT: GlossaryIndexContentInput = {
  seo: { title: 'Test glossary', description: 'Test description of the glossary index.' },
  title: 'Test glossary',
  answerBlock: ANSWER,
  intro: 'Test intro for the glossary index.',
  jumpLabel: 'Jump to a letter',
  list: { heading: 'Which test terms are here?', empty: 'No test terms are published.' },
  method: { heading: 'How are test entries written?', body: 'By the test suite.' },
  elsewhere: {
    heading: 'What if a test term is missing?',
    body: 'Send it in.',
    primaryCta: { label: 'Contact', href: '/contact/' },
  },
};

const createdSettings: string[] = [];
const createdGuides: string[] = [];
const createdTerms: string[] = [];
let service: { id: string; slug: string; title: string } | null = null;

async function ensureSetting(key: string, value: Prisma.InputJsonObject): Promise<void> {
  const existing = await db.setting.findUnique({ where: { key }, select: { id: true } });
  if (existing) return;
  await db.setting.create({ data: { key, value } });
  createdSettings.push(key);
}

function pages(): GuidesGlossaryService {
  // A fresh service each time, so the 30 second view cache never hides a write.
  return new GuidesGlossaryService(prisma);
}

beforeAll(async () => {
  await ensureSetting(GUIDES_GLOSSARY_SETTING_KEYS.guides, GUIDES_CONTENT);
  await ensureSetting(GUIDES_GLOSSARY_SETTING_KEYS.glossary, GLOSSARY_CONTENT);

  // An existing published service, so the test links to real data and creates none.
  service = await db.service.findFirst({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: [{ order: 'asc' }, { title: 'asc' }],
    select: { id: true, slug: true, title: true },
  });

  const summary = [
    `${ANSWER} The third sentence keeps it inside the answer block rules.`,
    'What does this test guide cover?',
    `A paragraph naming ${service?.title ?? 'no service'} so the mapper can link it.`,
    '- A test bullet\n- A second test bullet',
  ].join('\n\n');

  await db.guide.create({
    data: {
      slug: slug('guide'),
      title: 'Test fixture integration guide',
      summary,
      fileUrl: `/guides/${slug('guide')}.pdf`,
      pageCount: 9,
      status: 'PUBLISHED',
    },
  });
  createdGuides.push(slug('guide'));

  await db.guide.create({
    data: {
      slug: slug('draft-guide'),
      title: 'Test fixture draft guide',
      summary: 'A draft guide that no page may show.',
      fileUrl: `/guides/${slug('draft-guide')}.pdf`,
      status: 'DRAFT',
    },
  });
  createdGuides.push(slug('draft-guide'));

  for (const [index, name] of ['term', 'second-term'].entries()) {
    await db.glossaryTerm.create({
      data: {
        slug: slug(name),
        term: `Test ${run} ${name}`,
        shortDefinition: `A test ${name} is the entry the integration test reads.`,
        body: 'A first paragraph of the test body. It has two sentences so an answer block can be built.\n\nA second paragraph of the test body.',
        example: index === 0 ? 'A test example.' : null,
        status: 'PUBLISHED',
        relatedServiceId: service?.id ?? null,
      },
    });
    createdTerms.push(slug(name));
  }

  await db.glossaryTerm.create({
    data: {
      slug: slug('draft-term'),
      term: `Test ${run} draft term`,
      shortDefinition: 'A draft term that no page may show.',
      body: 'A draft body.',
      status: 'DRAFT',
    },
  });
  createdTerms.push(slug('draft-term'));
});

afterAll(async () => {
  await db.guide.deleteMany({ where: { slug: { in: createdGuides } } });
  await db.glossaryTerm.deleteMany({ where: { slug: { in: createdTerms } } });
  if (createdSettings.length > 0) await db.setting.deleteMany({ where: { key: { in: createdSettings } } });
  await prisma.onModuleDestroy();
});

describe('guides and glossary against Postgres', () => {
  it('lists the published guide on the index and leaves the draft out', async () => {
    const view = guidesIndexViewSchema.parse(await pages().findGuidesIndex());
    const slugs = view.guides.map((guide) => guide.slug);
    expect(slugs).toContain(slug('guide'));
    expect(slugs).not.toContain(slug('draft-guide'));
  });

  it('builds the guide page from the summary column, with the file behind the gate', async () => {
    const view = guideDetailViewSchema.parse(await pages().findGuide(slug('guide')));
    expect(view.answerBlock).toBeTruthy();
    expect(view.summary.sections.map((section) => section.heading)).toEqual([null, 'What does this test guide cover?']);
    expect(view.summary.sections[1]?.bullets).toEqual(['A test bullet', 'A second test bullet']);
    expect(view.gate.fileUrl).toBe(`/guides/${slug('guide')}.pdf`);
    expect(view.gate.fileLabel).toBe('PDF, 9 pages');
    if (service) expect(view.service?.item.slug).toBe(service.slug);
  });

  it('answers null for a draft guide and for a slug that does not exist', async () => {
    expect(await pages().findGuide(slug('draft-guide'))).toBeNull();
    expect(await pages().findGuide('no-such-guide')).toBeNull();
  });

  it('groups published terms on the glossary index and leaves the draft out', async () => {
    const view = glossaryIndexViewSchema.parse(await pages().findGlossaryIndex());
    const slugs = view.groups.flatMap((group) => group.terms.map((term) => term.slug));
    expect(slugs).toContain(slug('term'));
    expect(slugs).not.toContain(slug('draft-term'));
    expect(view.updatedAt).toBeTruthy();
  });

  it('builds a term page with its definition, related terms and delivering service', async () => {
    const view = glossaryTermViewSchema.parse(await pages().findGlossaryTerm(slug('term')));
    expect(view.answerBlock?.startsWith(view.definition)).toBe(true);
    expect(view.body.paragraphs).toHaveLength(2);
    expect(view.example?.body).toBe('A test example.');
    if (service) {
      expect(view.service?.slug).toBe(service.slug);
      expect(view.related?.terms.map((term) => term.slug)).toContain(slug('second-term'));
    }
    expect(view.related?.terms.map((term) => term.slug) ?? []).not.toContain(slug('draft-term'));
  });

  it('answers null for a draft term and for a slug that does not exist', async () => {
    expect(await pages().findGlossaryTerm(slug('draft-term'))).toBeNull();
    expect(await pages().findGlossaryTerm('no-such-term')).toBeNull();
  });
});
