import type { TestimonialView } from '@calwebtech/shared';
import { absoluteUrl, type JsonLdObject, organizationId } from '@/lib/seo/json-ld';

const CONTEXT = 'https://schema.org';

/** Google shows at most 110 characters of an Article headline. */
const HEADLINE_MAX = 110;

export interface CaseStudyArticleInput {
  headline: string;
  description: string;
  path: string;
  image: string | null;
  datePublished: string;
  dateModified: string;
  /** Services the project used, as what the article is about. */
  about?: readonly string[];
}

/** The case study as an Article written and published by the company (docs/04, Schema per template). */
export function caseStudyArticleJsonLd(input: CaseStudyArticleInput): JsonLdObject {
  const url = absoluteUrl(input.path);
  const headline = input.headline.length > HEADLINE_MAX ? `${input.headline.slice(0, HEADLINE_MAX - 1).trimEnd()}…` : input.headline;
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    '@id': `${url}#article`,
    headline,
    description: input.description,
    url,
    mainEntityOfPage: url,
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: { '@id': organizationId() },
    publisher: { '@id': organizationId() },
    ...(input.about && input.about.length > 0 ? { about: input.about.map((name) => ({ '@type': 'Thing', name })) } : {}),
  };
}

/**
 * The client's quote as a Review of the company. Only for a testimonial the client consented
 * to publish, which is the only kind the API returns.
 */
export function caseStudyReviewJsonLd(quote: TestimonialView, path: string): JsonLdObject {
  const url = absoluteUrl(path);
  return {
    '@context': CONTEXT,
    '@type': 'Review',
    '@id': `${url}#review`,
    url,
    reviewBody: quote.quote,
    reviewRating: { '@type': 'Rating', ratingValue: quote.rating, bestRating: 5, worstRating: 1 },
    author: {
      '@type': 'Person',
      name: quote.clientName,
      ...(quote.role ? { jobTitle: quote.role } : {}),
      ...(quote.company ? { worksFor: { '@type': 'Organization', name: quote.company } } : {}),
    },
    itemReviewed: { '@id': organizationId() },
  };
}
