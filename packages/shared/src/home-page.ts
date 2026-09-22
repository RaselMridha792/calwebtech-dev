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

/** A section's "see all" link beside its heading. Null renders none. */
const sectionLinkSchema = linkSchema.nullable().default(null);

/** A column of mega menu links, with an optional title over it. */
const menuColumnSchema = z.object({ title: text(60).nullable(), links: z.array(linkSchema).min(1).max(8) });

/** A featured case study or resource card at the end of a mega menu panel. */
const menuPromoSchema = z.object({ heading: text(80), body: text(200), cta: linkSchema });

/** A photograph behind a section, under its overlays. Null renders none. */
const backdropSchema = decorativeImageSchema.nullable().default(null);

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
 * by the template (the approved homepage); this is not a page builder. Proof (projects,
 * testimonials, recognition, locations, articles) comes from content types, never from
 * copy. Sections that navigation links to carry an `empty` line, shown when they have no
 * records, so their anchors always land.
 *
 * Fields added after the first release carry defaults, so stored content keeps parsing.
 */
export const homePageContentSchema = z.object({
  seo: z.object({ title: text(60), description: text(155) }),
  utilityBar: z.object({
    serviceArea: text(120).nullable(),
    /** Follows the review total in the rating badge, e.g. "from 217 reviews". */
    reviewNoun: text(40).default('reviews'),
    /** Small links at the right of the bar, such as support. */
    links: z.array(linkSchema).max(4).default([]),
  }),
  header: z.object({ primaryCta: linkSchema, secondaryCta: linkSchema.nullable() }),
  megaMenu: z.object({
    servicesPromo: menuPromoSchema,
    /** Empty falls back to the published service categories. */
    serviceColumns: z.array(menuColumnSchema).max(3).default([]),
    /** Empty falls back to the published industries. */
    industryLinks: z.array(linkSchema).max(12).default([]),
    industriesPromo: menuPromoSchema.nullable().default(null),
    /** Columns beside the featured projects. Empty falls back to the template's links. */
    workColumns: z.array(menuColumnSchema).max(2).default([]),
    /** Empty falls back to the template's links. */
    resourceColumns: z.array(menuColumnSchema).max(3).default([]),
    resourcesPromo: menuPromoSchema.nullable().default(null),
  }),
  /** Groups in the small-screen menu. Empty falls back to services, industries and sections. */
  mobileMenu: z
    .object({
      groups: z.array(z.object({ title: text(60), links: z.array(linkSchema).min(1).max(12) })).max(4),
    })
    .default({ groups: [] }),
  hero: z.object({
    eyebrow: text(80).nullable(),
    /** Second part of the eyebrow pill, after a divider. */
    eyebrowDetail: text(80).nullable().default(null),
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
    /**
     * Photographs beside the copy, with the first featured project's headline figure on
     * a card. **No longer rendered:** the 2026 hero is the plate and the type over it, and
     * the owner asked for the column of images to go. The quote form keeps that column and
     * its `#quote` anchor on every page, which is what the calls to action point at.
     */
    media: z
      .object({
        image: imageSchema,
        secondaryImage: imageSchema.nullable().default(null),
        /** Under the figure, e.g. "Six months after launch". */
        metricCaption: text(80).nullable().default(null),
      })
      .nullable()
      .default(null),
  }),
  /** Shown in place of either form once a lead is stored. The confirmation email repeats it. */
  formSuccess: z.object({ heading: text(80), body: text(300) }),
  /** Label over the client logo band, which renders only when logos are published. */
  clients: z.object({ label: text(120) }),
  capability: z.object({
    /** False leaves the band out of the page. */
    enabled: z.boolean().default(true),
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
  services: z.object({ heading: text(160), link: sectionLinkSchema }),
  work: z.object({
    heading: text(160),
    intro: text(600),
    empty: text(200),
    link: sectionLinkSchema,
    /** Label of each card's link to `/work/<slug>/`. Null renders no link. */
    caseStudyLabel: text(40).nullable().default(null),
  }),
  midCta: z.object({
    /** False leaves the band out of the page. */
    enabled: z.boolean().default(true),
    eyebrow: text(120),
    heading: text(120),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable(),
  }),
  beforeAfter: z.object({
    heading: text(160),
    intro: text(600),
    empty: text(200),
    cta: sectionLinkSchema,
    backgroundImage: backdropSchema,
  }),
  industries: z.object({
    /**
     * The affordance on each industry card. The same words the industries index already
     * uses for its own cards, so the two pages say one thing.
     */
    cardLinkLabel: text(40).default('See the industry'),
    heading: text(160),
    intro: text(600),
    notListed: z.object({ heading: text(80), body: text(200), cta: linkSchema }),
    link: sectionLinkSchema,
  }),
  estimate: z.object({
    badge: text(80),
    heading: text(160),
    intro: text(600),
    bullets: z.array(text(160)).max(3),
    /** A preview of the calculator's first question until Task 4.1 ships the calculator. */
    preview: z.object({
      progressLabel: text(40),
      /** Beside the progress label, e.g. "About 2 minutes left". */
      timeLabel: text(40).nullable().default(null),
      question: text(160),
      options: z.array(text(60)).min(2).max(4),
    }),
    cta: linkSchema,
    backgroundImage: backdropSchema,
  }),
  whyUs: z.object({ heading: text(160), items: z.array(titledSchema).max(6) }),
  technology: z.object({
    heading: text(160),
    intro: text(600),
    empty: text(200),
    /** Measured figures about this site, under the intro. */
    stats: z.array(z.object({ value: text(20), label: text(80) })).max(4).default([]),
    cta: sectionLinkSchema,
  }),
  process: z.object({ heading: text(160), intro: text(600), link: sectionLinkSchema }),
  testimonials: z.object({
    heading: text(160),
    empty: text(200),
    backgroundImage: backdropSchema,
    /** Label before the publication names. The band renders only with both. */
    pressLabel: text(60).nullable().default(null),
  }),
  recognition: z.object({
    eyebrow: text(120).nullable(),
    heading: text(160),
    empty: text(200),
    link: sectionLinkSchema,
  }),
  insights: z.object({ heading: text(160), empty: text(200), link: sectionLinkSchema }),
  whitepaper: z.object({ eyebrow: text(80), ctaLabel: text(40) }),
  locations: z.object({ heading: text(160), intro: text(600), empty: text(200) }),
  pricing: z.object({
    heading: text(160),
    intro: text(600),
    cta: linkSchema,
    /** Badge on the highlighted tier, e.g. "Most common". */
    highlightLabel: text(40).nullable().default(null),
  }),
  book: z.object({
    heading: text(160),
    intro: text(600),
    /**
     * The band's own second action. It used to borrow the header's, which tied the closing
     * call to action on every page to whatever the nav bar happened to carry; taking the
     * estimate button out of the bar then took it off the bottom of every page too.
     */
    secondaryCta: linkSchema.nullable().default(null),
    points: z
      .array(z.object({ icon: z.enum(FINAL_POINT_ICONS), title: text(80), body: text(160) }))
      .max(3),
    submitLabel: text(40),
    footnote: text(300),
    serviceOptions: z.array(text(60)).max(10),
    referralOptions: z.array(text(60)).max(10),
    backgroundImage: backdropSchema,
  }),
  footer: z.object({
    blurb: text(300),
    /** Empty falls back to the published services. */
    services: z.array(linkSchema).max(10).default([]),
    /** Empty falls back to the published industries. */
    industries: z.array(linkSchema).max(10).default([]),
    resources: z.array(linkSchema).max(10),
    company: z.array(linkSchema).max(10),
    legal: z.array(linkSchema).max(8),
    backgroundImage: backdropSchema,
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

/**
 * The landing page's review summary, plus per-platform counts and the NPS sample size.
 * Also the rating badge in the site chrome (site-chrome.ts).
 */
export const homeReviewSummarySchema = reviewSummarySchema.extend({
  sources: z.array(
    z.object({
      platform: text(60),
      rating: z.number().min(0).max(5),
      reviewCount: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
  npsProjectCount: z.number().int().nonnegative().nullable().default(null),
});

/** What `GET /pages/home` returns: copy plus resolved, published proof. */
export const homePageViewSchema = z.object({
  /** From the `homepage.indexing` setting; false renders noindex. */
  indexable: z.boolean(),
  content: homePageContentSchema,
  contact: siteContactSchema,
  reviews: homeReviewSummarySchema,
  statistics: z
    .array(
      z.object({
        label: text(80),
        value: text(20),
        suffix: z.string().max(12),
        /** An outcome figure, set in the result colour. */
        outcome: z.boolean().default(false),
      }),
    )
    .max(4),
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
  industries: z.array(
    z.object({
      slug: slugSchema,
      name: text(80),
      line: z.string().nullable(),
      image: imageSchema.nullable().default(null),
    }),
  ),
  problemRouter: z.array(z.object({ id: z.string().min(1), question: text(200), answer: text(2000) })),
  projects: z.array(homeProjectSchema),
  pullQuote: testimonialViewSchema.nullable(),
  beforeAfter: beforeAfterViewSchema.nullable(),
  technologyGroups: z.array(z.object({ category: text(60), names: z.array(text(80)).min(1) })),
  /** The compact timeline. The full step renders on /process/ and in the landing stepper. */
  processSteps: z.array(z.object({ title: text(60), timing: text(40), summary: text(200) })),
  testimonials: z.array(testimonialViewSchema),
  /** A client on camera, beside the written quotes. The play button needs `videoUrl`. */
  videoTestimonial: z
    .object({
      clientName: text(120),
      role: z.string().nullable(),
      company: z.string().nullable(),
      poster: imageSchema,
      videoUrl: mediaSrcSchema.nullable(),
      duration: text(20).nullable(),
    })
    .nullable()
    .default(null),
  /** Publications that covered the work, under the testimonials. */
  press: z.array(z.object({ name: text(120) })).default([]),
  awards: z.array(z.object({ name: text(160), detail: z.string().nullable() })),
  expertise: z.array(text(120)),
  posts: z.array(
    z.object({
      slug: slugSchema,
      title: text(200),
      excerpt: text(400),
      category: z.string().nullable(),
      readingTime: z.number().int().positive().nullable(),
      image: imageSchema.nullable().default(null),
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
export type HomeReviewSummary = z.output<typeof homeReviewSummarySchema>;
