import type { CompanyReviewSummary, CompanyTestimonial } from '@calwebtech/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aboutPageJsonLd, personJsonLd, testimonialsJsonLd } from './structured-data';

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const organization = { '@id': 'https://www.calwebtech.com/#organization' };

const noReviews: CompanyReviewSummary = { averageRating: null, totalReviews: 0, sources: [], npsScore: null, npsProjectCount: null };

const testimonial: CompanyTestimonial = {
  id: 't1',
  quote: 'Test quote.',
  clientName: 'Test reviewer',
  role: 'Test role',
  company: 'Test company',
  rating: 5,
  avatar: null,
  source: null,
  date: '2026-02-01',
  featured: false,
  caseStudySlug: null,
};

describe('testimonialsJsonLd', () => {
  it('has no nodes when there are no reviews or testimonials', () => {
    expect(testimonialsJsonLd(noReviews, [])).toEqual([]);
  });

  it('rates the Organization by reference, and writes one Review per published testimonial', () => {
    const nodes = testimonialsJsonLd({ ...noReviews, averageRating: 4.9, totalReviews: 20 }, [testimonial]);
    expect(nodes).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'AggregateRating',
        itemReviewed: organization,
        ratingValue: 4.9,
        reviewCount: 20,
        bestRating: 5,
        worstRating: 1,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Review',
        itemReviewed: organization,
        reviewBody: 'Test quote.',
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
        author: {
          '@type': 'Person',
          name: 'Test reviewer',
          jobTitle: 'Test role',
          worksFor: { '@type': 'Organization', name: 'Test company' },
        },
        datePublished: '2026-02-01',
      },
    ]);
    expect(nodes.some((node) => node['@type'] === 'Organization')).toBe(false);
  });
});

describe('personJsonLd and aboutPageJsonLd', () => {
  it('describes a team member who works for the Organization, with absolute URLs', () => {
    expect(
      personJsonLd(
        {
          slug: 'test-person',
          name: 'Test person',
          role: 'Test role',
          bio: null,
          photo: { src: '/media/person.jpg', alt: 'Test person' },
          skills: [],
          socials: [],
        },
        '/team/',
      ),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': 'https://www.calwebtech.com/team/#test-person',
      name: 'Test person',
      jobTitle: 'Test role',
      worksFor: organization,
      image: 'https://www.calwebtech.com/media/person.jpg',
    });
  });

  it('points the about page at the Organization', () => {
    expect(aboutPageJsonLd({ path: '/about/', name: 'About', description: 'Test.' })).toMatchObject({
      '@type': 'AboutPage',
      url: 'https://www.calwebtech.com/about/',
      about: organization,
    });
  });
});
