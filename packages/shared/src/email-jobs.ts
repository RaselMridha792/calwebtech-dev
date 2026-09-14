import { z } from 'zod';
import { calculatorLeadAnswersSchema, calculatorResultEmailSchema } from './calculator';
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
]);
export type EmailJob = z.infer<typeof emailJobSchema>;
export type EmailTemplateKey = EmailJob['template'];

/**
 * One job per lead and template. The API adds with this id and the worker sends with
 * it as the provider idempotency key, so neither a repeated add nor a retried send can
 * email anyone twice. BullMQ does not allow ':' in custom ids.
 */
export function emailJobId(job: Pick<EmailJob, 'template' | 'lead'>): string {
  return `${job.template}-${job.lead.leadId}`;
}
