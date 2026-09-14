import {
  GUIDES_GLOSSARY_SETTING_KEYS,
  glossaryIndexContentSchema,
  guidesIndexContentSchema,
  type GlossaryIndexContentInput,
  type GuidesIndexContentInput,
} from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Copy of `/guides/` and `/glossary/` for the placeholder database (content.ts rules):
 * placeholder words, no figures, names or promises. Both pages need their setting to render
 * at all; with no Guide or GlossaryTerm rows they show their empty state, which is what CI
 * checks. The publish-ready copy lives in apps/web/static-content/guides-glossary.
 */
export const GUIDES_INDEX_PLACEHOLDER: GuidesIndexContentInput = {
  seo: {
    title: 'Placeholder guides page',
    description: 'Placeholder. The approved description of the guides index replaces this text before launch.',
  },
  title: 'Guides',
  answerBlock:
    'Placeholder. The approved two to three sentence answer replaces this text before launch. It says what the guides are and what the download adds.',
  intro: 'Placeholder. The approved copy introduces the guides and who writes them.',
  list: {
    heading: 'Which guides are published here?',
    intro: null,
    empty: 'No guides are published yet.',
    cardLinkLabel: 'Read the summary',
  },
  gateNote: {
    heading: 'Do I have to give my email address?',
    body: 'Placeholder. The approved copy explains that the summary is free to read and what the download asks for.',
  },
  elsewhere: {
    heading: 'What if no guide answers my question?',
    body: 'Placeholder. The approved copy points a visitor at the glossary and the service pages.',
    primaryCta: { label: 'Ask us a question', href: '/contact/' },
    secondaryCta: { label: 'Browse the glossary', href: '/glossary/' },
  },
};

export const GLOSSARY_INDEX_PLACEHOLDER: GlossaryIndexContentInput = {
  seo: {
    title: 'Placeholder glossary page',
    description: 'Placeholder. The approved description of the glossary index replaces this text before launch.',
  },
  title: 'Glossary',
  answerBlock:
    'Placeholder. The approved two to three sentence answer replaces this text before launch. It says who the glossary is written for.',
  intro: 'Placeholder. The approved copy introduces the glossary and how the entries are kept current.',
  jumpLabel: 'Jump to a letter',
  list: { heading: 'Which terms are defined here?', intro: null, empty: 'No terms are published yet.' },
  method: {
    heading: 'How are these entries written?',
    body: 'Placeholder. The approved copy explains who writes the entries and how they are checked.',
  },
  elsewhere: {
    heading: 'What if a term is missing?',
    body: 'Placeholder. The approved copy invites a visitor to send the term they were looking for.',
    primaryCta: { label: 'Ask us to explain a term', href: '/contact/' },
    secondaryCta: { label: 'Read the guides', href: '/guides/' },
  },
};

export const guidesGlossarySeed: PageSeed = {
  family: 'guides-glossary',
  content: [GUIDES_INDEX_PLACEHOLDER, GLOSSARY_INDEX_PLACEHOLDER],
  /** Creates each setting once; a value someone has set since is never overwritten. */
  async seed(db: PrismaClient): Promise<void> {
    const rows = [
      [GUIDES_GLOSSARY_SETTING_KEYS.guides, guidesIndexContentSchema.parse(GUIDES_INDEX_PLACEHOLDER)],
      [GUIDES_GLOSSARY_SETTING_KEYS.glossary, glossaryIndexContentSchema.parse(GLOSSARY_INDEX_PLACEHOLDER)],
    ] as const;
    for (const [key, value] of rows) {
      await db.setting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonObject },
        update: {},
      });
    }
  },
};

/** Slugs the end-to-end spec visits. Development only, through `pnpm db:seed:fixtures`. */
export const FIXTURE_GUIDE_SLUG = 'e2e-fixture-guide';
export const FIXTURE_TERM_SLUGS = ['e2e-fixture-term', 'e2e-fixture-second-term'] as const;

/**
 * The structure a guide's `summary` column carries: an opening answer, then question
 * headings, paragraphs and "- " bullets, which the mapper turns into the page's sections.
 */
const FIXTURE_GUIDE_SUMMARY = [
  'This is a test fixture guide used by the end-to-end tests. It fills the ungated summary of the guide template with a complete opening answer. The download behind the gate is a test fixture too.',
  'What does this test fixture cover?',
  'A paragraph of test fixture copy inside the first section of the summary.',
  '- A test fixture bullet\n- A second test fixture bullet',
  'Which test fixture section comes next?',
  'A paragraph of test fixture copy inside the second section of the summary.',
].join('\n\n');

const FIXTURE_TERM_BODY = [
  'A paragraph of test fixture copy explaining what the term means in practice.',
  'A second paragraph of test fixture copy about the same term.',
].join('\n\n');

/**
 * Proof-shaped rows for the templates the launch seed leaves empty: one guide and two
 * glossary terms delivered by the same placeholder service, so the related list and the
 * delivering service both render. Adds no testimonial, technology or extra service, so the
 * homepage end-to-end expectations are unchanged.
 */
export const guidesGlossaryFixtures: PageSeed = {
  family: 'guides-glossary',
  content: [FIXTURE_GUIDE_SUMMARY, FIXTURE_TERM_BODY],
  async seed(db: PrismaClient): Promise<void> {
    const guide = {
      title: 'Test fixture guide',
      summary: FIXTURE_GUIDE_SUMMARY,
      fileUrl: `/guides/${FIXTURE_GUIDE_SLUG}.pdf`,
      pageCount: 12,
      status: 'PUBLISHED' as const,
    };
    await db.guide.upsert({
      where: { slug: FIXTURE_GUIDE_SLUG },
      create: { slug: FIXTURE_GUIDE_SLUG, ...guide },
      update: guide,
    });

    // The placeholder launch seed publishes this service; without it the term links to none.
    const service = await db.service.findUnique({ where: { slug: 'website-design' }, select: { id: true } });
    for (const [index, slug] of FIXTURE_TERM_SLUGS.entries()) {
      const term = {
        term: index === 0 ? 'Test fixture term' : 'Test fixture second term',
        shortDefinition: 'A test fixture term is the placeholder entry the end-to-end tests read.',
        body: FIXTURE_TERM_BODY,
        example: 'A sentence of test fixture copy standing in for a concrete example.',
        status: 'PUBLISHED' as const,
        relatedServiceId: service?.id ?? null,
      };
      await db.glossaryTerm.upsert({ where: { slug }, create: { slug, ...term }, update: term });
    }
  },
};
