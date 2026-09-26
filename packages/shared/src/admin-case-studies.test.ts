import { describe, expect, it } from 'vitest';
import { caseStudyTestimonialInputSchema } from './admin-case-studies';

describe('caseStudyTestimonialInputSchema', () => {
  it('keeps a testimonial without a consent date, which the site does not show', () => {
    expect(caseStudyTestimonialInputSchema.parse({ quote: 'Test quote.', clientName: 'Test Person', role: '' })).toEqual({
      quote: 'Test quote.',
      clientName: 'Test Person',
      role: null,
      company: null,
      avatar: null,
      rating: 5,
      videoUrl: null,
      featured: false,
      consentAt: null,
    });
  });

  it('takes a consent date as a day, and refuses anything else', () => {
    expect(caseStudyTestimonialInputSchema.parse({ quote: 'Test.', clientName: 'Test', consentAt: '2026-09-26' }).consentAt).toBe('2026-09-26');
    expect(caseStudyTestimonialInputSchema.safeParse({ quote: 'Test.', clientName: 'Test', consentAt: '26/09/2026' }).success).toBe(false);
    expect(caseStudyTestimonialInputSchema.safeParse({ quote: 'Test.', clientName: 'Test', videoUrl: 'not a url' }).success).toBe(false);
  });
});
