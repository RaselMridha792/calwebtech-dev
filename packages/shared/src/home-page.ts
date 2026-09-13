import { z } from 'zod';
import {
  FINAL_POINT_ICONS,
  beforeAfterViewSchema,
  reviewSummarySchema,
  testimonialViewSchema,
} from './landing-page';
import { decorativeImageSchema, imageSchema, mediaSrcSchema } from './media';
import { slugSchema } from './seo';
import { siteContactSchema } from './site';

const text = (max: number) => z.string().trim().min(1).max(max);

/** `Faq.group` of the homepage problem router's entries. */
export const HOME_PROBLEM_ROUTER_FAQ_GROUP = 'home-problem-router';

/** An in-page anchor such as `#book`, a site path, or an absolute URL. */
const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.startsWith('#') || value.startsWith('/') || URL.canParse(value),
    'Must be an anchor, a site path or a URL',
  );

export const linkSchema = z.object({ label: text(60), href: hrefSchema });
export type Link = z.infer<typeof linkSchema>;

const titledSchema = z.object({ title: text(120), body: text(600) });

/**
 * A section background: a decorative poster image, with an optional muted video that
 * fades in over it once it can play (docs/05-design-system.md, Background video).
 */
const backgroundSchema = z.object({
  poster: decorativeImageSchema.nullable(),
  videoUrl: mediaSrcSchema.nullable(),
});

/**
 * Homepage copy, stored in the `home.content` setting. Section order and layout are fixed
 * by the template (reference/homepage.html); this is not a page builder. Proof (projects,
 * testimonials, recognition, locations, articles) comes from content types, never from
 * copy. Sections that navigation links to carry an `empty` line, shown when they have no
 * records, so their anchors always land.
 */
export const homePageContentSchema = z.object({
  seo: z.object({ title: text(60), description: text(155) }),
  utilityBar: z.object({ serviceArea: text(120).nullable() }),
  header: z.object({ primaryCta: linkSchema, secondaryCta: linkSchema }),
  megaMenu: z.object({
    servicesPromo: z.object({ heading: text(80), body: text(200), cta: linkSchema }),
  }),
  hero: z.object({
    eyebrow: text(80).nullable(),
    heading: text(120),
    /** Closing phrase of the H1, set with the underline accent. */
    headingEmphasis: text(80).nullable(),
    intro: text(600),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable(),
    form: z.object({
      heading: text(60),
      subheading: text(160),
      submitLabel: text(40),
      footnote: text(160).nullable(),
    }),
    background: backgroundSchema,
  }),
  /** Shown in place of either form once a lead is stored. The confirmation email repeats it. */
  formSuccess: z.object({ heading: text(80), body: text(300) }),
  /** Label over the client logo band, which renders only when logos are published. */
  clients: z.object({ label: text(120) }),
  capability: z.object({
    heading: text(160),
    bullets: z.array(text(160)).max(4),
    body: text(800),
    primaryCta: linkSchema,
    showreel: z
      .object({ label: text(60), videoUrl: mediaSrcSchema, poster: decorativeImageSchema.nullable() })
      .nullable(),
    background: backgroundSchema,
  }),
  problemRouter: z.object({ heading: text(160), intro: text(600), cta: linkSchema }),
  services: z.object({ heading: text(160) }),
  work: z.object({ heading: text(160), intro: text(600), empty: text(200) }),
  midCta: z.object({
    eyebrow: text(120),
    heading: text(120),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable(),
  }),
  beforeAfter: z.object({ heading: text(160), intro: text(600), empty: text(200) }),
  industries: z.object({
    heading: text(160),
    intro: text(600),
    notListed: z.object({ heading: text(80), body: text(200), cta: linkSchema }),
  }),
  estimate: z.object({
    badge: text(80),
    heading: text(160),
    intro: text(600),
    bullets: z.array(text(160)).max(3),
    /** A preview of the calculator's first question until Task 4.1 ships the calculator. */
    preview: z.object({
      progressLabel: text(40),
      question: text(160),
      options: z.array(text(60)).min(2).max(4),
    }),
    cta: linkSchema,
  }),
  whyUs: z.object({ heading: text(160), items: z.array(titledSchema).max(6) }),
  technology: z.object({ heading: text(160), intro: text(600), empty: text(200) }),
  process: z.object({ heading: text(160), intro: text(600) }),
  testimonials: z.object({ heading: text(160), empty: text(200) }),
  recognition: z.object({ eyebrow: text(120), heading: text(160), empty: text(200) }),
  insights: z.object({ heading: text(160), empty: text(200) }),
  whitepaper: z.object({ eyebrow: text(80), ctaLabel: text(40) }),
  locations: z.object({ heading: text(160), intro: text(600), empty: text(200) }),
  pricing: z.object({ heading: text(160), intro: text(600), cta: linkSchema }),
  book: z.object({
    heading: text(160),
    intro: text(600),
    points: z
      .array(z.object({ icon: z.enum(FINAL_POINT_ICONS), title: text(80), body: text(160) }))
      .max(3),
    submitLabel: text(40),
    footnote: text(300),
    serviceOptions: z.array(text(60)).max(10),
    referralOptions: z.array(text(60)).max(10),
  }),
  footer: z.object({
    blurb: text(300),
    resources: z.array(linkSchema).max(10),
    company: z.array(linkSchema).max(10),
    legal: z.array(linkSchema).max(8),
  }),
  floatingCta: linkSchema,
});
export type HomePageContent = z.output<typeof homePageContentSchema>;
export type HomePageContentInput = z.input<typeof homePageContentSchema>;

const metricSchema = z.object({ value: text(20), label: text(80) });

export const homeProjectSchema = z.object({
  slug: slugSchema,
  clientName: text(120),
  summary: text(300),
  tags: z.array(text(60)).max(4),
  /** Industry name, used by the work filter. */
  filter: text(80).nullable(),
  image: imageSchema.nullable(),
  metrics: z.array(metricSchema).min(1).max(3),
  quote: testimonialViewSchema.nullable(),
});

export const LOCATION_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;

/** What `GET /pages/home` returns: copy plus resolved, published proof. */
export const homePageViewSchema = z.object({
  /** From the `homepage.indexing` setting; false renders noindex. */
  indexable: z.boolean(),
  content: homePageContentSchema,
  contact: siteContactSchema,
  reviews: reviewSummarySchema,
  statistics: z.array(z.object({ label: text(80), value: text(20), suffix: z.string().max(12) })).max(4),
  clients: z.array(z.object({ name: text(120), logo: imageSchema.nullable() })),
  serviceGroups: z.array(
    z.object({ name: text(80), services: z.array(z.object({ slug: slugSchema, title: text(120) })) }),
  ),
  services: z.array(
    z.object({
      slug: slugSchema,
      title: text(120),
      summary: text(300),
      deliverables: z.array(text(160)).max(3),
    }),
  ),
  industries: z.array(z.object({ slug: slugSchema, name: text(80), line: z.string().nullable() })),
  problemRouter: z.array(z.object({ id: z.string().min(1), question: text(200), answer: text(2000) })),
  projects: z.array(homeProjectSchema),
  pullQuote: testimonialViewSchema.nullable(),
  beforeAfter: beforeAfterViewSchema.nullable(),
  technologyGroups: z.array(z.object({ category: text(60), names: z.array(text(80)).min(1) })),
  /** The compact timeline. The full step renders on /process/ and in the landing stepper. */
  processSteps: z.array(z.object({ title: text(60), timing: text(40), summary: text(200) })),
  testimonials: z.array(testimonialViewSchema),
  awards: z.array(z.object({ name: text(160), detail: z.string().nullable() })),
  expertise: z.array(text(120)),
  posts: z.array(
    z.object({
      slug: slugSchema,
      title: text(200),
      excerpt: text(400),
      category: z.string().nullable(),
      readingTime: z.number().int().positive().nullable(),
    }),
  ),
  guide: z
    .object({ slug: slugSchema, title: text(200), summary: text(600), fileUrl: mediaSrcSchema })
    .nullable(),
  locations: z.array(
    z.object({
      slug: slugSchema,
      city: text(120),
      state: z.string().nullable(),
      tier: z.enum(LOCATION_TIERS),
      serviceArea: z.string().nullable(),
      address: z.string().nullable(),
    }),
  ),
  pricingTiers: z.array(
    z.object({ name: text(60), priceLabel: text(40), summary: text(300), highlighted: z.boolean() }),
  ),
});

export type HomePageView = z.output<typeof homePageViewSchema>;
export type HomeProject = z.output<typeof homeProjectSchema>;
