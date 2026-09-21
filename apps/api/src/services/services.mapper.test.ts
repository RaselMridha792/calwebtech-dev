import type { Faq, Industry, Technology, Testimonial } from '@calwebtech/db';
import {
  DEFAULT_ACKNOWLEDGEMENT,
  SERVICES_SETTING_KEYS,
  templateServiceContent,
  type ServiceContentInput,
  type ServicesIndexContentInput,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CONSENTED } from '../common/published';
import {
  clip,
  serviceDetailInclude,
  toServiceDetailView,
  toServicesIndexView,
  type ServiceCardRecord,
  type ServiceDetailRecord,
} from './services.mapper';

const at = new Date('2026-09-01T00:00:00Z');

const CONTENT: ServiceContentInput = {
  hero: {
    outcome: 'A site your team publishes to without a developer.',
    primaryCtaLabel: 'Get a fixed quote',
    secondaryCta: { label: 'See the work', href: '/work/' },
  },
  price: { currency: 'USD', min: 12000, max: 25000, unit: 'PROJECT' },
  problem: {
    heading: 'When does a business need this?',
    situations: [
      { title: 'First', body: 'The first situation.' },
      { title: 'Second', body: 'The second situation.' },
      { title: 'Third', body: 'The third situation.' },
    ],
  },
  included: { heading: 'What is included?', intro: 'Everything below.' },
  process: { heading: 'How does it run?' },
  technology: { heading: 'Which technologies?' },
  proof: { heading: 'What has it delivered?', linkLabel: 'See the related work' },
  comparison: {
    heading: 'How does it compare?',
    columns: { us: 'Us', freelancer: 'Freelancer', pageBuilder: 'Page builder', offshore: 'Offshore' },
    rows: ['Scope', 'Speed', 'Ownership'].map((label) => ({
      label,
      us: 'Written down.',
      freelancer: 'Depends.',
      pageBuilder: 'Fixed by the tool.',
      offshore: 'By ticket.',
    })),
  },
  pricing: {
    heading: 'What moves the price?',
    factors: ['Pages', 'Integrations', 'Content'].map((title) => ({ title, body: `How ${title.toLowerCase()} change it.` })),
  },
  industries: { heading: 'Which industries?' },
  testimonial: { heading: 'What do clients say?' },
  faq: { heading: 'What do buyers ask?' },
  enquiry: { heading: 'How do I get a quote?', submitLabel: 'Send it' },
  formSuccess: { heading: 'Thanks, it is with us.', body: 'We reply by email.' },
  related: { heading: 'What goes with it?' },
};

type ProjectRecord = ServiceDetailRecord['projects'][number];

function project(slug: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: slug,
    title: 'Test project',
    slug,
    clientName: `Client ${slug}`,
    clientAlias: null,
    answerBlock: 'Test answer block.',
    summary: 'Test project summary.',
    liveUrl: null,
    location: 'Ohio, USA',
    segment: 'B2B',
    coverImageUrl: null,
    coverImageAlt: null,
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics: [
      { value: '+10', label: 'First figure' },
      { value: '+20', label: 'Second figure' },
      { value: '+30', label: 'Third figure' },
      { value: '+40', label: 'Fourth figure' },
    ],
    duration: null,
    year: 2026,
    featured: true,
    beforeImageUrl: null,
    afterImageUrl: null,
    beforeAfterMetrics: null,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    industryId: null,
    industry: { name: 'Distribution' },
    testimonials: [],
    ...overrides,
  };
}

function testimonial(id: string, featured: boolean): Testimonial {
  return {
    id,
    clientName: `Person ${id}`,
    role: 'Director',
    company: 'Client',
    avatarUrl: null,
    rating: 5,
    quote: `Quote ${id}.`,
    source: null,
    videoUrl: null,
    featured,
    consentAt: at,
    date: at,
    createdAt: at,
    updatedAt: at,
    projectId: null,
  };
}

function faq(id: string, question: string): Faq {
  return { id, question, answer: 'An answer.', group: null, order: 0, serviceId: 'svc', industryId: null, locationId: null, landingPageId: null };
}

const technology = (name: string, category: string): Technology => ({
  id: name,
  name,
  slug: name.toLowerCase(),
  logoUrl: null,
  category,
  proficiencyNote: null,
  order: 0,
});

const industry = (slug: string, heroCopy: string | null): Industry => ({
  id: slug,
  name: slug,
  slug,
  answerBlock: 'Answer.',
  heroCopy,
  painPoints: null,
  integrations: null,
  content: null,
  order: 0,
  status: 'PUBLISHED',
  seo: null,
  createdAt: at,
  updatedAt: at,
});

function service(overrides: Partial<ServiceDetailRecord> = {}): ServiceDetailRecord {
  return {
    id: 'svc',
    title: 'Website redesign',
    slug: 'website-redesign',
    shortDescription: 'Rebuild a site that stopped working for the business, without losing what it earns.',
    answerBlock:
      'A website redesign rebuilds the structure, design and code of an existing site. It keeps the pages that earn traffic and fixes the ones that do not.',
    icon: null,
    heroMediaUrl: 'https://images.unsplash.com/photo-1',
    problemStatement: 'Most redesigns start with one of these.',
    deliverables: ['Content audit', 'Redirect map'],
    processSteps: [{ title: 'Audit', body: 'We look at what earns.', duration: 'Week 1' }],
    startingPriceBand: null,
    content: CONTENT,
    order: 0,
    status: 'PUBLISHED',
    publishedAt: at,
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    categoryId: 'cat-build',
    category: { slug: 'design-and-build', name: 'Design and build' },
    technologies: [technology('Next.js', 'frontend'), technology('Something', 'unknown')],
    projects: [],
    industries: [],
    faqs: [],
    ...overrides,
  };
}

function card(slug: string, categoryId: string | null, order = 0): ServiceCardRecord {
  return {
    id: slug,
    slug,
    title: `Service ${slug}`,
    shortDescription: `About ${slug}.`,
    startingPriceBand: order === 1 ? 'From $1,500 a month' : null,
    content: null,
    categoryId,
    updatedAt: at,
  };
}

describe('toServiceDetailView', () => {
  it('builds every section in order from the copy and the records', () => {
    const view = toServiceDetailView({
      service: service({
        projects: [project('a', { testimonials: [testimonial('t1', false), testimonial('t2', true)] })],
        industries: [industry('manufacturing', 'Spec sheets and configurators.')],
        faqs: [faq('f1', 'How long does it take?')],
      }),
      others: [card('custom-website-development', 'cat-build')],
    });

    expect(view.hero.primaryCta).toEqual({ label: 'Get a fixed quote', href: '#enquire' });
    expect(view.hero.backdrop).toEqual({ src: 'https://images.unsplash.com/photo-1' });
    expect(view.price).toEqual({
      label: '$12,000 to $25,000',
      amount: { currency: 'USD', min: 12000, max: 25000, unit: 'PROJECT' },
    });
    expect(view.problem?.intro).toBe('Most redesigns start with one of these.');
    expect(view.included?.items).toEqual(['Content audit', 'Redirect map']);
    expect(view.process?.steps).toEqual([{ title: 'Audit', duration: 'Week 1', body: 'We look at what earns.' }]);
    expect(view.technology?.items).toEqual([
      { name: 'Next.js', category: 'Front end' },
      { name: 'Something', category: null },
    ]);
    expect(view.proof?.link).toEqual({ label: 'See the related work', href: '/work/?service=website-redesign' });
    expect(view.proof?.caseStudies[0]?.metrics).toHaveLength(3);
    expect(view.proof?.caseStudies[0]?.tags).toEqual(['Ohio, USA', 'B2B', 'Distribution']);
    expect(view.comparison?.rows).toHaveLength(3);
    expect(view.pricing?.factors).toHaveLength(3);
    expect(view.industries?.items).toEqual([{ slug: 'manufacturing', name: 'manufacturing', line: 'Spec sheets and configurators.' }]);
    expect(view.testimonial?.quote.id).toBe('t2');
    expect(view.faq?.items.map((item) => item.id)).toEqual(['f1']);
    expect(view.enquiry.success).toEqual(CONTENT.formSuccess);
    expect(view.related?.items.map((item) => item.slug)).toEqual(['custom-website-development']);
    expect(view.seo).toEqual({ title: 'Website redesign', description: service().shortDescription, ogImage: null });
  });

  it('renders a service published without copy, with the template headings and without the copy-only sections', () => {
    const view = toServiceDetailView({ service: service({ content: null, startingPriceBand: 'From $12,000' }), others: [] });
    const template = templateServiceContent(service());
    expect(view.hero.outcome).toBe(service().shortDescription);
    expect(view.hero.primaryCta.href).toBe('#enquire');
    expect(view.included?.heading).toBe(template.included.heading);
    expect(view.problem).toBeNull();
    expect(view.comparison).toBeNull();
    expect(view.pricing).toBeNull();
    expect(view.price).toEqual({ label: 'From $12,000', amount: null });
    expect(view.enquiry.success).toEqual(DEFAULT_ACKNOWLEDGEMENT);
    expect(view.related).toBeNull();
  });

  it('leaves out every list section when there are no records, and the problem section without copy', () => {
    const view = toServiceDetailView({
      service: service({ deliverables: null, processSteps: [], technologies: [], content: { ...CONTENT, problem: null } }),
      others: [],
    });
    expect(view.included).toBeNull();
    expect(view.process).toBeNull();
    expect(view.technology).toBeNull();
    expect(view.proof).toBeNull();
    expect(view.industries).toBeNull();
    expect(view.testimonial).toBeNull();
    expect(view.faq).toBeNull();
    expect(view.problem).toBeNull();
  });

  it('fails the contract on malformed copy, deliverables, steps or answer block', () => {
    const faqHeading = { ...CONTENT, faq: { heading: 'Frequently asked questions' } };
    expect(() => toServiceDetailView({ service: service({ content: faqHeading }), others: [] })).toThrow(ZodError);
    expect(() => toServiceDetailView({ service: service({ deliverables: [''] }), others: [] })).toThrow(ZodError);
    expect(() => toServiceDetailView({ service: service({ processSteps: [{ title: 'No duration' }] }), others: [] })).toThrow(ZodError);
    expect(() => toServiceDetailView({ service: service({ answerBlock: 'One sentence only.' }), others: [] })).toThrow(ZodError);
  });

  it('loads only consented testimonials and published projects and industries', () => {
    expect(serviceDetailInclude.projects.include.testimonials.where).toBe(CONSENTED);
    expect(serviceDetailInclude.projects.where).toEqual({ status: 'PUBLISHED', deletedAt: null });
    expect(serviceDetailInclude.industries.where).toEqual({ status: 'PUBLISHED' });
  });

  it('shows at most three case studies, skipping projects without figures', () => {
    const view = toServiceDetailView({
      service: service({
        projects: [
          project('no-figures', { outcomeMetrics: [] }),
          project('broken-figures', { outcomeMetrics: 'not a list' }),
          project('b'),
          project('c', { clientAlias: 'A regional distributor' }),
          project('d'),
          project('e'),
        ],
      }),
      others: [],
    });
    expect(view.proof?.caseStudies.map((study) => study.slug)).toEqual(['b', 'c', 'd']);
    expect(view.proof?.caseStudies[1]?.clientName).toBe('A regional distributor');
  });

  it('keeps at most eight FAQs, leaving out any not written as a question', () => {
    const faqs = [faq('statement', 'We sign NDAs'), ...Array.from({ length: 10 }, (_, index) => faq(`q${String(index)}`, 'Do you sign NDAs?'))];
    const view = toServiceDetailView({ service: service({ faqs }), others: [] });
    expect(view.faq?.items).toHaveLength(8);
    expect(view.faq?.items.some((item) => item.id === 'statement')).toBe(false);
  });

  it('relates services from the same category first, then others, three at most', () => {
    const view = toServiceDetailView({
      service: service(),
      others: [card('growth-1', 'cat-growth', 1), card('build-1', 'cat-build'), card('none-1', null), card('build-2', 'cat-build'), card('svc', 'cat-build')],
    });
    expect(view.related?.items.map((item) => item.slug)).toEqual(['build-1', 'build-2', 'growth-1']);
    expect(view.related?.items[2]?.priceLabel).toBe('From $1,500 a month');
  });

  it('uses the record SEO fields, or clips the title and summary to fit', () => {
    const long = 'word '.repeat(60);
    const fallback = toServiceDetailView({ service: service({ title: `Service ${'x'.repeat(70)}`, shortDescription: long }), others: [] });
    expect(fallback.seo.title.length).toBeLessThanOrEqual(60);
    expect(fallback.seo.description.length).toBeLessThanOrEqual(155);
    const own = toServiceDetailView({
      service: service({ seo: { title: 'Own title', description: 'Own description.', ogImage: '/media/og.png' } }),
      others: [],
    });
    expect(own.seo).toEqual({ title: 'Own title', description: 'Own description.', ogImage: '/media/og.png' });
  });
});

describe('clip', () => {
  it('cuts at a word and marks the cut', () => {
    expect(clip('  short  text ', 20)).toBe('short text');
    expect(clip('A sentence that is much too long to fit', 20)).toBe('A sentence that is…');
  });
});

const INDEX: ServicesIndexContentInput = {
  seo: { title: 'Services', description: 'What we build.' },
  title: 'Services',
  answerBlock: 'We design and build websites and web applications. Every project runs on a fixed scope and price.',
  intro: 'Pick a service.',
  groupHeadings: { 'design-and-build': 'Do you need a new website or a web application?', retired: 'Which retired services?' },
  otherGroupName: 'More services',
  otherGroupHeading: 'Which other services do you offer?',
  empty: 'No services are published yet.',
  cardLinkLabel: 'See the service',
  guidance: { heading: 'Not sure which one you need?', body: 'Ask us.', primaryCta: { label: 'Contact us', href: '/contact/' } },
};

describe('toServicesIndexView', () => {
  const categories = [
    { id: 'cat-build', slug: 'design-and-build', name: 'Design and build', description: 'Sites and apps.' },
    { id: 'cat-empty', slug: 'empty', name: 'Empty', description: null },
    { id: 'cat-growth', slug: 'growth-and-care', name: 'Growth and care', description: '  ' },
  ];

  it('groups services by category in order, leaves empty categories out and puts uncategorised services last', () => {
    const view = toServicesIndexView({
      contentSetting: INDEX,
      categories,
      services: [card('a', 'cat-growth'), card('b', null), card('c', 'cat-build'), card('d', 'cat-deleted')],
    });
    expect(view.groups.map((group) => [group.slug, group.name, group.services.map((item) => item.slug)])).toEqual([
      ['design-and-build', 'Design and build', ['c']],
      ['growth-and-care', 'Growth and care', ['a']],
      [null, 'More services', ['b', 'd']],
    ]);
    expect(view.groups.map((group) => group.heading)).toEqual([
      'Do you need a new website or a web application?',
      'Which services are in Growth and care?',
      'Which other services do you offer?',
    ]);
    expect(view.groups[1]?.description).toBeNull();
    expect(view.groups[0]?.services[0]?.updatedAt).toBe(at.toISOString());
  });

  it('builds a question from the name when the copy has no heading for the other group', () => {
    const view = toServicesIndexView({ contentSetting: { ...INDEX, otherGroupHeading: null }, categories, services: [card('b', null)] });
    expect(view.groups.map((group) => group.heading)).toEqual(['Which services are in More services?']);
  });

  it('has no groups when nothing is published', () => {
    expect(toServicesIndexView({ contentSetting: INDEX, categories, services: [] }).groups).toEqual([]);
  });

  it(`fails without a valid "${SERVICES_SETTING_KEYS.index}" setting`, () => {
    expect(() => toServicesIndexView({ contentSetting: null, categories, services: [] })).toThrow(ZodError);
  });
});
