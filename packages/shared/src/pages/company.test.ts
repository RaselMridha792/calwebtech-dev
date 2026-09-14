import { describe, expect, it } from 'vitest';
import {
  COMPANY_CONTENT_SCHEMAS,
  COMPANY_FAQ_GROUPS,
  COMPANY_PAGES,
  COMPANY_SETTING_KEYS,
  COMPANY_VIEW_SCHEMAS,
  companyHeroSchema,
  companyTeamContentSchema,
  companyTestimonialSchema,
} from './company';

const hero = {
  title: 'Test page title',
  answerBlock:
    'This is the first sentence of a test answer block for the page. This is the second sentence, which closes it.',
};

const teamContent = {
  seo: { title: 'Test title', description: 'Test description.' },
  hero,
  members: { heading: 'Who works here?', empty: 'Nothing yet.' },
  roles: { heading: 'Who does what?', items: [{ title: 'Who leads?', body: 'Test body.' }] },
  faq: { heading: 'What do people ask?' },
};

describe('company page keys', () => {
  it('names a setting, a FAQ group and both schemas for every page', () => {
    for (const page of COMPANY_PAGES) {
      expect(COMPANY_SETTING_KEYS[page]).toBe(`company.${page}`);
      expect(COMPANY_FAQ_GROUPS[page]).toBe(`company-${page}`);
      expect(COMPANY_CONTENT_SCHEMAS[page]).toBeDefined();
      expect(COMPANY_VIEW_SCHEMAS[page]).toBeDefined();
    }
  });
});

describe('companyHeroSchema', () => {
  it('fills optional parts with null', () => {
    expect(companyHeroSchema.parse(hero)).toMatchObject({ eyebrow: null, intro: null, primaryCta: null, backdrop: null });
  });

  it('requires a two or three sentence answer block', () => {
    expect(companyHeroSchema.safeParse({ ...hero, answerBlock: 'One sentence only, which is not enough to answer anything.' }).success).toBe(false);
  });

  it('refuses in-page anchors, which would not land on a company page', () => {
    expect(companyHeroSchema.safeParse({ ...hero, primaryCta: { label: 'Book', href: '#book' } }).success).toBe(false);
    expect(companyHeroSchema.safeParse({ ...hero, primaryCta: { label: 'Book', href: '/contact/' } }).success).toBe(true);
  });
});

describe('company content schemas', () => {
  it('require section headings and question cards to be written as questions', () => {
    expect(companyTeamContentSchema.safeParse(teamContent).success).toBe(true);
    expect(
      companyTeamContentSchema.safeParse({ ...teamContent, members: { heading: 'Our people', empty: 'Nothing yet.' } }).success,
    ).toBe(false);
    expect(
      companyTeamContentSchema.safeParse({
        ...teamContent,
        roles: { heading: 'Who does what?', items: [{ title: 'Leadership', body: 'Test body.' }] },
      }).success,
    ).toBe(false);
  });
});

describe('companyTestimonialSchema', () => {
  const testimonial = {
    id: 't',
    quote: 'Test quote.',
    clientName: 'Test reviewer',
    role: null,
    company: null,
    rating: 5,
    avatar: null,
    source: null,
    date: '2026-01-31',
    featured: false,
    caseStudySlug: null,
  };

  it('takes a calendar date and a case study slug', () => {
    expect(companyTestimonialSchema.safeParse(testimonial).success).toBe(true);
    expect(companyTestimonialSchema.safeParse({ ...testimonial, date: '2026-01-31T00:00:00Z' }).success).toBe(false);
    expect(companyTestimonialSchema.safeParse({ ...testimonial, caseStudySlug: 'Not A Slug' }).success).toBe(false);
  });
});
