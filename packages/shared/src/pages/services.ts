import { z } from 'zod';
import { linkSchema } from '../home-page';
import { testimonialViewSchema } from '../landing-page';
import { decorativeImageSchema } from '../media';
import { slugSchema } from '../seo';
import {
  answerBlockSchema,
  caseStudyCardSchema,
  faqItemSchema,
  pageSeoSchema,
  questionSchema,
  requiredText,
  timedStepSchema,
} from './common';

/**
 * The services family (docs/10-site-pages.md): `/services/` grouped by ServiceCategory and
 * `/services/<slug>/` with the sections of docs/03-page-specs.md, "Service detail", in order.
 */

/** Setting rows of the services family. */
export const SERVICES_SETTING_KEYS = {
  /** Copy of `/services/`, validated by servicesIndexContentSchema. */
  index: 'services.index',
} as const;

/** The id of the inline enquiry form's section; the hero's primary call to action links to it. */
export const SERVICE_ENQUIRY_ANCHOR = 'enquire';

/** The form id service enquiries are stored with (`LeadAttribution.formId`). */
export const SERVICE_ENQUIRY_FORM_ID = 'service-enquiry';

/** How a starting price is charged: once for a project, or every month. */
export const SERVICE_PRICE_UNITS = ['PROJECT', 'MONTH'] as const;
export type ServicePriceUnit = (typeof SERVICE_PRICE_UNITS)[number];

/**
 * A service's starting price band in whole currency units, decided on the server: `min` is
 * where the band starts and `max`, when set, where typical work tops out. It renders as the
 * hero's price band and becomes the Offer in the Service structured data.
 */
export const servicePriceSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/, 'Use an ISO 4217 code such as USD'),
    min: z.number().int().positive(),
    max: z.number().int().positive().nullable().default(null),
    unit: z.enum(SERVICE_PRICE_UNITS),
  })
  .refine((price) => price.max === null || price.max > price.min, {
    message: 'The top of a price band is above its starting price',
    path: ['max'],
  });
export type ServicePrice = z.output<typeof servicePriceSchema>;

/** "$12,000 to $25,000", "From $1,500 a month": how a price band reads on the page. */
export function formatServicePrice(price: ServicePrice): string {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 0,
  });
  const band =
    price.max === null ? `From ${money.format(price.min)}` : `${money.format(price.min)} to ${money.format(price.max)}`;
  return price.unit === 'MONTH' ? `${band} a month` : band;
}

const titledItemSchema = z.object({ title: requiredText(80), body: requiredText(400) });

/** A section's heading, written as the question a buyer types, and an optional intro. */
const serviceSectionCopySchema = z.object({
  heading: questionSchema(),
  intro: requiredText(600).nullable().default(null),
});

/** One row of the comparison table: what a buyer weighs, and how each option handles it. */
export const serviceComparisonRowSchema = z.object({
  label: requiredText(80),
  us: requiredText(240),
  freelancer: requiredText(240),
  pageBuilder: requiredText(240),
  offshore: requiredText(240),
});

/**
 * Page copy of one service beyond its columns, stored in `Service.content`. Section order
 * is fixed by the template; this is not a page builder. Proof (case studies, testimonials,
 * technologies, industries, FAQs) comes from content types, never from this copy.
 *
 * A service whose `content` is null still renders: the API fills the headings with the
 * template's defaults and leaves out the sections only this copy can supply (problem
 * framing, comparison, pricing factors).
 */
export const serviceContentSchema = z.object({
  hero: z.object({
    /** The outcome sub-headline under the answer block. */
    outcome: requiredText(220),
    /** Links to the inline enquiry form. */
    primaryCtaLabel: requiredText(40),
    secondaryCta: linkSchema.nullable().default(null),
  }),
  /** The starting price band. Null shows the `startingPriceBand` column as text, without an Offer. */
  price: servicePriceSchema.nullable().default(null),
  /** The three situations that bring a buyer here. The intro is the `problemStatement` column. */
  problem: z
    .object({ heading: questionSchema(), situations: z.array(titledItemSchema).length(3) })
    .nullable()
    .default(null),
  /** Heading over the `deliverables` column. */
  included: serviceSectionCopySchema,
  /** Heading over the `processSteps` column, with an optional photograph under the overlay. */
  process: serviceSectionCopySchema.extend({ backdrop: decorativeImageSchema.nullable().default(null) }),
  technology: serviceSectionCopySchema,
  proof: serviceSectionCopySchema.extend({ linkLabel: requiredText(60) }),
  /** Our approach against a freelancer, a page builder and an offshore body shop. */
  comparison: serviceSectionCopySchema
    .extend({
      columns: z.object({
        us: requiredText(40),
        freelancer: requiredText(40),
        pageBuilder: requiredText(40),
        offshore: requiredText(40),
      }),
      rows: z.array(serviceComparisonRowSchema).min(3).max(8),
    })
    .nullable()
    .default(null),
  /** What moves the number, beside the price band. */
  pricing: serviceSectionCopySchema
    .extend({ factors: z.array(titledItemSchema).min(3).max(6), link: linkSchema.nullable().default(null) })
    .nullable()
    .default(null),
  industries: serviceSectionCopySchema,
  testimonial: z.object({ heading: questionSchema() }),
  faq: serviceSectionCopySchema,
  enquiry: serviceSectionCopySchema.extend({
    submitLabel: requiredText(40),
    footnote: requiredText(300).nullable().default(null),
  }),
  /** Shown in place of the enquiry form once the lead is stored. The confirmation email repeats it. */
  formSuccess: z.object({ heading: requiredText(80), body: requiredText(300) }),
  related: serviceSectionCopySchema,
});
export type ServiceContent = z.output<typeof serviceContentSchema>;
export type ServiceContentInput = z.input<typeof serviceContentSchema>;

/** A service on the index, in related services and in the sitemap. */
export const serviceCardSchema = z.object({
  slug: slugSchema,
  title: requiredText(120),
  summary: requiredText(300),
  priceLabel: requiredText(80).nullable(),
  updatedAt: z.iso.datetime(),
});
export type ServiceCard = z.output<typeof serviceCardSchema>;

/** A case study about this service's work, at most three per page. */
export const SERVICE_CASE_STUDY_LIMIT = 3;
export const SERVICE_FAQ_LIMIT = 8;
export const SERVICE_RELATED_LIMIT = 3;

/** What `GET /pages/services/:slug` returns, and what each detail snapshot holds. */
export const serviceDetailViewSchema = z.object({
  slug: slugSchema,
  title: requiredText(120),
  updatedAt: z.iso.datetime(),
  seo: pageSeoSchema,
  category: z.object({ slug: slugSchema, name: requiredText(80) }).nullable(),
  answerBlock: answerBlockSchema,
  hero: z.object({
    outcome: requiredText(300),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable(),
    /** A decorative photograph under the hero's overlays (`heroMediaUrl`). */
    backdrop: decorativeImageSchema.nullable(),
  }),
  /** The starting price band. `amount` is null when only the text column is set. */
  price: z.object({ label: requiredText(80), amount: servicePriceSchema.nullable() }).nullable(),
  problem: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      situations: z.array(titledItemSchema).length(3),
    })
    .nullable(),
  included: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(requiredText(200)).min(1).max(16),
    })
    .nullable(),
  process: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      backdrop: decorativeImageSchema.nullable(),
      steps: z.array(timedStepSchema).min(1).max(8),
    })
    .nullable(),
  technology: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(z.object({ name: requiredText(80), category: requiredText(40).nullable() })).min(1),
    })
    .nullable(),
  proof: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      caseStudies: z.array(caseStudyCardSchema).min(1).max(SERVICE_CASE_STUDY_LIMIT),
      link: linkSchema,
    })
    .nullable(),
  comparison: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      columns: z.object({
        us: requiredText(40),
        freelancer: requiredText(40),
        pageBuilder: requiredText(40),
        offshore: requiredText(40),
      }),
      rows: z.array(serviceComparisonRowSchema).min(3).max(8),
    })
    .nullable(),
  pricing: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      factors: z.array(titledItemSchema).min(3).max(6),
      link: linkSchema.nullable(),
    })
    .nullable(),
  industries: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(z.object({ slug: slugSchema, name: requiredText(80), line: requiredText(300).nullable() })).min(1),
    })
    .nullable(),
  testimonial: z.object({ heading: questionSchema(), quote: testimonialViewSchema }).nullable(),
  faq: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(faqItemSchema).min(1).max(SERVICE_FAQ_LIMIT),
    })
    .nullable(),
  enquiry: z.object({
    heading: questionSchema(),
    intro: requiredText(600).nullable(),
    submitLabel: requiredText(40),
    footnote: requiredText(300).nullable(),
    success: z.object({ heading: requiredText(80), body: requiredText(300) }),
  }),
  related: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(serviceCardSchema).min(1).max(SERVICE_RELATED_LIMIT),
    })
    .nullable(),
});
export type ServiceDetailView = z.output<typeof serviceDetailViewSchema>;

/** Copy of `/services/`, stored in the `services.index` setting. */
export const servicesIndexContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(120),
  answerBlock: answerBlockSchema,
  intro: requiredText(600),
  /**
   * Each category section's heading, keyed by the category's slug and written as the
   * question a buyer types. The category's name is the small label above it. A category
   * with no entry gets `groupHeadingFallback(name)`, so a new category never breaks the page.
   */
  groupHeadings: z.record(slugSchema, questionSchema()).default({}),
  /** Label of the group holding services without a category. */
  otherGroupName: requiredText(80),
  /** Heading of that group, as a question; null gets `groupHeadingFallback(otherGroupName)`. */
  otherGroupHeading: questionSchema().nullable().default(null),
  /** Shown while no service is published. */
  empty: requiredText(200),
  /** A visual cue on each card; the card's title is the link. */
  cardLinkLabel: requiredText(40),
  /** For a buyer who cannot tell which service fits. */
  guidance: z.object({
    heading: questionSchema(),
    body: requiredText(600),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable().default(null),
  }),
});
export type ServicesIndexContent = z.output<typeof servicesIndexContentSchema>;
export type ServicesIndexContentInput = z.input<typeof servicesIndexContentSchema>;

/** A category section's heading when the index copy has none for it: still a question. */
export function groupHeadingFallback(name: string): string {
  return `Which services are in ${name}?`;
}

/** What `GET /pages/services` returns, and what the index snapshot holds. */
export const servicesIndexViewSchema = z.object({
  content: servicesIndexContentSchema,
  /** Categories in order, each with its published services; uncategorised services last. */
  groups: z.array(
    z.object({
      slug: slugSchema.nullable(),
      /** The category's name, shown as the label above the heading. */
      name: requiredText(80),
      /** The section's H2, as the question a buyer types. */
      heading: questionSchema(),
      description: requiredText(600).nullable(),
      services: z.array(serviceCardSchema).min(1),
    }),
  ),
});
export type ServicesIndexView = z.output<typeof servicesIndexViewSchema>;
