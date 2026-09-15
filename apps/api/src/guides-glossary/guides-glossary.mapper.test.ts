import { GUIDES_GLOSSARY_SETTING_KEYS, type GlossaryIndexContentInput, type GuidesIndexContentInput } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import {
  clip,
  guideAnswer,
  mentions,
  toGlossaryIndexView,
  toGlossaryTermView,
  toGuideDetailView,
  toGuidesIndexView,
  type GlossaryCardRecord,
  type GlossaryDetailRecord,
  type GuideDetailRecord,
  type ServiceLink,
} from './guides-glossary.mapper';

const GUIDES_CONTENT: GuidesIndexContentInput = {
  seo: { title: 'Guides', description: 'Long-form answers to the questions that come up when a company plans a website.' },
  title: 'Guides and white papers',
  answerBlock:
    'Our guides are long-form answers to the questions that come up when a company plans a website. Each summary on this site is complete on its own. The download adds the worksheets behind it.',
  intro: 'Written by the people who do the work.',
  list: { heading: 'Which guides can I read?', empty: 'No guides are published yet.', cardLinkLabel: 'Read the summary' },
  gateNote: { heading: 'Do I have to give my email?', body: 'Only for the file. The summary on each page is the whole argument.' },
  elsewhere: {
    heading: 'What if no guide answers my question?',
    body: 'Ask us directly and a person will answer.',
    primaryCta: { label: 'Contact us', href: '/contact/' },
  },
};

const GLOSSARY_CONTENT: GlossaryIndexContentInput = {
  seo: { title: 'Glossary', description: 'Plain definitions of the words that come up when you buy a website.' },
  title: 'Website glossary',
  answerBlock:
    'This glossary defines the words a buyer meets while commissioning a website. Each entry gives one plain sentence, then what the term means for the budget and the timeline. Every entry names the service that delivers the work.',
  intro: 'Written for the person signing the purchase order, not for developers.',
  jumpLabel: 'Jump to a letter',
  list: { heading: 'Which terms are defined here?', empty: 'No terms are published yet.' },
  method: { heading: 'How are these entries written?', body: 'By the people who do the work, and dated so you can see how current they are.' },
  elsewhere: {
    heading: 'What if a word is missing?',
    body: 'Send it to us and we will define it.',
    primaryCta: { label: 'Contact us', href: '/contact/' },
  },
};

const SERVICES: ServiceLink[] = [
  { slug: 'website-redesign', title: 'Website redesign', shortDescription: 'Rebuild a site that stopped working for the business.' },
  { slug: 'ai-search-visibility', title: 'AI search visibility', shortDescription: 'Technical SEO and being cited by answer engines.' },
];

const GUIDE: GuideDetailRecord = {
  id: 'guide-1',
  slug: 'website-redesign-guide',
  title: 'The website redesign guide',
  summary: [
    'A website redesign is a rebuild of an existing site around what the business needs now. It keeps the pages that earn traffic and rebuilds the rest. This guide explains how to plan one without losing rankings.',
    'What does a redesign cost?',
    'It depends on the number of templates, the integrations and how much content has to be rewritten.',
    '- Template count\n- Integrations',
    'A headless CMS changes that arithmetic, because editors and developers stop waiting for each other.',
  ].join('\n\n'),
  fileUrl: '/guides/website-redesign-guide.pdf',
  coverImage: '/media/redesign.webp',
  pageCount: 28,
  seo: null,
};

const TERM_RECORD = (overrides: Partial<GlossaryDetailRecord> = {}): GlossaryDetailRecord => ({
  id: 'term-1',
  term: 'Headless CMS',
  slug: 'headless-cms',
  shortDefinition: 'A headless CMS stores and edits content but does not render the pages that display it.',
  body: 'The website reads that content over an API and decides how it looks. That separation is what lets one set of records feed a site, an app and a shop.\n\nIt costs more to set up than a page-builder theme.',
  example: 'Truvia Labs moved its marketing site, docs and onboarding onto one content store.',
  status: 'PUBLISHED',
  seo: null,
  updatedAt: new Date('2026-09-15T00:00:00.000Z'),
  relatedServiceId: 'service-1',
  relatedService: {
    slug: 'nextjs-development',
    title: 'Next.js development',
    shortDescription: 'Fast, maintainable sites and applications on Next.js and React.',
    status: 'PUBLISHED',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  },
  ...overrides,
});

const CARD = (term: string, slug: string, relatedServiceId: string | null = 'service-1'): GlossaryCardRecord => ({
  id: `card-${slug}`,
  slug,
  term,
  shortDefinition: `${term} is defined in one sentence for the index.`,
  relatedServiceId,
  updatedAt: new Date('2026-09-14T00:00:00.000Z'),
});

describe('guides index', () => {
  it('lists every published guide with its card copy', () => {
    const view = toGuidesIndexView({
      contentSetting: GUIDES_CONTENT,
      guides: [{ id: GUIDE.id, slug: GUIDE.slug, title: GUIDE.title, summary: GUIDE.summary, pageCount: 28, coverImage: null }],
    });
    expect(view.guides).toHaveLength(1);
    expect(view.guides[0]?.pageCountLabel).toBe('28 pages');
    expect(view.guides[0]?.summary.startsWith('A website redesign is a rebuild')).toBe(true);
    expect(view.content.title).toBe('Guides and white papers');
  });

  it('renders with nothing published, so the page can show its empty state', () => {
    expect(toGuidesIndexView({ contentSetting: GUIDES_CONTENT, guides: [] }).guides).toEqual([]);
  });

  it('fails loudly when the setting is missing, rather than rendering half a page', () => {
    expect(() => toGuidesIndexView({ contentSetting: null, guides: [] })).toThrow();
    expect(GUIDES_GLOSSARY_SETTING_KEYS.guides).toBe('guides.index');
  });
});

describe('guide detail', () => {
  const view = toGuideDetailView({
    guide: GUIDE,
    others: [{ id: 'guide-2', slug: 'core-web-vitals-guide', title: 'The Core Web Vitals guide', summary: 'What the three metrics measure.', pageCount: null, coverImage: null }],
    terms: [CARD('Headless CMS', 'headless-cms'), CARD('Bounce rate', 'bounce-rate')],
    services: SERVICES,
  });

  it('opens with an answer block taken from the summary, before the gate', () => {
    expect(view.answerBlock).toBe(
      'A website redesign is a rebuild of an existing site around what the business needs now. It keeps the pages that earn traffic and rebuilds the rest. This guide explains how to plan one without losing rankings.',
    );
  });

  it('builds the ungated summary from the structure of the summary column', () => {
    expect(view.summary.sections.map((section) => section.heading)).toEqual([null, 'What does a redesign cost?']);
    expect(view.summary.sections[1]?.bullets).toEqual(['Template count', 'Integrations']);
    expect(view.summary.sections[1]?.paragraphs).toHaveLength(2);
  });

  it('puts the download behind the gate and names the file', () => {
    expect(view.gate.fileUrl).toBe('/guides/website-redesign-guide.pdf');
    expect(view.gate.fileLabel).toBe('PDF, 28 pages');
  });

  it('links the glossary terms it names, in the order it names them, and not the ones it does not', () => {
    expect(view.related?.terms.map((term) => term.slug)).toEqual(['headless-cms']);
    expect(view.related?.guides.map((guide) => guide.slug)).toEqual(['core-web-vitals-guide']);
  });

  it('links the service it is about, so the page is not an orphan', () => {
    expect(view.service?.item.slug).toBe('website-redesign');
  });

  it('leaves out the sections only a record cannot supply', () => {
    expect(view.takeaways).toBeNull();
    expect(view.faq).toBeNull();
  });

  it('renders a guide that names no term and no service', () => {
    const plain = toGuideDetailView({
      guide: { ...GUIDE, summary: 'One short paragraph with no question in it and nothing named.' },
      others: [],
      terms: [CARD('Bounce rate', 'bounce-rate')],
      services: SERVICES,
    });
    expect(plain.related).toBeNull();
    expect(plain.service).toBeNull();
    expect(plain.answerBlock).toBeNull();
    expect(plain.summary.sections).toHaveLength(1);
  });

  it('clips a long-form guide to the contract instead of failing its page', () => {
    const longParagraph = `${'A sentence about the rebuild that keeps going. '.repeat(50)}End.`;
    const longBullet = 'A bullet that will not stop '.repeat(30);
    const blocks = [
      'A website redesign is a rebuild of an existing site around what the business needs now. It keeps the pages that earn traffic. This guide explains how to plan one.',
      // One section with more paragraphs and more bullets than a section may hold.
      'What does a rebuild cost?',
      longParagraph,
      ...Array.from({ length: 14 }, (_, index) => `Extra paragraph ${String(index)}.`),
      Array.from({ length: 14 }, () => `- ${longBullet}`).join('\n'),
      // And thirteen more question headings, so the guide is over the section cap.
      ...Array.from({ length: 13 }, (_, index) => `What does step ${String(index)} cost?`),
    ];

    const view = toGuideDetailView({
      guide: { ...GUIDE, summary: blocks.join('\n\n') },
      others: [],
      terms: [],
      services: [],
    });
    expect(view.summary.sections).toHaveLength(12);
    for (const section of view.summary.sections) {
      expect(section.paragraphs.length).toBeLessThanOrEqual(12);
      expect(section.bullets.length).toBeLessThanOrEqual(12);
      for (const paragraph of section.paragraphs) expect(paragraph.length).toBeLessThanOrEqual(1600);
      for (const bullet of section.bullets) expect(bullet.length).toBeLessThanOrEqual(400);
    }
    expect(view.summary.sections[1]?.paragraphs[0]?.endsWith('…')).toBe(true);
    expect(view.summary.sections[1]?.bullets[0]?.endsWith('…')).toBe(true);
  });

  it('renders a guide whose whole summary is one very long block', () => {
    const view = toGuideDetailView({
      guide: { ...GUIDE, summary: 'One unbroken block of prose. '.repeat(200) },
      others: [],
      terms: [],
      services: [],
    });
    expect(view.summary.sections).toHaveLength(1);
    expect(view.summary.sections[0]?.paragraphs[0]?.length).toBeLessThanOrEqual(1600);
  });

  it('fails contract validation rather than publishing a guide with no summary', () => {
    expect(() => toGuideDetailView({ guide: { ...GUIDE, summary: '   ' }, others: [], terms: [], services: [] })).toThrow();
  });
});

describe('glossary index', () => {
  it('groups published terms A to Z and reports the most recent change', () => {
    const view = toGlossaryIndexView({
      contentSetting: GLOSSARY_CONTENT,
      terms: [CARD('Headless CMS', 'headless-cms'), CARD('Bounce rate', 'bounce-rate'), CARD('301 redirect', '301-redirect')],
    });
    expect(view.groups.map((group) => group.letter)).toEqual(['B', 'H', '#']);
    expect(view.updatedAt).toBe('2026-09-14T00:00:00.000Z');
  });

  it('renders with nothing published', () => {
    const view = toGlossaryIndexView({ contentSetting: GLOSSARY_CONTENT, terms: [] });
    expect(view.groups).toEqual([]);
    expect(view.updatedAt).toBeNull();
  });
});

describe('glossary term', () => {
  it('opens with the definition and the sentences after it', () => {
    const view = toGlossaryTermView({ term: TERM_RECORD(), others: [] });
    expect(view.definition).toBe('A headless CMS stores and edits content but does not render the pages that display it.');
    expect(view.answerBlock?.startsWith(view.definition)).toBe(true);
    expect(view.letter).toBe('H');
    expect(view.body.paragraphs).toHaveLength(2);
    expect(view.updatedAt).toBe('2026-09-15T00:00:00.000Z');
  });

  it('relates the other terms its delivering service covers, and nothing else', () => {
    const view = toGlossaryTermView({
      term: TERM_RECORD(),
      others: [CARD('Server-side rendering', 'server-side-rendering'), CARD('Bounce rate', 'bounce-rate', 'service-2')],
    });
    expect(view.related?.terms.map((term) => term.slug)).toEqual(['server-side-rendering']);
    expect(view.service?.slug).toBe('nextjs-development');
  });

  it('links no service when the delivering service is unpublished or deleted', () => {
    const draft = TERM_RECORD({
      relatedService: {
        slug: 'nextjs-development',
        title: 'Next.js development',
        shortDescription: 'Fast, maintainable sites.',
        status: 'DRAFT',
        publishedAt: null,
        deletedAt: null,
      },
    });
    expect(toGlossaryTermView({ term: draft, others: [] }).service).toBeNull();
    const deleted = TERM_RECORD({
      relatedService: {
        slug: 'nextjs-development',
        title: 'Next.js development',
        shortDescription: 'Fast, maintainable sites.',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
    expect(toGlossaryTermView({ term: deleted, others: [] }).service).toBeNull();
  });

  it('shows the example only when the record has one', () => {
    expect(toGlossaryTermView({ term: TERM_RECORD(), others: [] }).example?.body).toContain('Truvia Labs');
    expect(toGlossaryTermView({ term: TERM_RECORD({ example: null }), others: [] }).example).toBeNull();
  });

  it('clips a long example and a long body paragraph rather than failing the term page', () => {
    const long = 'A worked example that runs on and on. '.repeat(60);
    const view = toGlossaryTermView({
      term: TERM_RECORD({ body: `${long}\n\nA second paragraph.`, example: long }),
      others: [],
    });
    expect(view.example?.body.length).toBeLessThanOrEqual(1600);
    expect(view.example?.body.endsWith('…')).toBe(true);
    expect(view.body.paragraphs[0]?.length).toBeLessThanOrEqual(1600);
    expect(view.body.paragraphs[0]?.endsWith('…')).toBe(true);
  });

  it('renders a term whose body is one short sentence, without an answer block', () => {
    const view = toGlossaryTermView({ term: TERM_RECORD({ shortDefinition: 'A short one.', body: 'Short.' }), others: [] });
    expect(view.answerBlock).toBeNull();
    expect(view.body.paragraphs).toEqual(['Short.']);
  });
});

describe('helpers', () => {
  it('clips long text at a word boundary', () => {
    expect(clip('  one   two three  ', 40)).toBe('one two three');
    expect(clip('one two three four five', 12)).toBe('one two…');
  });

  it('matches a named term only on a whole word', () => {
    expect(mentions('We use a headless CMS here.', 'headless cms')).toBe(true);
    expect(mentions('Headless commerce is different.', 'headless')).toBe(true);
    expect(mentions('Redesigned last year.', 'redesign')).toBe(false);
    expect(mentions('anything', '  ')).toBe(false);
  });

  it('gives no answer block for a summary that opens with one short sentence', () => {
    expect(guideAnswer([{ id: 'section-1', heading: null, paragraphs: ['Too short.'], bullets: [] }])).toBeNull();
    expect(guideAnswer([])).toBeNull();
  });
});
