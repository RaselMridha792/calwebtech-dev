import { z } from 'zod';

/**
 * Subscribers, segments, tags and the suppression list (docs/12-admin-dashboard.md,
 * module 4; Task 5.4).
 *
 * Three rules shape everything here:
 *
 * - A segment is a rule set, not a list. It is evaluated again every time it is read, and
 *   again at send time, so a subscriber who joins on Tuesday is in Wednesday's campaign.
 * - Suppression is separate from subscription state. An address on the suppression list is
 *   never sent to, whatever a segment, a campaign or an import says about it.
 * - An unsubscribe is permanent from this side. Nothing here can take an address off the
 *   suppression list; only the person themselves can ask to be mailed again.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// ---------------------------------------------------------------- tags

/** Lower case, so "Newsletter" and "newsletter" are one tag rather than two. */
export const tagNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'A tag needs a name')
  .max(40, 'Keep a tag under 40 characters')
  .regex(/^[a-z0-9][a-z0-9 _-]*$/, 'Letters, numbers, spaces, hyphens and underscores only');

export const subscriberTagsUpdateSchema = z.object({
  tags: z
    .array(tagNameSchema)
    .max(30, 'Thirty tags is the most one subscriber can carry')
    .transform((tags) => [...new Set(tags)]),
});
export type SubscriberTagsUpdate = z.output<typeof subscriberTagsUpdateSchema>;

// ---------------------------------------------------------------- suppression

/** Mirrors the comment on `Suppression.reason` in prisma/schema.prisma. */
export const SUPPRESSION_REASONS = ['unsubscribe', 'hard_bounce', 'complaint', 'manual'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  unsubscribe: 'Unsubscribed',
  hard_bounce: 'Hard bounce',
  complaint: 'Spam complaint',
  manual: 'Added by hand',
};

export const suppressionSchema = z.object({
  id: z.string(),
  email: z.string(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});
export type Suppression = z.infer<typeof suppressionSchema>;

export const ADMIN_SUPPRESSION_PAGE_SIZE = 50;

export const adminSuppressionQuerySchema = z.object({
  search: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  reason: z.preprocess(blankToUndefined, z.enum(SUPPRESSION_REASONS).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(ADMIN_SUPPRESSION_PAGE_SIZE),
});
export type AdminSuppressionQuery = z.output<typeof adminSuppressionQuerySchema>;

export const adminSuppressionListSchema = z.object({
  items: z.array(suppressionSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminSuppressionList = z.infer<typeof adminSuppressionListSchema>;

/**
 * The dashboard can only add an address, and only as `manual`. Bounces, complaints and
 * unsubscribes arrive from the provider and from the person, never from a form.
 */
export const suppressionCreateSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email address' })),
});
export type SuppressionCreate = z.output<typeof suppressionCreateSchema>;

// ---------------------------------------------------------------- subscribers

export const SUBSCRIBER_STATUSES = ['active', 'unsubscribed', 'suppressed'] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_STATUS_LABELS: Record<SubscriberStatus, string> = {
  active: 'Active',
  unsubscribed: 'Unsubscribed',
  suppressed: 'Suppressed',
};

export const adminSubscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  sourcePage: z.string().nullable(),
  consentAt: z.iso.datetime(),
  unsubscribedAt: z.iso.datetime().nullable(),
  lastEngagedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  tags: z.array(z.string()),
  /** Suppression wins over everything: a suppressed address is not sent to. */
  status: z.enum(SUBSCRIBER_STATUSES),
  suppression: z.object({ reason: z.string(), createdAt: z.iso.datetime() }).nullable(),
});
export type AdminSubscriber = z.infer<typeof adminSubscriberSchema>;

export const ADMIN_SUBSCRIBER_PAGE_SIZE = 50;

export const adminSubscriberQuerySchema = z.object({
  search: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  status: z.preprocess(blankToUndefined, z.enum(SUBSCRIBER_STATUSES).optional()),
  tag: z.preprocess(blankToUndefined, tagNameSchema.optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(ADMIN_SUBSCRIBER_PAGE_SIZE),
});
export type AdminSubscriberQuery = z.output<typeof adminSubscriberQuerySchema>;

export const tagCountSchema = z.object({ name: z.string(), count: z.number().int() });
export type TagCount = z.infer<typeof tagCountSchema>;

export const adminSubscriberListSchema = z.object({
  items: z.array(adminSubscriberSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Every tag in use, for the filter. There are tens of them, not thousands. */
  tags: z.array(tagCountSchema),
});
export type AdminSubscriberList = z.infer<typeof adminSubscriberListSchema>;

// ---------------------------------------------------------------- segments

/**
 * One condition of a segment. Dates are relative ("in the last 30 days") rather than
 * absolute, because a segment is evaluated at send time: "joined in the last month"
 * should mean the month before the send, not the month before somebody saved the rule.
 */
export const segmentConditionSchema = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('tag'),
    op: z.enum(['has', 'lacks']),
    value: tagNameSchema,
  }),
  z.object({
    field: z.literal('sourcePage'),
    op: z.enum(['is', 'contains']),
    value: z.string().trim().min(1, 'Enter a page').max(200),
  }),
  z.object({
    field: z.literal('emailDomain'),
    op: z.enum(['is', 'isNot']),
    value: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => value.replace(/^@/, ''))
      .pipe(z.string().min(1, 'Enter a domain').max(253).regex(/^[a-z0-9.-]+$/, 'Enter a domain such as example.com')),
  }),
  z.object({
    field: z.literal('subscribed'),
    /** `withinDays`: joined in the last N days. `beforeDays`: joined more than N days ago. */
    op: z.enum(['withinDays', 'beforeDays']),
    days: z.number().int().min(1).max(3650),
  }),
  z.object({
    field: z.literal('engaged'),
    /** `notWithinDays` includes subscribers who have never engaged at all. */
    op: z.enum(['withinDays', 'notWithinDays']),
    days: z.number().int().min(1).max(3650),
  }),
]);
export type SegmentCondition = z.infer<typeof segmentConditionSchema>;
export type SegmentField = SegmentCondition['field'];

export const SEGMENT_MAX_CONDITIONS = 20;

/** No conditions means every subscriber who may be mailed. */
export const segmentRulesSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  conditions: z.array(segmentConditionSchema).max(SEGMENT_MAX_CONDITIONS).default([]),
});
export type SegmentRules = z.output<typeof segmentRulesSchema>;

export const segmentWriteSchema = z.object({
  name: z.string().trim().min(1, 'A segment needs a name').max(80),
  description: z.preprocess(blankToUndefined, z.string().trim().max(300).nullable().optional()),
  rules: segmentRulesSchema,
});
export type SegmentWrite = z.output<typeof segmentWriteSchema>;

export const adminSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  rules: segmentRulesSchema,
  /** Who it reaches right now, suppression and unsubscribes already taken out. */
  count: z.number().int(),
  /** Campaigns that use it; a segment in use cannot be deleted. */
  campaignCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminSegment = z.infer<typeof adminSegmentSchema>;

export const adminSegmentListSchema = z.object({ items: z.array(adminSegmentSchema) });
export type AdminSegmentList = z.infer<typeof adminSegmentListSchema>;

export const segmentPreviewRequestSchema = z.object({ rules: segmentRulesSchema });
export type SegmentPreviewRequest = z.output<typeof segmentPreviewRequestSchema>;

export const segmentPreviewSchema = z.object({
  count: z.number().int(),
  /** Everyone who may be mailed at all, so the count reads as a share of something. */
  eligible: z.number().int(),
  sample: z.array(z.object({ email: z.string(), name: z.string().nullable() })),
});
export type SegmentPreview = z.infer<typeof segmentPreviewSchema>;

/** Why a write was refused, in codes the screen turns into words. */
export const AUDIENCE_ERRORS = {
  segmentInUse: 'segment_in_use',
} as const;
