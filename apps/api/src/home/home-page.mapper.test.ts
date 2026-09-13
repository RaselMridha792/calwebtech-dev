import { Prisma, type ReviewSource, type Technology, type Testimonial } from '@calwebtech/db';
import { HOME_CONTENT, PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { toHomePageView, type HomePageSources, type HomeProjectRecord } from './home-page.mapper';

const at = new Date('2026-09-01T00:00:00Z');
let sequence = 0;

function sources(overrides: Partial<HomePageSources> = {}): HomePageSources {
  return {
    contentSetting: HOME_CONTENT,
    contactSetting: PLACEHOLDER_CONTACT,
    proofSetting: null,
    indexingSetting: null,
    reviewSources: [],
    clientLogos: [],
    statistics: [],
    categories: [],
    services: [],
    industries: [],
    problemRouter: [],
    projects: [],
    technologies: [],
    processSteps: [],
    testimonials: [],
    awards: [],
    posts: [],
    guide: null,
    locations: [],
    pricingTiers: [],
    ...overrides,
  };
}

function project(overrides: Partial<HomeProjectRecord> = {}): HomeProjectRecord {
  sequence += 1;
  const id = `project-${String(sequence)}`;
  return {
    id,
    title: 'Test project',
    slug: id,
    clientName: 'Test client',
    clientAlias: null,
    answerBlock: 'Test answer block.',
    summary: 'Test project summary.',
    liveUrl: null,
    location: null,
    segment: null,
    coverImageUrl: null,
    coverImageAlt: null,
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics: [{ value: '10', label: 'Test figure' }],
    duration: null,
    year: null,
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
    industry: null,
    testimonials: [],
    ...overrides,
  };
}

function testimonial(overrides: Partial<Testimonial> = {}): Testimonial {
  sequence += 1;
  return {
    id: `testimonial-${String(sequence)}`,
    clientName: 'Test reviewer',
    role: null,
    company: null,
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

function technology(name: string, category: string): Technology {
  sequence += 1;
  return {
    id: `technology-${String(sequence)}`,
    name,
    slug: `technology-${String(sequence)}`,
    logoUrl: null,
    category,
    proficiencyNote: null,
    order: 0,
  };
}

describe('toHomePageView', () => {
  it('is noindex unless the indexing setting is exactly { index: true }', () => {
    expect(toHomePageView(sources()).indexable).toBe(false);
    expect(toHomePageView(sources({ indexingSetting: { index: 'yes' } })).indexable).toBe(false);
    expect(toHomePageView(sources({ indexingSetting: { index: false } })).indexable).toBe(false);
    expect(toHomePageView(sources({ indexingSetting: { index: true } })).indexable).toBe(true);
  });

  it('leaves out featured projects without outcome figures', () => {
    const view = toHomePageView(
      sources({
        projects: [
          project({ slug: 'no-figures', outcomeMetrics: [] }),
          project({ slug: 'malformed-figures', outcomeMetrics: { value: '10' } }),
          project({ slug: 'with-figures' }),
        ],
      }),
    );
    expect(view.projects.map((card) => card.slug)).toEqual(['with-figures']);
  });

  it('does not repeat a project card quote, and takes the pull quote from the remaining featured ones', () => {
    const onCard = testimonial({ featured: true });
    const featured = testimonial({ featured: true });
    const others = [testimonial(), testimonial(), testimonial(), testimonial()];
    const view = toHomePageView(
      sources({ projects: [project({ testimonials: [onCard] })], testimonials: [onCard, featured, ...others] }),
    );

    expect(view.projects[0]?.quote?.id).toBe(onCard.id);
    expect(view.pullQuote?.id).toBe(featured.id);
    expect(view.testimonials.map((quote) => quote.id)).toEqual(others.slice(0, 3).map((quote) => quote.id));
  });

  it('has no pull quote when no remaining testimonial is featured', () => {
    const quotes = [testimonial(), testimonial()];
    const view = toHomePageView(sources({ testimonials: quotes }));
    expect(view.pullQuote).toBeNull();
    expect(view.testimonials.map((quote) => quote.id)).toEqual(quotes.map((quote) => quote.id));
  });

  it('takes before and after from the first project with both screenshots', () => {
    const view = toHomePageView(
      sources({
        projects: [
          project({ clientName: 'Before only client', beforeImageUrl: '/media/before-only.png' }),
          project({
            beforeImageUrl: '/media/before.png',
            afterImageUrl: '/media/after.png',
            beforeAfterMetrics: [{ label: 'Test measure', before: '4', after: '2' }],
          }),
          project({
            clientName: 'Later client',
            beforeImageUrl: '/media/later-before.png',
            afterImageUrl: '/media/later-after.png',
          }),
        ],
      }),
    );
    expect(view.beforeAfter).toEqual({
      clientName: 'Test client',
      before: { src: '/media/before.png', alt: 'Test client website before the redesign' },
      after: { src: '/media/after.png', alt: 'Test client website after the redesign' },
      metrics: [{ label: 'Test measure', before: '4', after: '2' }],
    });
  });

  it('has no before and after when no project has both screenshots', () => {
    const view = toHomePageView(
      sources({
        projects: [project({ beforeImageUrl: '/media/before.png' }), project({ afterImageUrl: '/media/after.png' })],
      }),
    );
    expect(view.beforeAfter).toBeNull();
  });

  it('groups technologies by category under readable labels', () => {
    const view = toHomePageView(
      sources({
        technologies: [
          technology('Test framework', 'frontend'),
          technology('Test server', 'backend'),
          technology('Test library', 'frontend'),
          technology('Test tool', 'uncategorised'),
        ],
      }),
    );
    expect(view.technologyGroups).toEqual([
      { category: 'Front end', names: ['Test framework', 'Test library'] },
      { category: 'Back end', names: ['Test server'] },
      { category: 'uncategorised', names: ['Test tool'] },
    ]);
  });

  it('throws on malformed homepage copy rather than rendering half a page', () => {
    expect(() => toHomePageView(sources({ contentSetting: { ...HOME_CONTENT, formSuccess: null } }))).toThrow(
      ZodError,
    );
    expect(() => toHomePageView(sources({ contentSetting: null }))).toThrow(ZodError);
  });

  it('carries each platform review count and the NPS sample size', () => {
    const review = (platform: string, rating: number, reviewCount: number): ReviewSource => ({
      id: platform,
      platform,
      rating: new Prisma.Decimal(rating),
      reviewCount,
      profileUrl: null,
      refreshedAt: at,
    });
    const view = toHomePageView(
      sources({
        reviewSources: [review('Test platform A', 4.8, 12), review('Test platform B', 5, 30)],
        proofSetting: { npsScore: 70, npsProjectCount: 9 },
      }),
    );
    expect(view.reviews.sources).toEqual([
      { platform: 'Test platform B', rating: 5, reviewCount: 30 },
      { platform: 'Test platform A', rating: 4.8, reviewCount: 12 },
    ]);
    expect(view.reviews.npsProjectCount).toBe(9);
  });

  it('gives stored copy the defaults of fields added after the first release', () => {
    const { content, press, videoTestimonial } = toHomePageView(sources());
    expect(content.hero.media).toBeNull();
    expect(content.capability.enabled).toBe(true);
    expect(content.midCta.enabled).toBe(true);
    expect(content.mobileMenu.groups).toEqual([]);
    expect(press).toEqual([]);
    expect(videoTestimonial).toBeNull();
  });
});
