import { z } from 'zod';
import { contentStatusSchema } from './admin-services';
import { imageSchema } from './media';
import { questionSchema, requiredText } from './pages/common';

/**
 * Editing `/before-and-after/` (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70).
 *
 * A comparison is its own record: the client's name, a heading written as a question, a
 * summary, two pictures each with its description and, optionally, its size, and up to four
 * figures. Every bound is the page's own (`workBeforeAndAfterViewSchema`), so the screen
 * cannot store a comparison the page would refuse. The homepage shows the first published
 * comparison marked for it, in the list's order.
 */

export const COMPARISON_MAX_METRICS = 4;

/**
 * A picture of the site. Its size is optional (decision 65): with both the width and the
 * height the slider takes the picture's shape, and without them it is 16:10. One without
 * the other would be ignored, so it is refused.
 */
export const comparisonImageSchema = imageSchema.refine(
  (image) => (image.width === undefined) === (image.height === undefined),
  { message: 'Give both the width and the height, or neither', path: ['height'] },
);

export const comparisonMetricSchema = z.object({
  label: requiredText(60),
  before: requiredText(20),
  after: requiredText(20),
});

export const comparisonInputSchema = z.object({
  clientName: z.string().trim().min(1, 'Name the client').max(120),
  /** The comparison's heading on /before-and-after/. */
  heading: questionSchema(200),
  summary: z.string().trim().min(1, 'One or two sentences on what changed').max(300),
  before: comparisonImageSchema,
  after: comparisonImageSchema,
  metrics: z.array(comparisonMetricSchema).max(COMPARISON_MAX_METRICS).default([]),
  /** The case study the comparison links to; the link shows only while that page is published. */
  projectId: z.string().min(1).nullable().default(null),
  /** Lower comes first on the page. */
  order: z.coerce.number().int().min(0).max(999).default(0),
  /** The homepage shows the first published comparison marked for it. */
  onHomepage: z.boolean().default(false),
});
export type ComparisonInput = z.infer<typeof comparisonInputSchema>;
export type ComparisonInputDraft = z.input<typeof comparisonInputSchema>;

export const COMPARISON_ERRORS = {
  /** The chosen case study does not exist, or was removed. */
  unknownLink: 'unknown_link',
} as const;

// ---------------------------------------------------------------- listing

export const adminComparisonRowSchema = z.object({
  id: z.string(),
  clientName: z.string(),
  heading: z.string(),
  status: contentStatusSchema,
  order: z.number().int(),
  onHomepage: z.boolean(),
  /** True for the one comparison the homepage shows now. */
  shownOnHomepage: z.boolean(),
  /** The linked case study, whatever its state. */
  caseStudy: z.object({ id: z.string(), clientName: z.string(), slug: z.string() }).nullable(),
  updatedAt: z.iso.datetime(),
});
export type AdminComparisonRow = z.infer<typeof adminComparisonRowSchema>;

export const adminComparisonListSchema = z.object({
  items: z.array(adminComparisonRowSchema),
  /** The case studies a comparison can link to. */
  caseStudies: z.array(z.object({ id: z.string(), clientName: z.string(), slug: z.string(), status: contentStatusSchema })),
});
export type AdminComparisonList = z.infer<typeof adminComparisonListSchema>;

// ---------------------------------------------------------------- the record

export const adminComparisonDetailSchema = z.object({
  id: z.string(),
  status: contentStatusSchema,
  updatedAt: z.iso.datetime(),
  shownOnHomepage: z.boolean(),
  /** The record as the editor writes it back, read leniently: a stored value is shown, not refused. */
  record: z.record(z.string(), z.unknown()),
});
export type AdminComparisonDetail = z.infer<typeof adminComparisonDetailSchema>;
