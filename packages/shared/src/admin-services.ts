import { z } from 'zod';
import { answerBlockSchema, timedStepSchema } from './pages/common';
import { seoSchema, slugSchema } from './seo';

/**
 * Editing a service (docs/12-admin-dashboard.md, M4). The milestone the owner actually
 * asked for: one template, and services added from the dashboard rather than by a deploy.
 *
 * Only four fields are required — title, slug, short description and answer block — because
 * `templateServiceContent` supplies every section heading for a record with no `content` of
 * its own. A service can therefore be created in a minute and still render a complete page.
 */

/** Mirrors the `Status` enum in prisma/schema.prisma. */
export const CONTENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

// ---------------------------------------------------------------- listing

export const adminServiceRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: contentStatusSchema,
  category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  order: z.number().int(),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  /** True while the public page for this slug still comes from the committed snapshot. */
  shadowsSnapshot: z.boolean(),
});
export type AdminServiceRow = z.infer<typeof adminServiceRowSchema>;

export const adminServiceListSchema = z.object({
  items: z.array(adminServiceRowSchema),
  categories: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
});
export type AdminServiceList = z.infer<typeof adminServiceListSchema>;

// ---------------------------------------------------------------- the record

/**
 * What the editor writes. `content` is not here: the template covers every section until a
 * record needs copy of its own, and a fourteen-section form would stop anyone creating a
 * service in a minute — which is the point of the milestone.
 */
export const serviceInputSchema = z.object({
  title: z.string().trim().min(2, 'Give the service a name').max(120),
  slug: slugSchema,
  shortDescription: z.string().trim().min(10, 'One sentence a buyer would recognise').max(300),
  /**
   * Two to three sentences answering the page's question directly, before any marketing.
   * Required by CLAUDE.md on every service page: it is what an answer engine extracts.
   */
  answerBlock: answerBlockSchema,
  categoryId: z.string().min(1).nullable().default(null),
  icon: z.string().trim().max(80).nullable().default(null),
  heroMediaUrl: z.string().trim().max(2000).nullable().default(null),
  problemStatement: z.string().trim().max(2000).nullable().default(null),
  /** The "what is included" list. The section is left out when it is empty. */
  deliverables: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  processSteps: z.array(timedStepSchema).max(10).default([]),
  startingPriceBand: z.string().trim().max(80).nullable().default(null),
  order: z.coerce.number().int().min(0).max(999).default(0),
  seo: seoSchema.default({}),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const adminServiceDetailSchema = serviceInputSchema.extend({
  id: z.string(),
  status: contentStatusSchema,
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  /** Set when this record has copy of its own; the editor says so rather than hiding it. */
  hasOwnContent: z.boolean(),
  shadowsSnapshot: z.boolean(),
});
export type AdminServiceDetail = z.infer<typeof adminServiceDetailSchema>;

/**
 * Publishing takes a date so a service can be scheduled. A time in the future means
 * `SCHEDULED`; now or in the past means `PUBLISHED`, which is what the public query checks.
 */
export const servicePublishSchema = z.object({
  publishedAt: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.iso.datetime().optional(),
  ),
});
export type ServicePublish = z.infer<typeof servicePublishSchema>;

/** Why a change was refused, in words the screen shows as they are. */
export const SERVICE_ERRORS = {
  duplicateSlug: 'duplicate_slug',
  notFound: 'not_found',
} as const;

/**
 * Re-exported so server code keeps one import. It is defined in a zod-free module because
 * the editor calls it in the browser; see the note there before moving it back.
 */
export { slugify } from './slugify';
