import { z } from 'zod';
import { contentStatusSchema } from './admin-services';
import { imageSchema, mediaSrcSchema } from './media';
import { answerBlockSchema, metricSchema, requiredText } from './pages/common';
import { WORK_MAX_METRICS } from './pages/work';
import { seoSchema, slugSchema } from './seo';

/**
 * Editing case studies (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * A draft can be saved with a title, a client, a summary and an answer block. Publishing asks
 * for what a case study page cannot render without: at least three outcome figures
 * (docs/06, Task 2.2). The check is the API's, on publish, so a half-written draft can be
 * saved as often as someone likes.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null));

// ---------------------------------------------------------------- listing

export const adminCaseStudyRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  clientName: z.string(),
  slug: z.string(),
  status: contentStatusSchema,
  featured: z.boolean(),
  updatedAt: z.iso.datetime(),
  /** Null when the case study can be published; otherwise what it still needs. */
  notReady: z.string().nullable(),
  shadowsSnapshot: z.boolean(),
});
export type AdminCaseStudyRow = z.infer<typeof adminCaseStudyRowSchema>;

/** What the editor offers to link: the published or draft records of the other families. */
export const adminCaseStudyOptionsSchema = z.object({
  industries: z.array(z.object({ id: z.string(), name: z.string() })),
  services: z.array(z.object({ slug: z.string(), title: z.string() })),
  platforms: z.array(z.object({ slug: z.string(), name: z.string() })),
});
export type AdminCaseStudyOptions = z.infer<typeof adminCaseStudyOptionsSchema>;

export const adminCaseStudyListSchema = z.object({
  items: z.array(adminCaseStudyRowSchema),
  options: adminCaseStudyOptionsSchema,
});
export type AdminCaseStudyList = z.infer<typeof adminCaseStudyListSchema>;

// ---------------------------------------------------------------- the record

export const caseStudyInputSchema = z.object({
  title: z.string().trim().min(2, 'Give the case study a title').max(160),
  slug: slugSchema,
  clientName: z.string().trim().min(1, 'Name the client').max(120),
  /** Shown instead of the client's name when that cannot be published. */
  clientAlias: optionalText(120),
  /** One line, on the case study's card. */
  summary: z.string().trim().min(10, 'One line a buyer would recognise').max(300),
  answerBlock: answerBlockSchema,
  /** The outcome figures. The first is the headline; a case study is published with three or more. */
  metrics: z.array(metricSchema).max(WORK_MAX_METRICS).default([]),
  industryId: z.string().min(1).nullable().default(null),
  /** Service slugs, in the order the page lists them. */
  services: z.array(slugSchema).max(12).default([]),
  /** Technology slugs, shown as the platforms. */
  platforms: z.array(slugSchema).max(12).default([]),
  location: optionalText(120),
  /** "B2B, Distribution": each part is a tag on the card. */
  segment: optionalText(120),
  duration: optionalText(60),
  year: z.coerce.number().int().min(1990).max(2100).nullable().default(null),
  liveUrl: z.url().nullable().default(null),
  featured: z.boolean().default(false),
  cover: imageSchema.nullable().default(null),
  gallery: z.array(imageSchema).max(12).default([]),
  /** Paragraphs separated by a blank line. */
  challenge: optionalText(6000),
  approach: optionalText(6000),
  build: optionalText(6000),
  outcome: optionalText(6000),
  beforeAfter: z
    .object({
      before: mediaSrcSchema,
      after: mediaSrcSchema,
      metrics: z
        .array(z.object({ label: requiredText(80), before: requiredText(20), after: requiredText(20) }))
        .max(4)
        .default([]),
    })
    .nullable()
    .default(null),
  seo: seoSchema.default({}),
});
export type CaseStudyInput = z.infer<typeof caseStudyInputSchema>;
export type CaseStudyInputDraft = z.input<typeof caseStudyInputSchema>;

// ---------------------------------------------------------------- the client's words

/**
 * A testimonial on the case study (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70):
 * the quote, and the video when there is one. Each saves on its own. `consentAt` is the
 * permission to publish: without it the testimonial is kept but shown nowhere.
 */
export const caseStudyTestimonialInputSchema = z.object({
  quote: z.string().trim().min(1, 'Write down what the client said').max(1200),
  clientName: z.string().trim().min(1, 'Name the person quoted').max(120),
  role: optionalText(120),
  company: optionalText(120),
  /** A portrait's address, shown beside the quote. */
  avatar: mediaSrcSchema.nullable().default(null),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  /** A video file's address; the page offers a play button and loads it only when played. */
  videoUrl: mediaSrcSchema.nullable().default(null),
  /** Shown before the case study's other testimonials. */
  featured: z.boolean().default(false),
  /** The day the client agreed to publication (YYYY-MM-DD). Empty keeps it off the site. */
  consentAt: z.iso.date('Enter the date as a day, month and year').nullable().default(null),
});
export type CaseStudyTestimonialInput = z.infer<typeof caseStudyTestimonialInputSchema>;
export type CaseStudyTestimonialInputDraft = z.input<typeof caseStudyTestimonialInputSchema>;

/** Where the case study page shows a testimonial now. */
export const TESTIMONIAL_PLACES = ['quote', 'video'] as const;

export const adminTestimonialSchema = z.object({
  id: z.string(),
  quote: z.string(),
  clientName: z.string(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  avatar: z.string().nullable(),
  rating: z.number().int(),
  videoUrl: z.string().nullable(),
  featured: z.boolean(),
  consentAt: z.iso.date().nullable(),
  /** As the page's quote, its video, both or neither. */
  shownAs: z.array(z.enum(TESTIMONIAL_PLACES)),
  updatedAt: z.iso.datetime(),
});
export type AdminTestimonial = z.infer<typeof adminTestimonialSchema>;

export const adminCaseStudyDetailSchema = z.object({
  id: z.string(),
  status: contentStatusSchema,
  updatedAt: z.iso.datetime(),
  notReady: z.string().nullable(),
  shadowsSnapshot: z.boolean(),
  /** The record as the editor writes it back, read leniently: a stored value is shown, not refused. */
  record: z.record(z.string(), z.unknown()),
  /** Its testimonials, in the order the page picks from: featured first, then newest. */
  testimonials: z.array(adminTestimonialSchema).default([]),
});
export type AdminCaseStudyDetail = z.infer<typeof adminCaseStudyDetailSchema>;

export const CASE_STUDY_ERRORS = {
  duplicateSlug: 'duplicate_slug',
  notReady: 'not_ready',
  unknownLink: 'unknown_link',
} as const;

/** What the copy editor may add to the case study's pictures and figures. */
export const CASE_STUDY_SHAPES: Readonly<Record<string, unknown>> = {
  cover: { src: '', alt: '' },
  'gallery.#': { src: '', alt: '' },
  'metrics.#': { value: '', label: '' },
  beforeAfter: { before: '', after: '', metrics: [] },
  'beforeAfter.metrics.#': { label: '', before: '', after: '' },
};
