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

export const emailJobSchema = z.discriminatedUnion('template', [
  /** Sent to the person who filled the form. */
  z.object({
    template: z.literal('lead-confirmation'),
    to: recipientsSchema,
    lead: leadSummarySchema,
    acknowledgement: acknowledgementSchema,
  }),
  /** Sent to the addresses in the `leads.notificationRecipients` setting. */
  z.object({
    template: z.literal('lead-notification'),
    to: recipientsSchema,
    lead: leadSummarySchema,
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
  }),
  /**
   * The booking family (task 5.1). No meeting link is generated: the note says a person
   * sends one by hand, so the email promises only what actually happens.
   */
  z.object({
    template: z.literal('booking-confirmation'),
    to: recipientsSchema,
    bookingId: z.string().min(1),
    name: z.string().min(1),
    consultationType: z.string().min(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    /** The visitor's own zone, so the email states the time in the clock they read. */
    timezone: z.string().min(1),
  }),
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
}): string {
  const subject =
    job.lead?.leadId ?? job.bookingId ?? (job.campaignId && job.testId ? `${job.campaignId}-${job.testId}` : undefined);
  // A job with neither would collide with every other job of its template, which is the
  // one way this id can cause the duplicate send it exists to prevent.
  if (subject === undefined) throw new Error(`emailJobId: a ${job.template} job names no lead, booking or campaign test`);
  return `${job.template}-${subject}`;
}
