import { z } from 'zod';
import { leadChannelSchema, leadStatusSchema } from './admin-leads';
import { leadTypeSchema } from './lead';

/**
 * The dashboard's first screen (docs/12-admin-dashboard.md, screen 1): how the business is
 * doing this week, what is coming up, what changed, and what needs someone.
 *
 * One read, shaped by role. A section is null when the signed-in role cannot read the module
 * it comes from, so an editor's overview never carries a lead and a salesperson's never
 * carries a draft. The API decides that, never the page.
 */

const count = z.number().int().min(0);

/** A figure for a period and the period of the same length before it. */
export const overviewPeriodSchema = z.object({ current: count, previous: count });
export type OverviewPeriod = z.infer<typeof overviewPeriodSchema>;

/** How many days the trend covers, and so the "month" figure. */
export const OVERVIEW_TREND_DAYS = 30;

export const overviewLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  type: leadTypeSchema,
  status: leadStatusSchema,
  createdAt: z.iso.datetime(),
});
export type OverviewLead = z.infer<typeof overviewLeadSchema>;

export const overviewLeadsSchema = z.object({
  /** The last seven days, against the seven before. */
  week: overviewPeriodSchema,
  /** The last thirty days, against the thirty before. */
  month: overviewPeriodSchema,
  /** One count per calendar day in the business timezone, oldest first, ending today. */
  daily: z.array(z.object({ day: z.string(), count })).length(OVERVIEW_TREND_DAYS),
  /** Every lead that is not deleted, by where it stands. */
  byStatus: z.record(leadStatusSchema, count),
  /** Where the last thirty days' leads came from, largest first, empty channels left out. */
  byChannel: z.array(z.object({ channel: leadChannelSchema, count })),
  latest: z.array(overviewLeadSchema).max(5),
  /** New leads nobody owns yet: the inbox's own "unassigned and new". */
  unassignedNew: count,
  /** Open leads whose next action date has passed. */
  overdue: count,
});
export type OverviewLeads = z.infer<typeof overviewLeadsSchema>;

export const overviewBookingSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  startsAt: z.iso.datetime(),
});

export const overviewBookingsSchema = z.object({
  /** The next calls that are still on, soonest first. */
  upcoming: z.array(overviewBookingSchema).max(5),
  next7Days: count,
  /** The business timezone the booking page states, for showing the times. */
  timeZone: z.string(),
});
export type OverviewBookings = z.infer<typeof overviewBookingsSchema>;

export const overviewAudienceSchema = z.object({
  /** Subscribed and not on the suppression list. */
  active: count,
  joined: overviewPeriodSchema,
  suppressed: count,
});
export type OverviewAudience = z.infer<typeof overviewAudienceSchema>;

export const overviewCampaignsSchema = z.object({
  drafts: count,
  scheduled: count,
  lastSent: z
    .object({
      id: z.string(),
      name: z.string(),
      sentAt: z.iso.datetime(),
      recipients: count,
      delivered: count,
      opened: count,
      clicked: count,
    })
    .nullable(),
});
export type OverviewCampaigns = z.infer<typeof overviewCampaignsSchema>;

export const OVERVIEW_CONTENT_KINDS = ['service', 'industry', 'case-study', 'page-copy'] as const;
export type OverviewContentKind = (typeof OVERVIEW_CONTENT_KINDS)[number];

export const overviewContentSchema = z.object({
  /** Published and not, per family the dashboard edits. */
  families: z.array(
    z.object({ kind: z.enum(OVERVIEW_CONTENT_KINDS), published: count, unpublished: count }),
  ),
  recent: z
    .array(
      z.object({
        kind: z.enum(OVERVIEW_CONTENT_KINDS),
        title: z.string(),
        href: z.string(),
        /** Null for page copy, which has no draft state. */
        status: z.string().nullable(),
        updatedAt: z.iso.datetime(),
      }),
    )
    .max(6),
  /** Scheduled records whose publish time has passed: they are waiting on something. */
  scheduledPast: count,
});
export type OverviewContent = z.infer<typeof overviewContentSchema>;

export const adminOverviewSchema = z.object({
  generatedAt: z.iso.datetime(),
  leads: overviewLeadsSchema.nullable(),
  bookings: overviewBookingsSchema.nullable(),
  audience: overviewAudienceSchema.nullable(),
  campaigns: overviewCampaignsSchema.nullable(),
  content: overviewContentSchema.nullable(),
  /** Images in the library; null when the role cannot open it. */
  media: z.object({ total: count }).nullable(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

/**
 * The change from one period to the next, as a whole percentage, or null when there is
 * nothing to compare against. Shared so the card and its test read the same figure.
 */
export function periodChange(period: OverviewPeriod): number | null {
  if (period.previous === 0) return null;
  return Math.round(((period.current - period.previous) / period.previous) * 100);
}
