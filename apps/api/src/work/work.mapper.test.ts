import { Prisma, type ReviewSource, type Statistic, type Testimonial } from '@calwebtech/db';
import type { WorkCopyInput } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CONSENTED } from '../common/published';
import {
  WorkContractError,
  caseStudyReadiness,
  caseStudyTags,
  fitText,
  galleryImages,
  paragraphs,
  toBeforeAndAfterView,
  toCaseStudyView,
  toWorkIndexView,
  videoTestimonialView,
  workProjectInclude,
  workVideoTestimonialQuery,
  type WorkComparisonRecord,
  type WorkProjectRecord,
} from './work.mapper';

const at = new Date('2026-09-01T00:00:00Z');

const heading = (topic: string) => `What about the ${topic} for {client}?`;

/** Test copy: valid against workCopySchema, and obviously not publishable. */
const COPY: WorkCopyInput = {
  index: {
    seo: { title: 'Test work index', description: 'Test description of the work index.' },
    eyebrow: 'Test eyebrow',
    title: 'Test work index',
    intro: 'Test introduction to the work index.',
    highlightsLabel: 'Test highlights',
    summaryLabels: { caseStudies: 'Case studies', industries: 'Industries', services: 'Services', platforms: 'Platforms' },
    filters: { label: 'Filter', industry: 'Industry', service: 'Service', platform: 'Platform', all: 'All', clear: 'Clear' },
    resultsHeading: 'Which test case studies match?',
    empty: 'No test case studies yet.',
    noMatches: 'No test case studies match.',
    caseStudyLabel: 'Read it',
    proofHeading: 'What does the test proof say?',
    ratingLabel: 'Test rating',
  },
  caseStudy: {
    eyebrow: 'Case study',
    headlineLabel: 'Headline result',
    headings: {
      metrics: heading('metrics'),
      atAGlance: heading('overview'),
      challenge: heading('challenge'),
      approach: heading('approach'),
      build: heading('build'),
      gallery: 'What does the test gallery show?',
      beforeAfter: heading('comparison'),
      outcome: heading('outcome'),
      quote: heading('quote'),
      relatedServices: 'Which test services apply?',
      relatedCaseStudies: 'Which test projects are related?',
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
      measurement: 'How we measured',
      serviceLink: 'See the service',
      caseStudyLink: 'Read the case study',
      comparison: 'Measured before and after',
      before: 'Before',
      after: 'After',
    },
    measurement: 'Test measurement method.',
  },
  beforeAndAfter: {
    seo: { title: 'Test before and after', description: 'Test description of the before and after page.' },
    eyebrow: 'Test eyebrow',
    title: 'Test before and after',
    intro: 'Test introduction to the comparisons.',
    comparisonHeading: 'What changed for {client}?',
    metricsLabel: 'Measured',
    beforeLabel: 'Before',
    afterLabel: 'After',
    caseStudyLabel: 'Read the case study',
    empty: 'No test comparisons yet.',
    emptyAction: { label: 'See the work', href: '/work/' },
  },
};

const ANSWER =
  'Test client needed a test platform built for a test audience. We built it with test tools and test methods. The test figures below show what changed.';

const METRICS = [
  { value: '1', label: 'First test figure' },
  { value: '2', label: 'Second test figure' },
  { value: '3', label: 'Third test figure' },
];

function testimonial(overrides: Partial<Testimonial> = {}): Testimonial {
  return {
    id: 'testimonial-1',
    clientName: 'Test person',
    role: 'Test role',
    company: 'Test company',
    avatarUrl: null,
    rating: 5,
    quote: 'Test quote.',
    source: 'test',
    videoUrl: null,
    featured: false,
    consentAt: at,
    date: at,
    createdAt: at,
    updatedAt: at,
    projectId: null,
    ...overrides,
  };
}

function project(slug: string, overrides: Partial<WorkProjectRecord> = {}): WorkProjectRecord {
  return {
    id: slug,
    title: `Test project ${slug}`,
    slug,
    clientName: `Client ${slug}`,
    clientAlias: null,
    answerBlock: ANSWER,
    summary: 'Test project summary.',
    liveUrl: null,
    location: 'Test City, USA',
    segment: 'B2B, Test sector',
    coverImageUrl: 'https://images.example.com/cover.jpg',
    coverImageAlt: 'Test cover image',
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics: METRICS,
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
    industryId: null,
    industry: { slug: 'test-industry', name: 'Test industry', status: 'PUBLISHED' },
    services: [{ slug: 'test-service', title: 'Test service', shortDescription: 'Test service summary.' }],
    technologies: [{ slug: 'test-platform', name: 'Test platform' }],
    testimonials: [],
    ...overrides,
  };
}

function comparison(slug: string, overrides: Partial<WorkComparisonRecord> = {}): WorkComparisonRecord {
  return {
    slug,
    clientName: `Client ${slug}`,
    clientAlias: null,
    summary: 'Test comparison summary.',
    answerBlock: ANSWER,
    outcomeMetrics: METRICS,
    beforeImageUrl: '/media/before.jpg',
    afterImageUrl: '/media/after.jpg',
    beforeAfterMetrics: [{ label: 'Test measure', before: 'A', after: 'B' }],
    ...overrides,
  };
}

const statistic = (label: string, value: string, suffix: string | null): Statistic => ({
  id: label,
  label,
  value,
  suffix,
  order: 0,
});

const review = (platform: string, rating: number, reviewCount: number): ReviewSource => ({
  id: platform,
  platform,
  rating: new Prisma.Decimal(rating),
  reviewCount,
  profileUrl: null,
  refreshedAt: at,
});

describe('caseStudyReadiness', () => {
  it('needs three well-formed figures and a two or three sentence answer block', () => {
    expect(caseStudyReadiness(project('ready'))).toEqual({ ready: true, metrics: METRICS });
    expect(caseStudyReadiness(project('two', { outcomeMetrics: METRICS.slice(0, 2) })).ready).toBe(false);
    expect(caseStudyReadiness(project('missing', { outcomeMetrics: [] })).ready).toBe(false);
    expect(caseStudyReadiness(project('malformed', { outcomeMetrics: [{ value: '1' }, ...METRICS] })).ready).toBe(false);
    expect(caseStudyReadiness(project('short', { answerBlock: 'Test fixture.' })).ready).toBe(false);
  });
});

describe('caseStudyTags', () => {
  it('uses the location, each segment and the platforms, without repeats, at most four', () => {
    expect(caseStudyTags(project('tags'))).toEqual(['Test City, USA', 'B2B', 'Test sector', 'Test platform']);
    expect(
      caseStudyTags(
        project('few', { location: null, segment: ' , D2C,', technologies: [{ slug: 'a', name: 'D2C' }] }),
      ),
    ).toEqual(['D2C']);
  });
});

describe('toWorkIndexView', () => {
  it('lists ready case studies with three figures and the filter values they carry', () => {
    const view = toWorkIndexView({
      copySetting: COPY,
      projects: [
        project('first', { outcomeMetrics: [...METRICS, { value: '4', label: 'Fourth test figure' }] }),
        project('not-ready', {
          outcomeMetrics: METRICS.slice(0, 1),
          industry: { slug: 'hidden-industry', name: 'Hidden', status: 'PUBLISHED' },
        }),
        project('second', {
          industry: { slug: 'draft-industry', name: 'Draft industry', status: 'DRAFT' },
          services: [
            { slug: 'another-service', title: 'Another service', shortDescription: 'Another summary.' },
            { slug: 'test-service', title: 'Test service', shortDescription: 'Test service summary.' },
          ],
          coverImageAlt: null,
        }),
      ],
      statistics: [],
      reviewSources: [],
    });

    expect(view.caseStudies.map((card) => card.slug)).toEqual(['first', 'second']);
    expect(view.caseStudies[0]?.metrics).toHaveLength(3);
    expect(view.caseStudies[1]).toMatchObject({ industry: null, image: null, services: ['another-service', 'test-service'] });
    expect(view.filters).toEqual({
      industries: [{ slug: 'test-industry', name: 'Test industry' }],
      services: [
        { slug: 'another-service', name: 'Another service' },
        { slug: 'test-service', name: 'Test service' },
      ],
      platforms: [{ slug: 'test-platform', name: 'Test platform' }],
    });
    expect(view.proof).toEqual({ statistics: [], rating: null });
  });

  it('renders an empty listing when nothing is published', () => {
    const view = toWorkIndexView({ copySetting: COPY, projects: [], statistics: [], reviewSources: [] });
    expect(view.caseStudies).toEqual([]);
    expect(view.filters).toEqual({ industries: [], services: [], platforms: [] });
  });

  it('carries the proof band: up to four statistics and the weighted rating', () => {
    const view = toWorkIndexView({
      copySetting: COPY,
      projects: [],
      statistics: [
        statistic('One', '1', '+'),
        statistic('Two', '2', null),
        statistic('Three', '3', null),
        statistic('Four', '4', null),
        statistic('Five', '5', null),
      ],
      reviewSources: [review('Test platform', 5, 3), review('Other platform', 4, 1)],
    });
    expect(view.proof.statistics).toHaveLength(4);
    expect(view.proof.statistics[0]).toEqual({ value: '1+', label: 'One' });
    expect(view.proof.rating).toEqual({ average: 4.8, reviewCount: 4 });
  });

  it('names the setting or record that breaks the contract', () => {
    expect(() => toWorkIndexView({ copySetting: null, projects: [], statistics: [], reviewSources: [] })).toThrow(
      /work\.copy/,
    );
    const broken = () =>
      toWorkIndexView({
        copySetting: COPY,
        projects: [project('broken', { summary: '' })],
        statistics: [],
        reviewSources: [],
      });
    expect(broken).toThrow(WorkContractError);
    expect(broken).toThrow('Project "broken"');
  });
});

describe('toCaseStudyView', () => {
  it('builds every section with content and fills the client name into the headings', () => {
    const view = toCaseStudyView({
      copySetting: COPY,
      project: project('full', {
        clientAlias: 'Alias client',
        challenge: 'First paragraph.\n\nSecond   paragraph.',
        approach: 'Approach.',
        buildNotes: 'Build.',
        outcome: 'Outcome.',
        gallery: [{ src: '/media/one.jpg', alt: 'First screen' }, '/media/no-alt.jpg', { src: '/media/two.jpg' }],
        beforeImageUrl: '/media/before.jpg',
        afterImageUrl: '/media/after.jpg',
        beforeAfterMetrics: [{ label: 'Test measure', before: 'A', after: 'B' }],
        liveUrl: 'https://www.example.com/',
        year: 2025,
        duration: 'Test duration',
        testimonials: [testimonial()],
        seo: { title: 'Custom test title' },
      }),
      others: [],
    });

    expect(view.clientName).toBe('Alias client');
    expect(view.headings.challenge).toBe('What about the challenge for Alias client?');
    expect(view.headline).toEqual({ label: 'Headline result', metric: METRICS[0] });
    expect(view.challenge).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(view.gallery).toEqual([{ src: '/media/one.jpg', alt: 'First screen' }]);
    expect(view.beforeAfter?.before.alt).toBe('Alias client website before the redesign');
    expect(view.atAGlance).toMatchObject({ year: 2025, liveUrl: 'https://www.example.com/', location: 'Test City, USA' });
    expect(view.quote?.clientName).toBe('Test person');
    expect(view.relatedServices).toEqual([{ slug: 'test-service', name: 'Test service', summary: 'Test service summary.' }]);
    expect(view.seo).toEqual({
      title: 'Custom test title',
      description: 'Test project summary.',
      ogImage: 'https://images.example.com/cover.jpg',
    });
  });

  it('leaves out sections with no content, and figures past six', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ value: String(index), label: `Figure ${String(index)}` }));
    const view = toCaseStudyView({
      copySetting: COPY,
      project: project('bare', { outcomeMetrics: many, industry: null, services: [], technologies: [], coverImageUrl: null }),
      others: [],
    });
    expect(view.metrics).toHaveLength(6);
    expect(view).toMatchObject({
      challenge: null,
      approach: null,
      build: null,
      outcome: null,
      beforeAfter: null,
      quote: null,
      videoTestimonial: null,
      cover: null,
      gallery: [],
      relatedServices: [],
      relatedCaseStudies: [],
    });
    expect(view.atAGlance).toEqual({
      industry: null,
      services: [],
      platforms: [],
      location: 'Test City, USA',
      duration: null,
      year: null,
      liveUrl: null,
    });
  });

  it('shows no quote without consent: the query loads consented testimonials only', () => {
    expect(workProjectInclude(at).testimonials.where).toEqual(CONSENTED);
    const unconsented = toCaseStudyView({
      copySetting: COPY,
      project: project('no-consent', { testimonials: [testimonial({ consentAt: null })] }),
      others: [],
    });
    expect(unconsented.quote).toBeNull();
    const consented = toCaseStudyView({
      copySetting: COPY,
      project: project('consent', { testimonials: [testimonial()] }),
      others: [],
    });
    expect(consented.quote?.quote).toBe('Test quote.');
  });

  it('adds the client on camera from a consented testimonial with a video, over the cover', () => {
    expect(workVideoTestimonialQuery('project-1').where).toEqual({
      projectId: 'project-1',
      ...CONSENTED,
      videoUrl: { not: null },
    });

    const video = testimonial({ id: 'video', videoUrl: 'https://videos.example.com/client.mp4' });
    const view = toCaseStudyView({ copySetting: COPY, project: project('video'), others: [], videoTestimonial: video });
    expect(view.videoTestimonial).toEqual({
      clientName: 'Test person',
      role: 'Test role',
      company: 'Test company',
      poster: { src: 'https://images.example.com/cover.jpg', alt: 'Test cover image' },
      videoUrl: 'https://videos.example.com/client.mp4',
    });

    const withoutCover = toCaseStudyView({
      copySetting: COPY,
      project: project('video-no-cover', { coverImageUrl: null }),
      others: [],
      videoTestimonial: video,
    });
    expect(withoutCover.videoTestimonial?.poster).toBeNull();
  });

  it('shows no video testimonial without consent or without a usable video', () => {
    const poster = { src: '/media/cover.jpg', alt: 'Cover' };
    expect(videoTestimonialView(null, poster)).toBeNull();
    expect(videoTestimonialView(testimonial({ videoUrl: '/media/client.mp4', consentAt: null }), poster)).toBeNull();
    expect(videoTestimonialView(testimonial({ videoUrl: null }), poster)).toBeNull();
    expect(videoTestimonialView(testimonial({ videoUrl: 'not a url' }), poster)).toBeNull();
    expect(videoTestimonialView(testimonial({ videoUrl: '/media/client.mp4' }), poster)?.videoUrl).toBe('/media/client.mp4');
  });

  it('picks related case studies that share the industry or services first, skipping incomplete ones', () => {
    const unrelated = project('unrelated', {
      industry: { slug: 'other', name: 'Other', status: 'PUBLISHED' },
      services: [],
      technologies: [],
    });
    const view = toCaseStudyView({
      copySetting: COPY,
      project: project('current'),
      others: [
        unrelated,
        project('incomplete', { outcomeMetrics: [] }),
        project('same-service', { industry: null }),
        project('same-industry'),
        project('current'),
      ],
    });
    expect(view.relatedCaseStudies.map((card) => card.slug)).toEqual(['same-industry', 'same-service', 'unrelated']);
  });

  it('refuses an incomplete project and a malformed record', () => {
    expect(() => toCaseStudyView({ copySetting: COPY, project: project('short', { answerBlock: 'Short.' }), others: [] })).toThrow(
      WorkContractError,
    );
    expect(() =>
      toCaseStudyView({ copySetting: COPY, project: project('bad-url', { liveUrl: 'not a url' }), others: [] }),
    ).toThrow('Project "bad-url"');
    const error = (() => {
      try {
        toCaseStudyView({ copySetting: { index: {} }, project: project('copy'), others: [] });
      } catch (caught) {
        return caught;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(WorkContractError);
    expect((error as WorkContractError).cause).toBeInstanceOf(ZodError);
  });
});

describe('toBeforeAndAfterView', () => {
  it('links a comparison to its case study only when the project has one', () => {
    const view = toBeforeAndAfterView({
      copySetting: COPY,
      projects: [
        comparison('with-page'),
        comparison('pair-only', { answerBlock: 'Test fixture.' }),
        comparison('one-image', { afterImageUrl: null }),
      ],
    });
    expect(view.comparisons.map((item) => [item.slug, item.clientName])).toEqual([
      ['with-page', 'Client with-page'],
      [null, 'Client pair-only'],
    ]);
    expect(view.comparisons[0]?.heading).toBe('What changed for Client with-page?');
    expect(view.copy).not.toHaveProperty('comparisonHeading');
  });

  it('renders an empty page when no pair is published', () => {
    expect(toBeforeAndAfterView({ copySetting: COPY, projects: [] }).comparisons).toEqual([]);
  });
});

describe('text helpers', () => {
  it('splits long text into paragraphs', () => {
    expect(paragraphs(null)).toBeNull();
    expect(paragraphs('  \n\n ')).toBeNull();
    expect(paragraphs('One\nline.\n\n\nTwo.')).toEqual(['One line.', 'Two.']);
  });

  it('keeps gallery images that have alt text', () => {
    expect(galleryImages({ src: '/a.jpg', alt: 'A' })).toEqual([]);
    expect(galleryImages([{ src: '/a.jpg', alt: ' ' }, { src: '/b.jpg', alt: 'B' }])).toEqual([{ src: '/b.jpg', alt: 'B' }]);
  });

  it('fits SEO fallbacks within their limit at a word boundary', () => {
    expect(fitText('Short enough', 60)).toBe('Short enough');
    const fitted = fitText('A summary that runs well past the limit set for a description field', 40);
    expect(fitted.length).toBeLessThanOrEqual(40);
    expect(fitted.endsWith('…')).toBe(true);
    expect(fitted).toBe('A summary that runs well past the limit…');
  });
});
