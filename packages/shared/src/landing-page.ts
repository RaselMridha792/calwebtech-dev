import { z } from 'zod';
import { decorativeImageSchema, imageSchema } from './media';
import { seoSchema, slugSchema } from './seo';
import { siteContactSchema } from './site';

const text = (max: number) => z.string().trim().min(1).max(max);

const statSchema = z.object({
  value: z.number().nonnegative(),
  suffix: z.string().max(12).default(''),
  label: text(80),
  /** Outcome metrics render in the `result` colour; everything else in white. */
  isOutcome: z.boolean().default(false),
});

const titledItemSchema = z.object({ title: text(120), body: text(600) });

const sectionIntroSchema = z.object({ heading: text(160), intro: text(600) });

export const FINAL_POINT_ICONS = ['check', 'shield', 'calendar'] as const;
export type FinalPointIcon = (typeof FINAL_POINT_ICONS)[number];

/**
 * Campaign-specific copy for a landing page, stored in `LandingPage.content`.
 * The section order is fixed by the template; this is not a page builder.
 * Proof (projects, testimonials, team, partners, pricing, FAQs) comes from
 * shared content types so it is never duplicated per campaign.
 */
export const landingPageContentSchema = z.object({
  header: z.object({ ctaLabel: text(40) }),
  hero: z.object({
    badge: text(80),
    heading: text(140),
    intro: text(600),
    bullets: z.array(text(160)).min(1).max(4),
    stats: z.array(statSchema).max(3),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
  heroForm: z.object({
    heading: text(60),
    subheading: text(160),
    submitLabel: text(40),
    assurances: z.array(text(40)).max(3),
  }),
  /** Shown in place of either form once a lead is stored. */
  formSuccess: z.object({ heading: text(80), body: text(300) }),
  trustBar: z.object({ label: text(120) }),
  problem: sectionIntroSchema.extend({
    cards: z.array(z.object({ figure: text(20), body: text(300) })).max(4),
  }),
  solution: z.object({
    heading: text(160),
    steps: z.array(titledItemSchema).min(1).max(4),
    image: imageSchema.nullable(),
  }),
  services: sectionIntroSchema.extend({ items: z.array(titledItemSchema).max(6) }),
  results: sectionIntroSchema.extend({ ctaLabel: text(40) }),
  process: sectionIntroSchema.extend({
    badge: text(80),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
  beforeAfter: sectionIntroSchema.extend({ ctaLabel: text(40) }),
  partners: sectionIntroSchema.extend({ technologiesLabel: text(40) }),
  team: sectionIntroSchema,
  testimonials: z.object({
    heading: text(160),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
  guarantees: z.object({ heading: text(160), items: z.array(titledItemSchema).max(4) }),
  pricing: sectionIntroSchema.extend({
    ctaLabel: text(40),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
  faq: sectionIntroSchema.extend({ callLabel: text(40) }),
  finalCta: sectionIntroSchema.extend({
    points: z
      .array(z.object({ icon: z.enum(FINAL_POINT_ICONS), title: text(80), body: text(160) }))
      .max(3),
    backgroundImage: decorativeImageSchema.nullable(),
    submitLabel: text(40),
    serviceOptions: z.array(text(60)).max(10),
    formFootnote: text(300),
  }),
});
export type LandingPageContent = z.output<typeof landingPageContentSchema>;
export type LandingPageContentInput = z.input<typeof landingPageContentSchema>;

const metricSchema = z.object({ value: text(20), label: text(80) });

export const caseResultSchema = z.object({
  slug: slugSchema,
  clientName: text(120),
  summary: text(300),
  tags: z.array(text(60)).max(4),
  image: imageSchema.nullable(),
  metrics: z.array(metricSchema).min(1),
});

export const processStepViewSchema = z.object({
  title: text(60),
  timing: text(40),
  heading: text(160),
  body: text(800),
  youGet: z.array(text(120)).max(6),
  weNeed: z.array(text(120)).max(6),
  image: imageSchema.nullable(),
});

export const beforeAfterViewSchema = z.object({
  clientName: text(120),
  before: imageSchema,
  after: imageSchema,
  metrics: z
    .array(z.object({ label: text(60), before: text(20), after: text(20) }))
    .max(4),
});

export const testimonialViewSchema = z.object({
  id: z.string().min(1),
  quote: text(1200),
  clientName: text(120),
  role: z.string().nullable(),
  company: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  avatar: decorativeImageSchema.nullable(),
});

export const reviewSummarySchema = z.object({
  averageRating: z.number().min(0).max(5).nullable(),
  totalReviews: z.number().int().nonnegative(),
  sources: z.array(z.object({ platform: text(60), rating: z.number().min(0).max(5) })),
  npsScore: z.number().nullable(),
});

/** What `GET /landing-pages/:slug` returns: copy plus resolved proof. */
export const landingPageViewSchema = z.object({
  slug: slugSchema,
  name: text(120),
  noindex: z.boolean(),
  seo: seoSchema.nullable(),
  updatedAt: z.iso.datetime(),
  content: landingPageContentSchema,
  contact: siteContactSchema,
  reviews: reviewSummarySchema,
  clients: z.array(z.object({ name: text(120), logo: imageSchema.nullable() })),
  results: z.array(caseResultSchema),
  processSteps: z.array(processStepViewSchema),
  beforeAfter: beforeAfterViewSchema.nullable(),
  partners: z.array(z.object({ name: text(120), note: z.string().nullable() })),
  technologies: z.array(z.object({ name: text(80) })),
  team: z.array(
    z.object({
      name: text(120),
      role: text(120),
      bio: z.string().nullable(),
      photo: imageSchema.nullable(),
    }),
  ),
  testimonials: z.array(testimonialViewSchema),
  pricingTiers: z.array(
    z.object({ name: text(60), priceLabel: text(40), summary: text(300), highlighted: z.boolean() }),
  ),
  faqs: z.array(z.object({ id: z.string().min(1), question: text(200), answer: text(2000) })),
});

export type LandingPageView = z.output<typeof landingPageViewSchema>;
export type CaseResult = z.output<typeof caseResultSchema>;
export type ProcessStepView = z.output<typeof processStepViewSchema>;
export type BeforeAfterView = z.output<typeof beforeAfterViewSchema>;
export type TestimonialView = z.output<typeof testimonialViewSchema>;
export type ReviewSummary = z.output<typeof reviewSummarySchema>;
