import type { CompanyReviewSummary, CompanyTeamMember, CompanyTestimonial } from '@calwebtech/shared';
import { organizationId, type JsonLdObject } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';

/*
 * Structured data for the company pages (docs/04-seo-keyword-map.md, "Schema per template").
 * Every node refers to the site's Organization by its id rather than repeating it; the site
 * layout renders that node once.
 */

const CONTEXT = 'https://schema.org';

/** The about page, describing the Organization node. */
export function aboutPageJsonLd(input: { path: string; name: string; description: string }): JsonLdObject {
  const url = absoluteUrl(input.path);
  return {
    '@context': CONTEXT,
    '@type': 'AboutPage',
    '@id': `${url}#page`,
    url,
    name: input.name,
    description: input.description,
    about: { '@id': organizationId() },
  };
}

/** A person on the team, working for the Organization. */
export function personJsonLd(member: CompanyTeamMember, pagePath: string): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': `${absoluteUrl(pagePath)}#${member.slug}`,
    name: member.name,
    jobTitle: member.role,
    worksFor: { '@id': organizationId() },
    ...(member.bio ? { description: member.bio } : {}),
    ...(member.photo ? { image: absoluteUrl(member.photo.src) } : {}),
    ...(member.skills.length > 0 ? { knowsAbout: [...member.skills] } : {}),
    ...(member.socials.length > 0 ? { sameAs: member.socials.map((social) => social.href) } : {}),
  };
}

/** A published client testimonial as a Review of the Organization. */
export function testimonialReviewJsonLd(testimonial: CompanyTestimonial): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Review',
    itemReviewed: { '@id': organizationId() },
    reviewBody: testimonial.quote,
    reviewRating: { '@type': 'Rating', ratingValue: testimonial.rating, bestRating: 5, worstRating: 1 },
    author: {
      '@type': 'Person',
      name: testimonial.clientName,
      ...(testimonial.role ? { jobTitle: testimonial.role } : {}),
      ...(testimonial.company ? { worksFor: { '@type': 'Organization', name: testimonial.company } } : {}),
    },
    ...(testimonial.date ? { datePublished: testimonial.date } : {}),
  };
}

/** The weighted platform rating, or nothing when no reviews are published. */
export function aggregateRatingJsonLd(reviews: CompanyReviewSummary): JsonLdObject | null {
  if (reviews.averageRating === null || reviews.totalReviews === 0) return null;
  return {
    '@context': CONTEXT,
    '@type': 'AggregateRating',
    itemReviewed: { '@id': organizationId() },
    ratingValue: reviews.averageRating,
    reviewCount: reviews.totalReviews,
    bestRating: 5,
    worstRating: 1,
  };
}

/** Review and AggregateRating nodes, only for reviews that exist. */
export function testimonialsJsonLd(reviews: CompanyReviewSummary, testimonials: readonly CompanyTestimonial[]): JsonLdObject[] {
  const aggregate = aggregateRatingJsonLd(reviews);
  return [...(aggregate ? [aggregate] : []), ...testimonials.map(testimonialReviewJsonLd)];
}
