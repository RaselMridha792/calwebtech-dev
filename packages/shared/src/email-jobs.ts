import { z } from 'zod';
import { calculatorLeadAnswersSchema, calculatorResultEmailSchema } from './calculator';
import { campaignContentSchema } from './campaigns';
import { attributionSchema, leadTypeSchema } from './lead';

/** The BullMQ queue the API adds email jobs to and the worker consumes. */
export const EMAIL_QUEUE = 'email';

/**
 * A snapshot of the lead as it was submitted. Emails describe what the visitor sent,
 * even if the record is edited before the worker runs; `leadId` is for writing the
 * delivery back against the lead.
 */
export const leadSummarySchema = z.object({
  leadId: z.string().min(1),
  type: leadTypeSchema,
  formId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  siteUrl: z.string().optional(),
  budgetBand: z.string().optional(),
  timeline: z.string().optional(),
  serviceInterest: z.array(z.string()),
  message: z.string().optional(),
  /** The name of the routed enquiry type, when the form asked for one. */
  enquiry: z.string().optional(),
  landingPageSlug: z.string().optional(),
  /** A calculator lead's eight answers and the estimate the API computed from them. */
  answers: calculatorLeadAnswersSchema.optional(),
  attribution: attributionSchema,
  submittedAt: z.iso.datetime(),
});
export type LeadSummary = z.infer<typeof leadSummarySchema>;

/**
 * What the visitor was told on screen after submitting. The confirmation email repeats
 * it, so the email never promises something the page did not, and the words stay
 * editable with the page instead of living in a template.
 */
export const acknowledgementSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
});
export type Acknowledgement = z.infer<typeof acknowledgementSchema>;

/**
 * What a form says when the page carries no words of its own. Defined here, beside the
 * schema it satisfies, because the API sends it, the service template shows it and the
 * snapshot import writes it, and three copies of one sentence would drift.
 */
export const DEFAULT_ACKNOWLEDGEMENT: Acknowledgement = {
  heading: 'Thanks. We have your request.',
  body: 'Someone from our team will reply to you by email.',
};

const recipientsSchema = z.array(z.email()).min(1).max(20);

/**
 * Set when the same person sent the same kind of form again and it was merged into their open
 * lead (docs/08-decisions.md, 61): the id of that submission, so its emails are their own and
 * the team sees the lead came back. Absent on a lead's first submission.
 */
const resubmissionSchema = z.string().min(1).max(40).optional();

/**
 * The two signed links a booking's own emails carry: move the call, or cancel it
 * (docs/08-decisions.md, 60). Optional so a job queued before they existed still parses.
 */
const bookingManageSchema = z.object({ rescheduleToken: z.string().min(1), cancelToken: z.string().min(1) });

/** When a reminder goes: a day before the call and an hour before it. */
export const BOOKING_REMINDER_WINDOWS = [
  { key: '24h', hours: 24 },
  { key: '1h', hours: 1 },
] as const;
export type BookingReminderWindow = (typeof BOOKING_REMINDER_WINDOWS)[number]['key'];
export const bookingReminderWindowSchema = z.enum(['24h', '1h']);

/** What happened to a booking, for the emails that say so. */
export const bookingChangeSchema = z.enum(['booked', 'moved', 'cancelled']);
export type BookingChange = z.infer<typeof bookingChangeSchema>;

/** The call itself, as every booking email describes it. */
const bookingCallShape = {
  bookingId: z.string().min(1),
  name: z.string().min(1),
  consultationType: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  /** The visitor's own zone, so the email states the time in the clock they read. */
  timezone: z.string().min(1),
};

export const emailJobSchema = z.discriminatedUnion('template', [
  /** Sent to the person who filled the form. */
  z.object({
    template: z.literal('lead-confirmation'),
    to: recipientsSchema,
    lead: leadSummarySchema,
    acknowledgement: acknowledgementSchema,
    resubmission: resubmissionSchema,
  }),
  /** Sent to the addresses in the `leads.notificationRecipients` setting. */
  z.object({
    template: z.literal('lead-notification'),
    to: recipientsSchema,
    lead: leadSummarySchema,
    resubmission: resubmissionSchema,
  }),
  /**
   * The cost calculator's emailed copy of the result (docs/03, "Cost calculator"). The
   * figures and the words are built by the API from the estimate it stored and the page's
   * copy, so the email repeats exactly what the visitor saw.
   */
  z.object({
    template: z.literal('calculator-result'),
    to: recipientsSchema,
    lead: leadSummarySchema,
    result: calculatorResultEmailSchema,
    resubmission: resubmissionSchema,
  }),
  /**
   * The booking family (task 5.1). No meeting link is generated: the note says a person
   * sends one by hand, so the email promises only what actually happens.
   */
  z.object({
    template: z.literal('booking-confirmation'),
    to: recipientsSchema,
    ...bookingCallShape,
    manage: bookingManageSchema.optional(),
  }),
  /**
   * Sent to us when a call is booked, moved or cancelled. Without `change` it is a booking, so
   * a job queued before calls could be moved still reads as what it was.
   */
  z.object({
    template: z.literal('booking-notification'),
    to: recipientsSchema,
    bookingId: z.string().min(1),
    name: z.string().min(1),
    email: z.email(),
    consultationType: z.string().min(1),
    startsAt: z.iso.datetime(),
    timezone: z.string().min(1),
    context: z.string().nullable(),
    change: bookingChangeSchema.optional(),
    /** Where a moved call was before. */
    previousStartsAt: z.iso.datetime().nullable().optional(),
  }),
  /**
   * A day and an hour before the call, queued with a delay when the call is booked or moved
   * (docs/08-decisions.md, 60). The worker checks the booking again before sending, so a call
   * cancelled or moved since is never reminded about at its old time.
   */
  z.object({
    template: z.literal('booking-reminder'),
    to: recipientsSchema,
    ...bookingCallShape,
    window: bookingReminderWindowSchema,
    manage: bookingManageSchema.optional(),
  }),
  /** Sent to the visitor when they move or cancel their call from its signed link. */
  z.object({
    template: z.literal('booking-changed'),
    to: recipientsSchema,
    ...bookingCallShape,
    change: z.enum(['moved', 'cancelled']),
    previousStartsAt: z.iso.datetime().nullable(),
    manage: bookingManageSchema.optional(),
  }),
  /**
   * A campaign's test send (Task 5.4). It carries the content as it was saved when the
   * test was asked for, so an edit made while the job waits does not change what the
   * team is looking at. `testId` makes each request its own job: two tests of the same
   * campaign are two emails, but a retry of one is still one.
   */
  z.object({
    template: z.literal('campaign-test'),
    to: z.array(z.email()).min(1).max(5),
    campaignId: z.string().min(1),
    testId: z.string().min(1).max(40),
    content: campaignContentSchema,
    /** Whose details fill the tokens: the person who asked for the test. */
    recipient: z.object({ name: z.string().nullable(), email: z.email() }),
  }),
]);
export type EmailJob = z.infer<typeof emailJobSchema>;
export type EmailTemplateKey = EmailJob['template'];

/**
 * One job per lead and template. The API adds with this id and the worker sends with
 * it as the provider idempotency key, so neither a repeated add nor a retried send can
 * email anyone twice. BullMQ does not allow ':' in custom ids.
 */
export function emailJobId(job: {
  template: EmailTemplateKey;
  lead?: { leadId: string };
  bookingId?: string;
  campaignId?: string;
  testId?: string;
  window?: string;
  change?: string;
  startsAt?: string;
  resubmission?: string;
}): string {
  if (job.lead && job.resubmission) return `${job.template}-${job.lead.leadId}-${job.resubmission}`;
  // A booking can be reminded twice and moved or cancelled after it was booked, and each is
  // its own email. The window or the change and the call's time make the id, so moving a
  // call and moving it back are two emails, while a retry of either is still one.
  const occasion = job.window ?? (job.change && job.change !== 'booked' ? job.change : undefined);
  if (job.bookingId && occasion) {
    const at = job.startsAt ? Date.parse(job.startsAt) : 0;
    return `${job.template}-${job.bookingId}-${occasion}-${String(at)}`;
  }
  const subject =
    job.lead?.leadId ?? job.bookingId ?? (job.campaignId && job.testId ? `${job.campaignId}-${job.testId}` : undefined);
  // A job with neither would collide with every other job of its template, which is the
  // one way this id can cause the duplicate send it exists to prevent.
  if (subject === undefined) throw new Error(`emailJobId: a ${job.template} job names no lead, booking or campaign test`);
  return `${job.template}-${subject}`;
}

/**
 * A job on the email queue that names a row of the email outbox (docs/08-decisions.md, 71).
 * The row holds the email, written with the lead or the booking it belongs to; the job only
 * points at it, so what is sent is what was committed.
 */
export const emailOutboxJobSchema = z.object({ outboxId: z.string().min(1) });
export type EmailOutboxJob = z.infer<typeof emailOutboxJobSchema>;

/**
 * An outbox row's job id, and the provider's idempotency key when it is sent. One row is one
 * job and one email, however often the API and the worker's sweep add it. BullMQ does not
 * allow ':' in custom ids, and a cuid has none.
 */
export function emailOutboxJobId(outboxId: string): string {
  return `outbox-${outboxId}`;
}

const DAY_SECONDS = 24 * 60 * 60;

/**
 * How an email job is retried, and how long it stays in Redis: a day once sent, a week if
 * every attempt failed. The payload itself lives in Postgres for an outbox job.
 */
export const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { age: DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
} as const;

/**
 * An outbox row as a job for the email queue, delayed until its time. The API adds this
 * right after its transaction commits and the worker's sweep adds the same for any row still
 * pending, so the two can never disagree about the id, the delay or the retries.
 */
export function emailOutboxQueueEntry(row: { id: string; template: string; sendAt: Date }, now: Date = new Date()) {
  const delay = row.sendAt.getTime() - now.getTime();
  const data: EmailOutboxJob = { outboxId: row.id };
  return {
    name: row.template,
    data,
    opts: { ...EMAIL_JOB_OPTIONS, jobId: emailOutboxJobId(row.id), ...(delay > 0 ? { delay } : {}) },
  };
}
