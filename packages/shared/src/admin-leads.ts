import { z } from 'zod';
import { leadTypeSchema, utmSchema } from './lead';
import { FORMS_PROJECT_STEPS, FORMS_PROJECT_STEP_COUNT, type FormsProjectStep } from './pages/forms';

/**
 * The leads inbox (docs/12-admin-dashboard.md, module 2): one table for every capture
 * point, because `Lead` is one table with a `type` discriminator.
 *
 * This is the admin's first useful screen — on a new production database it is the only
 * module whose data is already real.
 */

/** Mirrors the `LeadStatus` enum in prisma/schema.prisma. */
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** Statuses that close a lead, which the inbox hides by default. */
export const CLOSED_LEAD_STATUSES = ['WON', 'LOST'] as const satisfies readonly LeadStatus[];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL_SENT: 'Proposal sent',
  WON: 'Won',
  LOST: 'Lost',
};

/**
 * The capture point, in words. The design names four; the enum has eight, and all eight
 * are offered, or leads of the other four kinds would be invisible in the filter.
 */
export const LEAD_TYPE_LABELS: Record<z.infer<typeof leadTypeSchema>, string> = {
  PROJECT: 'Brief',
  SERVICE_ENQUIRY: 'Service',
  CONSULTATION: 'Booking',
  CONTACT: 'Contact',
  CALCULATOR: 'Calculator',
  AUDIT: 'Audit',
  RESOURCE: 'Resource',
  CAREERS: 'Careers',
};

// ---------------------------------------------------------------- channel

/**
 * Where the visitor came from, as one word the inbox can filter on. It is derived rather
 * than stored: what we keep is the UTM set and the referrer, and the same derivation has to
 * run in the API (to filter) and in the UI (to label), so it lives here.
 */
export const LEAD_CHANNELS = [
  { value: 'google-organic', label: 'Google organic' },
  { value: 'google-paid', label: 'Google paid' },
  { value: 'linkedin-organic', label: 'LinkedIn organic' },
  { value: 'linkedin-paid', label: 'LinkedIn paid' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number]['value'];
const LEAD_CHANNEL_VALUES = LEAD_CHANNELS.map((c) => c.value) as [LeadChannel, ...LeadChannel[]];
export const leadChannelSchema = z.enum(LEAD_CHANNEL_VALUES);

const PAID = new Set(['cpc', 'ppc', 'paid', 'paidsocial', 'paid-social', 'display']);

/**
 * A visit with no campaign and no referrer is `direct`; one with a referrer but no campaign
 * is `referral`. Anything else is read from the UTM set, because that is the only place the
 * paid and organic halves of one source are told apart.
 */
export function leadChannel(utm: { source?: string | null; medium?: string | null } | null, referrer: string | null): LeadChannel {
  const source = utm?.source?.trim().toLowerCase() ?? '';
  const medium = utm?.medium?.trim().toLowerCase().replace(/[\s_]/g, '') ?? '';
  const paid = PAID.has(medium);
  if (source.includes('google')) return paid ? 'google-paid' : 'google-organic';
  if (source.includes('linkedin')) return paid ? 'linkedin-paid' : 'linkedin-organic';
  if (source.includes('instagram')) return 'instagram';
  if (source.includes('newsletter') || medium === 'email') return 'newsletter';
  if (source) return 'referral';
  return referrer ? 'referral' : 'direct';
}

// ---------------------------------------------------------------- query

/** Every column the table sorts by, matching the header buttons in the design. */
export const ADMIN_LEAD_SORTS = ['received', 'name', 'company', 'type', 'service', 'status', 'owner', 'value'] as const;
export const adminLeadSortSchema = z.enum(ADMIN_LEAD_SORTS);
export type AdminLeadSort = z.infer<typeof adminLeadSortSchema>;

/** The date presets the Received filter offers, plus the custom range `from`/`to` carry. */
export const LEAD_DATE_RANGES = [
  { value: 'last-90-days', label: 'Last 90 days' },
  { value: 'today', label: 'Today' },
  { value: 'last-7-days', label: 'Last 7 days' },
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom range' },
] as const;
export type LeadDateRange = (typeof LEAD_DATE_RANGES)[number]['value'];
const LEAD_DATE_RANGE_VALUES = LEAD_DATE_RANGES.map((r) => r.value) as [LeadDateRange, ...LeadDateRange[]];

export const ADMIN_LEADS_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Blank query-string values mean "not filtered", not "filtered to empty". */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** One value or a repeated parameter, as a query string gives it. */
const many = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(
    (value) => (value === undefined || Array.isArray(value) ? value : [value]),
    z.array(schema).optional(),
  );

export const adminLeadQuerySchema = z.object({
  /** Named rows, for exporting the listing's selection rather than the whole view. */
  ids: many(z.string().min(1)),
  type: many(leadTypeSchema),
  status: many(leadStatusSchema),
  /** `me` is resolved to the caller by the API; `unassigned` means no owner at all. */
  owner: z.preprocess(blankToUndefined, z.string().max(60).optional()),
  /** Matched against name, email and company. */
  search: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  received: z.preprocess(blankToUndefined, z.enum(LEAD_DATE_RANGE_VALUES).optional()),
  from: z.preprocess(blankToUndefined, z.iso.date().optional()),
  to: z.preprocess(blankToUndefined, z.iso.date().optional()),
  source: z.preprocess(blankToUndefined, leadChannelSchema.optional()),
  serviceSlug: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  campaignSlug: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  /** An `EnquiryType.slug`; only CONTACT leads carry one. */
  enquiry: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  /** Start-a-project briefs by whether they were sent (decision 69). */
  brief: z.preprocess(blankToUndefined, z.enum(['unfinished', 'finished']).optional()),
  /** Closed leads are out of the way until asked for. */
  includeClosed: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  sort: adminLeadSortSchema.default('received'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(ADMIN_LEADS_PAGE_SIZE),
});
export type AdminLeadQuery = z.output<typeof adminLeadQuerySchema>;

/** Filters that narrow the view, which the design marks with a lit border. */
export function narrowingFilters(query: AdminLeadQuery): number {
  let count = 0;
  if (query.type?.length) count += 1;
  if (query.status?.length) count += 1;
  if (query.owner) count += 1;
  if (query.search) count += 1;
  if (query.received && query.received !== 'last-90-days') count += 1;
  if (query.source) count += 1;
  if (query.serviceSlug) count += 1;
  if (query.campaignSlug) count += 1;
  if (query.enquiry) count += 1;
  if (query.brief) count += 1;
  return count;
}

/** What the inbox's brief filter offers (decision 69). */
export const LEAD_BRIEF_FILTERS = [
  { value: 'unfinished', label: 'Unfinished briefs' },
  { value: 'finished', label: 'Sent briefs' },
] as const;

// ---------------------------------------------------------------- list

export const adminLeadListItemSchema = z.object({
  id: z.string(),
  type: leadTypeSchema,
  status: leadStatusSchema,
  name: z.string(),
  email: z.email(),
  company: z.string().nullable(),
  /** The service or campaign the enquiry came from, ready to show. */
  source: z.string().nullable(),
  channel: leadChannelSchema,
  /** The band the visitor chose. The money column shows this, not the `value` figure. */
  budgetBand: z.string().nullable(),
  value: z.number().nullable(),
  owner: z.object({ id: z.string(), name: z.string() }).nullable(),
  nextActionDate: z.iso.datetime().nullable(),
  /**
   * For a start-a-project brief nobody sent, the furthest step its visitor reached, 3 to 6;
   * null for every other lead, a sent brief included (decision 69).
   */
  unfinishedBriefStep: z.number().int().min(1).max(FORMS_PROJECT_STEP_COUNT).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminLeadListItem = z.infer<typeof adminLeadListItemSchema>;

export const adminLeadListSchema = z.object({
  items: z.array(adminLeadListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Counts for the whole filtered set, not just this page, so the tabs can show them. */
  statusCounts: z.record(leadStatusSchema, z.number().int()),
  /** What the title row reports: "<n> leads · <n> unassigned and new". */
  unassignedNew: z.number().int(),
});
export type AdminLeadList = z.infer<typeof adminLeadListSchema>;

/** What the filter bar's selects offer, read from the database rather than hard-coded. */
export const adminLeadFilterOptionsSchema = z.object({
  owners: z.array(z.object({ id: z.string(), name: z.string() })),
  services: z.array(z.object({ slug: z.string(), title: z.string() })),
  campaigns: z.array(z.object({ slug: z.string(), name: z.string() })),
  enquiryTypes: z.array(z.object({ slug: z.string(), name: z.string() })),
});
export type AdminLeadFilterOptions = z.infer<typeof adminLeadFilterOptionsSchema>;

// ---------------------------------------------------------------- detail

/** First touch, last touch and where they landed: how this lead was really won. */
export const adminLeadAttributionSchema = z.object({
  firstTouch: utmSchema.nullable(),
  lastTouch: utmSchema.nullable(),
  referrer: z.string().nullable(),
  landingPage: z.string().nullable(),
  device: z.string().nullable(),
  formId: z.string().nullable(),
  campaign: z.string().nullable(),
});
export type AdminLeadAttribution = z.infer<typeof adminLeadAttributionSchema>;

/**
 * Activities and notes interleaved, newest first. `kind` tells the UI which it is, so one
 * list renders both without the caller joining them.
 */
export const adminLeadTimelineEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('activity'),
    id: z.string(),
    type: z.string(),
    detail: z.unknown().nullable(),
    createdAt: z.iso.datetime(),
  }),
  z.object({
    kind: z.literal('note'),
    id: z.string(),
    body: z.string(),
    author: z.object({ id: z.string(), name: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
  }),
]);
export type AdminLeadTimelineEntry = z.infer<typeof adminLeadTimelineEntrySchema>;

/**
 * What was sent to this lead's address and what became of it. `EmailEvent` is keyed by
 * address rather than by lead, so this is a match on the address; it stays empty until the
 * Resend webhooks are wired (docs/06-build-plan.md, Task 6.2).
 */
export const adminLeadEmailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  to: z.email(),
  state: z.string(),
  occurredAt: z.iso.datetime(),
});
export type AdminLeadEmail = z.infer<typeof adminLeadEmailSchema>;

export const adminLeadDetailSchema = adminLeadListItemSchema.extend({
  phone: z.string().nullable(),
  message: z.string().nullable(),
  timeline: z.string().nullable(),
  projectType: z.string().nullable(),
  siteUrl: z.string().nullable(),
  serviceInterest: z.array(z.string()),
  referralSource: z.string().nullable(),
  /** The calculator's eight answers, the brief's fields: whatever that form captured. */
  answers: z.unknown().nullable(),
  consentAt: z.iso.datetime().nullable(),
  /**
   * The routed enquiry type, resolved to its name. `answers` holds only the slug the form
   * sent, and a panel showing `free-website-audit` where a person expects "Free website
   * audit" is the sort of thing that makes an admin feel like a database viewer.
   */
  enquiryType: z.object({ slug: z.string(), name: z.string() }).nullable(),
  /** The canonical person, so three forms from one human read as one contact. */
  contact: z.object({ id: z.string(), name: z.string().nullable(), submissions: z.number().int() }).nullable(),
  attribution: adminLeadAttributionSchema.nullable(),
  entries: z.array(adminLeadTimelineEntrySchema),
  emails: z.array(adminLeadEmailSchema),
  uploads: z.array(
    z.object({ id: z.string(), url: z.string(), filename: z.string(), sizeBytes: z.number().int() }),
  ),
});
export type AdminLeadDetail = z.infer<typeof adminLeadDetailSchema>;

// ---------------------------------------------------------------- mutations

/**
 * The pipeline block saves as one change. A reason is required whenever the status moves,
 * because that is the line the audit log and the timeline both quote; changing only the
 * owner or the date does not need one.
 */
export const leadPipelineUpdateSchema = z
  .object({
    status: leadStatusSchema.optional(),
    ownerId: z.string().min(1).nullable().optional(),
    nextActionDate: z.preprocess(blankToUndefined, z.iso.date().nullable().optional()),
    reason: z.string().trim().max(500).optional(),
    /** The status the panel was showing, so a change made elsewhere meanwhile is not lost. */
    expectedStatus: leadStatusSchema.optional(),
  })
  .refine((input) => input.status === undefined || (input.reason?.length ?? 0) > 0, {
    error: 'Add a reason before saving. Every status change is attributed in the audit log.',
    path: ['reason'],
  });
export type LeadPipelineUpdate = z.infer<typeof leadPipelineUpdateSchema>;

export const leadNoteCreateSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(4000),
});
export type LeadNoteCreate = z.infer<typeof leadNoteCreateSchema>;

/** Applying one change to many rows from the listing's selection. */
export const leadBulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: leadStatusSchema.optional(),
    ownerId: z.string().min(1).nullable().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.status === undefined || (input.reason?.length ?? 0) > 0, {
    error: 'Add a reason before changing the status of several leads at once.',
    path: ['reason'],
  });
export type LeadBulk = z.infer<typeof leadBulkSchema>;

// ---------------------------------------------------------------- brief drop-off

/**
 * Where start-a-project briefs are abandoned (docs/06-build-plan.md, task 5.2; decision 69).
 *
 * A brief is first stored when its visitor leaves the contact step, so it is counted from
 * step 3: someone who stops at step 1 or 2 leaves nothing behind. Steps 1 and 2 are listed,
 * with every stored brief having passed them, and marked as not measured.
 */
export const BRIEF_FUNNEL_PERIODS = [7, 30, 90] as const;
export type BriefFunnelPeriod = (typeof BRIEF_FUNNEL_PERIODS)[number];

export const adminBriefFunnelQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((value): value is BriefFunnelPeriod => (BRIEF_FUNNEL_PERIODS as readonly number[]).includes(value))
    .default(30),
});
export type AdminBriefFunnelQuery = z.output<typeof adminBriefFunnelQuerySchema>;

/** The step a brief is first stored at, and so the first whose drop-off can be counted. */
export const BRIEF_FIRST_MEASURED_STEP = 3;

export const BRIEF_STEP_LABELS: Record<FormsProjectStep, string> = {
  'project-type': 'Project type',
  contact: 'Contact details',
  services: 'Services',
  budget: 'Budget',
  timeline: 'Timeline',
  brief: 'The brief',
};

const funnelCount = z.number().int().min(0);

export const adminBriefFunnelSchema = z.object({
  days: z.number().int(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  /** Briefs stored in the period: every one reached step 3. */
  started: funnelCount,
  /** Of those, the ones sent. */
  finished: funnelCount,
  steps: z
    .array(
      z.object({
        step: z.number().int().min(1).max(FORMS_PROJECT_STEP_COUNT),
        key: z.enum(FORMS_PROJECT_STEPS),
        /** Briefs whose visitor got at least this far. */
        reached: funnelCount,
        /** Unsent briefs whose visitor got this far and no further. */
        stoppedHere: funnelCount,
        /** False for the steps before a brief is stored, where nobody who left can be seen. */
        measured: z.boolean(),
      }),
    )
    .length(FORMS_PROJECT_STEP_COUNT),
});
export type AdminBriefFunnel = z.infer<typeof adminBriefFunnelSchema>;
