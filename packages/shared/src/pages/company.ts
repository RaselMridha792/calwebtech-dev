import { z } from 'zod';
import { linkSchema } from '../home-page';
import { testimonialViewSchema } from '../landing-page';
import { decorativeImageSchema, imageSchema } from '../media';
import { slugSchema } from '../seo';
import { answerBlockSchema, faqItemSchema, metricSchema, pageSeoSchema, questionSchema, requiredText } from './common';

/**
 * The company family (docs/10-site-pages.md): /about/, /team/, /testimonials/, /awards/,
 * /partners/ and /technology/. None of them has a record of its own, so each page's copy
 * lives in a `Setting` row keyed `company.<page>` and validated by the content schema below.
 * Proof comes from its content types (TeamMember, Testimonial, ReviewSource, Award, Partner,
 * Technology, Statistic, Faq), never from copy.
 */

export const COMPANY_PAGES = ['about', 'team', 'testimonials', 'awards', 'partners', 'technology'] as const;
export type CompanyPage = (typeof COMPANY_PAGES)[number];

/** Setting keys holding each page's copy. A missing row means the page is not published (404). */
export const COMPANY_SETTING_KEYS: Readonly<Record<CompanyPage, string>> = {
  about: 'company.about',
  team: 'company.team',
  testimonials: 'company.testimonials',
  awards: 'company.awards',
  partners: 'company.partners',
  technology: 'company.technology',
};

/** `Faq.group` of the questions answered at the foot of each page. */
export const COMPANY_FAQ_GROUPS: Readonly<Record<CompanyPage, string>> = {
  about: 'company-about',
  team: 'company-team',
  testimonials: 'company-testimonials',
  awards: 'company-awards',
  partners: 'company-partners',
  technology: 'company-technology',
};

/** A link these pages render: a site path or a URL. Bare anchors would not land on another page. */
const companyLinkSchema = linkSchema.refine((link) => !link.href.startsWith('#'), {
  message: 'Link to a page, not an in-page anchor',
  path: ['href'],
});

/** The top of a company page: H1, answer block, intro and calls to action over a backdrop. */
export const companyHeroSchema = z.object({
  eyebrow: requiredText(80).nullable().default(null),
  /** The page's only H1. */
  title: requiredText(90),
  answerBlock: answerBlockSchema,
  intro: requiredText(600).nullable().default(null),
  primaryCta: companyLinkSchema.nullable().default(null),
  secondaryCta: companyLinkSchema.nullable().default(null),
  /** Decorative photograph under the dark hero; preloaded as the LCP image. */
  backdrop: decorativeImageSchema.nullable().default(null),
});

/** A section's H2, written as a question a buyer types, with an optional introduction. */
const sectionSchema = z.object({
  heading: questionSchema(160),
  intro: requiredText(600).nullable().default(null),
});

/** A section listing records, with the line shown while none are published. */
const listSectionSchema = sectionSchema.extend({ empty: requiredText(200) });

/** A question and its answer rendered as a card (values, roles, how a stack is chosen). */
const questionCardSchema = z.object({ title: questionSchema(120), body: requiredText(600) });

// ---------------------------------------------------------------- proof views

export const companyStatisticSchema = z.object({
  value: requiredText(16),
  suffix: z.string().max(4),
  label: requiredText(80),
});

export const companyTeamMemberSchema = z.object({
  slug: slugSchema,
  name: requiredText(120),
  role: requiredText(120),
  bio: requiredText(800).nullable(),
  photo: imageSchema.nullable(),
  skills: z.array(requiredText(60)).max(12),
  socials: z.array(z.object({ label: requiredText(40), href: z.url() })).max(6),
});

export const companyAwardSchema = z.object({
  id: z.string().min(1),
  name: requiredText(160),
  year: z.number().int().min(1990).max(2100),
  category: requiredText(120).nullable(),
  awardingBody: requiredText(120).nullable(),
  projectName: requiredText(160).nullable(),
  description: requiredText(800).nullable(),
  badge: imageSchema.nullable(),
});

export const companyPartnerSchema = z.object({
  id: z.string().min(1),
  name: requiredText(120),
  logo: imageSchema.nullable(),
  tier: requiredText(80).nullable(),
  certification: requiredText(120).nullable(),
  meaningForClient: requiredText(800).nullable(),
  quote: requiredText(600).nullable(),
});

/** A consented testimonial, with where it was given and the published case study it belongs to. */
export const companyTestimonialSchema = testimonialViewSchema.extend({
  source: requiredText(60).nullable(),
  /** ISO date, `YYYY-MM-DD`. */
  date: z.iso.date().nullable(),
  featured: z.boolean(),
  /** Set only when the linked project is published. */
  caseStudySlug: slugSchema.nullable(),
});

/** Ratings from review platforms, weighted by review count, plus the Net Promoter Score. */
export const companyReviewSummarySchema = z.object({
  averageRating: z.number().min(0).max(5).nullable(),
  totalReviews: z.number().int().nonnegative(),
  sources: z.array(
    z.object({
      platform: requiredText(60),
      rating: z.number().min(0).max(5),
      reviewCount: z.number().int().nonnegative(),
      profileUrl: z.url().nullable(),
    }),
  ),
  npsScore: z.number().nullable(),
  npsProjectCount: z.number().int().nonnegative().nullable(),
});

export const companyTechnologySchema = z.object({
  slug: slugSchema,
  name: requiredText(80),
  logo: imageSchema.nullable(),
  proficiencyNote: requiredText(400).nullable(),
});

export const companyTechnologyGroupSchema = z.object({
  /** `Technology.category`, e.g. `frontend`. */
  key: requiredText(60),
  label: requiredText(60),
  summary: requiredText(400).nullable(),
  technologies: z.array(companyTechnologySchema).min(1),
});

const faqsSchema = z.array(faqItemSchema).max(12);

// ---------------------------------------------------------------- /about/

export const companyAboutContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  story: sectionSchema.extend({
    paragraphs: z.array(requiredText(900)).min(1).max(6),
    image: imageSchema.nullable().default(null),
  }),
  /** Over the published statistics; the band is left out when there are none. */
  statistics: sectionSchema,
  /** The link to /team/ is the template's; the copy names it. */
  team: listSectionSchema.extend({ linkLabel: requiredText(60) }),
  values: sectionSchema.extend({ items: z.array(questionCardSchema).min(1).max(8) }),
  recognition: listSectionSchema.extend({ awardsLinkLabel: requiredText(60), partnersLinkLabel: requiredText(60) }),
  faq: sectionSchema,
});

export const COMPANY_ABOUT_TEAM_LIMIT = 4;
export const COMPANY_ABOUT_AWARD_LIMIT = 4;
export const COMPANY_ABOUT_STATISTIC_LIMIT = 4;

export const companyAboutViewSchema = z.object({
  content: companyAboutContentSchema,
  statistics: z.array(companyStatisticSchema).max(COMPANY_ABOUT_STATISTIC_LIMIT),
  team: z.array(companyTeamMemberSchema).max(COMPANY_ABOUT_TEAM_LIMIT),
  awards: z.array(companyAwardSchema).max(COMPANY_ABOUT_AWARD_LIMIT),
  partners: z.array(companyPartnerSchema),
  faqs: faqsSchema,
});

// ---------------------------------------------------------------- /team/

export const companyTeamContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  members: listSectionSchema,
  roles: sectionSchema.extend({ items: z.array(questionCardSchema).min(1).max(6) }),
  faq: sectionSchema,
});

export const companyTeamViewSchema = z.object({
  content: companyTeamContentSchema,
  members: z.array(companyTeamMemberSchema),
  faqs: faqsSchema,
});

// ---------------------------------------------------------------- /testimonials/

export const companyTestimonialsContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  quotes: listSectionSchema.extend({ caseStudyLabel: requiredText(40) }),
  ratings: listSectionSchema.extend({
    /** How the figures are collected, under the breakdown. */
    method: requiredText(600),
  }),
  faq: sectionSchema,
});

export const companyTestimonialsViewSchema = z.object({
  content: companyTestimonialsContentSchema,
  reviews: companyReviewSummarySchema,
  testimonials: z.array(companyTestimonialSchema),
  faqs: faqsSchema,
});

// ---------------------------------------------------------------- /awards/

export const companyAwardsContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  recognition: listSectionSchema,
  /** The link to /partners/ is the template's; the copy names it. */
  partners: listSectionSchema.extend({ linkLabel: requiredText(60) }),
  faq: sectionSchema,
});

export const companyAwardsViewSchema = z.object({
  content: companyAwardsContentSchema,
  awards: z.array(companyAwardSchema),
  partners: z.array(companyPartnerSchema),
  faqs: faqsSchema,
});

// ---------------------------------------------------------------- /partners/

export const companyPartnersContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  partners: listSectionSchema.extend({ meaningLabel: requiredText(60) }),
  independence: sectionSchema.extend({ paragraphs: z.array(requiredText(900)).min(1).max(4) }),
  faq: sectionSchema,
});

export const companyPartnersViewSchema = z.object({
  content: companyPartnersContentSchema,
  partners: z.array(companyPartnerSchema),
  faqs: faqsSchema,
});

// ---------------------------------------------------------------- /technology/

export const companyTechnologyContentSchema = z.object({
  seo: pageSeoSchema,
  hero: companyHeroSchema,
  stack: listSectionSchema.extend({
    /** Order, label and summary of each `Technology.category`. Unlisted categories follow. */
    categories: z
      .array(z.object({ key: requiredText(60), label: requiredText(60), summary: requiredText(400) }))
      .max(12),
  }),
  /** Measured figures about this site. The band is left out without any. */
  proof: sectionSchema.extend({ stats: z.array(metricSchema).max(4) }),
  choosing: sectionSchema.extend({ items: z.array(questionCardSchema).min(1).max(6) }),
  faq: sectionSchema,
});

export const companyTechnologyViewSchema = z.object({
  content: companyTechnologyContentSchema,
  groups: z.array(companyTechnologyGroupSchema),
  faqs: faqsSchema,
});

/** The content schema of each page's setting. */
export const COMPANY_CONTENT_SCHEMAS = {
  about: companyAboutContentSchema,
  team: companyTeamContentSchema,
  testimonials: companyTestimonialsContentSchema,
  awards: companyAwardsContentSchema,
  partners: companyPartnersContentSchema,
  technology: companyTechnologyContentSchema,
} as const;

/** The view schema `GET /pages/<page>` returns for each page. */
export const COMPANY_VIEW_SCHEMAS = {
  about: companyAboutViewSchema,
  team: companyTeamViewSchema,
  testimonials: companyTestimonialsViewSchema,
  awards: companyAwardsViewSchema,
  partners: companyPartnersViewSchema,
  technology: companyTechnologyViewSchema,
} as const;

export type CompanyHero = z.output<typeof companyHeroSchema>;
export type CompanyStatistic = z.output<typeof companyStatisticSchema>;
export type CompanyTeamMember = z.output<typeof companyTeamMemberSchema>;
export type CompanyAward = z.output<typeof companyAwardSchema>;
export type CompanyPartner = z.output<typeof companyPartnerSchema>;
export type CompanyTestimonial = z.output<typeof companyTestimonialSchema>;
export type CompanyReviewSummary = z.output<typeof companyReviewSummarySchema>;
export type CompanyTechnologyGroup = z.output<typeof companyTechnologyGroupSchema>;
export type CompanyAboutContentInput = z.input<typeof companyAboutContentSchema>;
export type CompanyTeamContentInput = z.input<typeof companyTeamContentSchema>;
export type CompanyTestimonialsContentInput = z.input<typeof companyTestimonialsContentSchema>;
export type CompanyAwardsContentInput = z.input<typeof companyAwardsContentSchema>;
export type CompanyPartnersContentInput = z.input<typeof companyPartnersContentSchema>;
export type CompanyTechnologyContentInput = z.input<typeof companyTechnologyContentSchema>;
export type CompanyAboutView = z.output<typeof companyAboutViewSchema>;
export type CompanyTeamView = z.output<typeof companyTeamViewSchema>;
export type CompanyTestimonialsView = z.output<typeof companyTestimonialsViewSchema>;
export type CompanyAwardsView = z.output<typeof companyAwardsViewSchema>;
export type CompanyPartnersView = z.output<typeof companyPartnersViewSchema>;
export type CompanyTechnologyView = z.output<typeof companyTechnologyViewSchema>;
