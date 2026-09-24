import type { Faq, Testimonial } from '@calwebtech/db';
import {
  INDUSTRY_FAQ_LIMIT,
  INDUSTRY_INTEGRATION_LIMIT,
  INDUSTRY_INTEGRATION_NAME_MAX,
  INDUSTRY_PAIN_POINT_TITLE_MAX,
  type IndustriesIndexContentInput,
  type IndustryContentInput,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CONSENTED } from '../common/published';
import {
  INDUSTRY_FALLBACK_HEADINGS,
  industryDetailInclude,
  matchedServices,
  namedServiceSlugs,
  shorten,
  toIndustriesIndexView,
  toIndustryDetailView,
  type IndustryCardRecord,
  type IndustryDetailRecord,
} from './industries.mapper';

const at = new Date('2026-09-01T00:00:00Z');
let sequence = 0;
const next = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
};

const ANSWER =
  'Test industry websites have to answer a technical buyer quickly. This answer block is two sentences long for the test.';

const point = (title: string) => ({ title, body: `Test body for ${title}.` });

const CONTENT: IndustryContentInput = {
  title: 'Test industry website design',
  image: { src: '/media/test-industry.jpg', alt: 'Test industry photograph' },
  hero: { intro: 'Test hero intro.', primaryCta: { label: 'Test call', href: '/contact/' } },
  painPoints: {
    heading: 'Which test problems come up?',
    items: [point('Test one'), point('Test two'), point('Test three'), point('Test four')],
  },
  services: {
    heading: 'Which test services fit?',
    items: [{ slug: 'test-service-a', body: 'Test service described for this industry.' }],
  },
  compliance: { heading: 'Which test rules apply?', notes: [point('Test rule')] },
  caseStudies: { heading: 'Which test projects exist?', linkLabel: 'See all test work' },
  results: { heading: 'What did the test projects change?', note: 'Test measurement note.' },
  integrations: { heading: 'Which test systems connect?', items: [{ name: 'Test system', body: 'Test integration body.' }] },
  faq: { heading: 'What do test buyers ask?' },
};

type ProjectRecord = IndustryDetailRecord['projects'][number];

function testimonial(overrides: Partial<Testimonial> = {}): Testimonial {
  return {
    id: next('testimonial'),
    clientName: 'Test reviewer',
    role: 'Test role',
    company: 'Test company',
    avatarUrl: null,
    rating: 5,
    quote: 'A test quote.',
    source: null,
    videoUrl: null,
    featured: false,
    consentAt: at,
    date: null,
    createdAt: at,
    updatedAt: at,
    projectId: null,
    ...overrides,
  };
}

function project(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  const id = next('project');
  return {
    id,
    title: 'Test project',
    slug: id,
    clientName: `Test client ${id}`,
    clientAlias: null,
    answerBlock: 'Test answer block.',
    summary: 'Test project summary.',
    liveUrl: null,
    location: 'Test state',
    segment: 'B2B',
    coverImageUrl: '/media/test-cover.jpg',
    coverImageAlt: 'Test cover',
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics: [
      { value: '1', label: 'Test figure one' },
      { value: '2', label: 'Test figure two' },
      { value: '3', label: 'Test figure three' },
      { value: '4', label: 'Test figure four' },
    ],
    duration: null,
    year: null,
    featured: false,
    beforeImageUrl: null,
    afterImageUrl: null,
    beforeAfterMetrics: null,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    industryId: 'industry-test',
    technologies: [{ name: 'Test framework' }],
    testimonials: [],
    ...overrides,
  };
}

function faq(question: string): Faq {
  return {
    id: next('faq'),
    question,
    answer: 'A test answer.',
    group: null,
    order: 0,
    serviceId: null,
    industryId: 'industry-test',
    locationId: null,
    landingPageId: null,
  };
}

function industry(overrides: Partial<IndustryDetailRecord> = {}): IndustryDetailRecord {
  return {
    id: 'industry-test',
    name: 'Test industry',
    slug: 'test-industry',
    answerBlock: ANSWER,
    heroCopy: 'Test card line.',
    painPoints: null,
    integrations: null,
    content: null,
    order: 0,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    services: [],
    projects: [],
    faqs: [],
    ...overrides,
  };
}

describe('industryDetailInclude', () => {
  it('loads only published, undeleted services and projects, and consented testimonials', () => {
    const include = industryDetailInclude(at);
    expect(include.services.where.deletedAt).toBeNull();
    expect(include.services.where.OR).toContainEqual({ status: 'PUBLISHED' });
    expect(include.projects.where).toEqual({ status: 'PUBLISHED', deletedAt: null });
    expect(include.projects.include.testimonials.where).toEqual(CONSENTED);
  });
});

describe('toIndustryDetailView', () => {
  it('renders a record without copy or proof as the hero and answer block alone', () => {
    const view = toIndustryDetailView(industry());
    expect(view.title).toBe('Test industry');
    expect(view.hero.intro).toBe('Test card line.');
    expect(view.seo).toEqual({ title: 'Test industry', description: ANSWER, ogImage: null });
    for (const section of ['painPoints', 'services', 'compliance', 'caseStudies', 'results', 'integrations', 'faq'] as const) {
      expect(view[section], section).toBeNull();
    }
  });

  it('uses the pain point and integration columns when there is no copy', () => {
    const view = toIndustryDetailView(
      industry({ painPoints: ['Test pain one', 'Test pain two'], integrations: ['Test system'] }),
    );
    expect(view.painPoints).toEqual({
      heading: INDUSTRY_FALLBACK_HEADINGS.painPoints,
      intro: null,
      items: [
        { title: 'Test pain one', body: null },
        { title: 'Test pain two', body: null },
      ],
    });
    expect(view.integrations?.items).toEqual([{ name: 'Test system', body: null }]);
  });

  it('caps the columns and drops entries too long to show, so a long legacy list cannot fail the page', () => {
    const systems = Array.from({ length: INDUSTRY_INTEGRATION_LIMIT + 1 }, (_, position) => `Test system ${String(position)}`);
    const view = toIndustryDetailView(
      industry({
        painPoints: ['x'.repeat(INDUSTRY_PAIN_POINT_TITLE_MAX + 1), 'Test pain one', 'Test pain two', 'Test pain three', 'Test pain four', 'Test pain five'],
        integrations: ['y'.repeat(INDUSTRY_INTEGRATION_NAME_MAX + 1), ...systems],
      }),
    );
    expect(view.painPoints?.items.map((item) => item.title)).toEqual([
      'Test pain one',
      'Test pain two',
      'Test pain three',
      'Test pain four',
    ]);
    expect(view.integrations?.items).toHaveLength(INDUSTRY_INTEGRATION_LIMIT);
    expect(view.integrations?.items[0]).toEqual({ name: 'Test system 0', body: null });
  });

  it('lists the services its copy names, described for the industry, and no others', () => {
    const view = toIndustryDetailView(
      industry({
        content: CONTENT,
        services: [
          { slug: 'test-service-b', title: 'Test service B', shortDescription: 'Generic summary B.' },
          { slug: 'test-service-a', title: 'Test service A', shortDescription: 'Generic summary A.' },
        ],
      }),
    );
    expect(view.title).toBe('Test industry website design');
    expect(view.seo.ogImage).toBe('/media/test-industry.jpg');
    expect(view.services?.items).toEqual([
      { slug: 'test-service-a', title: 'Test service A', body: 'Test service described for this industry.' },
    ]);
    expect(view.compliance?.notes).toHaveLength(1);
    expect(view.hero.primaryCta).toEqual({ label: 'Test call', href: '/contact/' });
  });

  it('keeps the order its copy names services in, and skips one that is not published', () => {
    const named = [
      { slug: 'test-service-c', body: 'Test C for this industry.' },
      { slug: 'test-service-gone', body: 'Test gone for this industry.' },
      { slug: 'test-service-a', body: 'Test A for this industry.' },
    ];
    const services = [
      { slug: 'test-service-a', title: 'Test service A', shortDescription: 'Generic summary A.' },
      { slug: 'test-service-c', title: 'Test service C', shortDescription: 'Generic summary C.' },
    ];
    expect(matchedServices(services, named)).toEqual([
      { slug: 'test-service-c', title: 'Test service C', body: 'Test C for this industry.' },
      { slug: 'test-service-a', title: 'Test service A', body: 'Test A for this industry.' },
    ]);
  });

  it('lists the linked services by their own summary when its copy names none', () => {
    const services = [{ slug: 'test-service-a', title: 'Test service A', shortDescription: 'Generic summary A.' }];
    expect(matchedServices(services, [])).toEqual([
      { slug: 'test-service-a', title: 'Test service A', body: 'Generic summary A.' },
    ]);
    expect(namedServiceSlugs(CONTENT)).toEqual(['test-service-a']);
    expect(namedServiceSlugs(null)).toEqual([]);
  });

  it('shows up to three case studies with figures, links to the filtered work listing, and shares the band', () => {
    const quote = testimonial();
    const projects = [
      project({ outcomeMetrics: [] }),
      project({ outcomeMetrics: { value: '10' } }),
      project({ testimonials: [quote] }),
      project(),
      project(),
      project(),
    ];
    const view = toIndustryDetailView(industry({ content: CONTENT, projects }));

    const shown = projects.slice(2, 5);
    expect(view.caseStudies?.items.map((card) => card.slug)).toEqual(shown.map((record) => record.slug));
    expect(view.caseStudies?.items[0]?.tags).toEqual(['Test state', 'B2B', 'Test framework']);
    expect(view.caseStudies?.items[0]?.metrics).toHaveLength(3);
    expect(view.caseStudies?.link).toEqual({ label: 'See all test work', href: '/work/?industry=test-industry' });

    // Six figures across three clients: two each, so no client fills the band.
    expect(view.results?.metrics.map((metric) => metric.clientName)).toEqual(
      shown.flatMap((record) => [record.clientName, record.clientName]),
    );
    expect(view.results?.testimonial?.id).toBe(quote.id);
    expect(view.results?.note).toBe('Test measurement note.');
  });

  it('gives one client up to six figures and leaves the testimonial out when none is consented', () => {
    const view = toIndustryDetailView(industry({ projects: [project()] }));
    expect(view.results?.metrics).toHaveLength(4);
    expect(view.results?.testimonial).toBeNull();
    expect(view.results?.heading).toBe(INDUSTRY_FALLBACK_HEADINGS.results);
  });

  it('leaves case studies and the metrics band out when no project has figures', () => {
    const view = toIndustryDetailView(industry({ projects: [project({ outcomeMetrics: [] })] }));
    expect(view.caseStudies).toBeNull();
    expect(view.results).toBeNull();
  });

  it('carries FAQs in order under the copy heading', () => {
    const view = toIndustryDetailView(
      industry({ content: CONTENT, faqs: [faq('What is the first test question?'), faq('What is the second?')] }),
    );
    expect(view.faq?.heading).toBe('What do test buyers ask?');
    expect(view.faq?.items.map((item) => item.question)).toEqual(['What is the first test question?', 'What is the second?']);
  });

  it('shows at most the FAQ limit, so a long list cannot fail the page', () => {
    const faqs = Array.from({ length: INDUSTRY_FAQ_LIMIT + 2 }, (_, position) =>
      faq(`What is test question ${String(position)}?`),
    );
    const view = toIndustryDetailView(industry({ faqs }));
    expect(view.faq?.items).toHaveLength(INDUSTRY_FAQ_LIMIT);
    expect(view.faq?.items[0]?.question).toBe('What is test question 0?');
  });

  it('keeps record SEO and shortens fallbacks to the length rules', () => {
    const long = 'A long test answer sentence that keeps going for quite a while longer. '.repeat(3).trim();
    const fallback = toIndustryDetailView(industry({ answerBlock: long }));
    expect(long.length).toBeGreaterThan(155);
    expect(fallback.seo.description.length).toBeLessThanOrEqual(155);
    const stored = toIndustryDetailView(industry({ seo: { title: 'Stored title', description: 'Stored description.' } }));
    expect(stored.seo).toMatchObject({ title: 'Stored title', description: 'Stored description.' });
  });

  it('throws on malformed copy or records rather than rendering half a page', () => {
    expect(() => toIndustryDetailView(industry({ content: { ...CONTENT, painPoints: null } }))).toThrow(ZodError);
    expect(() => toIndustryDetailView(industry({ faqs: [faq('Not written as a question')] }))).toThrow(ZodError);
    expect(() => toIndustryDetailView(industry({ answerBlock: 'One sentence.' }))).toThrow(ZodError);
    expect(() => toIndustryDetailView(industry({ seo: { title: 'x'.repeat(61) } }))).toThrow(ZodError);
  });
});

const INDEX_CONTENT: IndustriesIndexContentInput = {
  seo: { title: 'Test industries', description: 'Test industries description.' },
  title: 'Test industries',
  answerBlock: 'Test industries are the sectors this test covers. This answer block has two sentences for the test.',
  list: {
    heading: 'Which test industries are there?',
    empty: 'No test industries are published.',
    cardLinkLabel: 'See the test industry',
  },
  notListed: { heading: 'Not listed?', body: 'Test body.', cta: { label: 'Test contact', href: '/contact/' } },
  approach: { heading: 'Why does the test sector matter?', items: [] },
};

function card(overrides: Partial<IndustryCardRecord> = {}): IndustryCardRecord {
  const slug = next('industry');
  return { slug, name: `Test ${slug}`, heroCopy: 'Test line.', content: null, ...overrides };
}

describe('toIndustriesIndexView', () => {
  it('lists published industries with their card line and image, and an empty list when there are none', () => {
    const withImage = card({ content: CONTENT });
    const malformedImage = card({ content: { image: { src: '/media/no-alt.jpg' } }, heroCopy: ' ' });
    const view = toIndustriesIndexView({ contentSetting: INDEX_CONTENT, industries: [withImage, malformedImage] });
    expect(view.industries).toEqual([
      { slug: withImage.slug, name: withImage.name, line: 'Test line.', image: CONTENT.image },
      { slug: malformedImage.slug, name: malformedImage.name, line: null, image: null },
    ]);
    expect(toIndustriesIndexView({ contentSetting: INDEX_CONTENT, industries: [] }).industries).toEqual([]);
  });

  it('throws when the index copy is missing or malformed', () => {
    expect(() => toIndustriesIndexView({ contentSetting: null, industries: [] })).toThrow(ZodError);
    expect(() =>
      toIndustriesIndexView({ contentSetting: { ...INDEX_CONTENT, answerBlock: 'Too short.' }, industries: [] }),
    ).toThrow(ZodError);
  });
});

describe('shorten', () => {
  it('cuts at a word boundary within the limit', () => {
    expect(shorten('Short enough', 60)).toBe('Short enough');
    const cut = shorten('Manufacturing website design and development for engineers and buyers', 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith(' ')).toBe(false);
  });
});
