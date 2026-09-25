import { z } from 'zod';
import { formElapsedSchema } from './antispam';
import { calculatorAnswersSchema } from './calculator';
import { slugSchema } from './seo';

/** Mirrors the `LeadType` enum in packages/db/prisma/schema.prisma. */
export const LEAD_TYPES = [
  'PROJECT',
  'SERVICE_ENQUIRY',
  'CONSULTATION',
  'CONTACT',
  'CALCULATOR',
  'AUDIT',
  'RESOURCE',
  'CAREERS',
] as const;
export const leadTypeSchema = z.enum(LEAD_TYPES);
export type LeadType = z.infer<typeof leadTypeSchema>;

/** Stored values are stable segmentation keys; labels are what visitors see. */
export const BUDGET_BANDS = [
  { value: 'under-12k', label: 'Under $12,000' },
  { value: '12k-25k', label: '$12,000 to $25,000' },
  { value: '25k-60k', label: '$25,000 to $60,000' },
  { value: '60k-120k', label: '$60,000 to $120,000' },
  { value: 'over-120k', label: 'Over $120,000' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number]['value'];
const BUDGET_BAND_VALUES = BUDGET_BANDS.map((band) => band.value) as [BudgetBand, ...BudgetBand[]];

export const START_TIMELINES = [
  { value: 'asap', label: 'As soon as possible' },
  { value: 'within-a-month', label: 'Within the next month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'researching', label: 'Just researching for now' },
] as const;
export type StartTimeline = (typeof START_TIMELINES)[number]['value'];
const START_TIMELINE_VALUES = START_TIMELINES.map((item) => item.value) as [
  StartTimeline,
  ...StartTimeline[],
];

/** What the brief is for, stored on `Lead.projectType`. Values are stable segmentation keys. */
export const LEAD_PROJECT_TYPES = [
  { value: 'new-website', label: 'A new website' },
  { value: 'redesign', label: 'A redesign of the site we have' },
  { value: 'ecommerce', label: 'An online store' },
  { value: 'web-application', label: 'A web application or customer portal' },
  { value: 'replatform', label: 'A move to another platform' },
  { value: 'care-and-improvement', label: 'Ongoing care and improvement' },
] as const;
export type LeadProjectType = (typeof LEAD_PROJECT_TYPES)[number]['value'];
const LEAD_PROJECT_TYPE_VALUES = LEAD_PROJECT_TYPES.map((item) => item.value) as [
  LeadProjectType,
  ...LeadProjectType[],
];

/** What is wrong with the site an audit is requested for. */
export const LEAD_AUDIT_CONCERNS = [
  { value: 'not-enough-enquiries', label: 'It does not bring in enough enquiries' },
  { value: 'slow-on-mobile', label: 'It is slow, especially on mobile' },
  { value: 'search-visibility', label: 'It does not show up in search or AI answers' },
  { value: 'dated-design', label: 'It looks dated next to our competitors' },
  { value: 'hard-to-edit', label: 'We cannot edit it without a developer' },
  { value: 'not-sure', label: 'Something is wrong and we cannot tell what' },
] as const;
export type LeadAuditConcern = (typeof LEAD_AUDIT_CONCERNS)[number]['value'];
const LEAD_AUDIT_CONCERN_VALUES = LEAD_AUDIT_CONCERNS.map((item) => item.value) as [
  LeadAuditConcern,
  ...LeadAuditConcern[],
];

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const utmSchema = z.object({
  source: z.string().trim().max(200).optional(),
  medium: z.string().trim().max(200).optional(),
  campaign: z.string().trim().max(200).optional(),
  term: z.string().trim().max(200).optional(),
  content: z.string().trim().max(200).optional(),
});
export type Utm = z.infer<typeof utmSchema>;

export const DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;

/** Source attribution captured in the browser and stored on `LeadAttribution`. */
export const attributionSchema = z.object({
  firstTouch: utmSchema.optional(),
  lastTouch: utmSchema.optional(),
  referrer: z.string().trim().max(2000).optional(),
  landingPage: z.string().trim().max(2000).optional(),
  device: z.enum(DEVICE_TYPES).optional(),
});
export type Attribution = z.infer<typeof attributionSchema>;
export { utmSchema };

const siteUrlSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .pipe(
      z.url({
        protocol: /^https?$/,
        hostname: /\./,
        error: 'Enter a website address, for example company.com',
      }),
    )
    .optional(),
);

/** Payload accepted by `POST /leads`. Every public form posts this shape. */
export const leadSubmissionSchema = z.object({
  type: leadTypeSchema,
  /** Which form on the page produced the lead, e.g. "lp-hero". */
  formId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(2, 'Enter your full name').max(120, 'That name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: 'Enter a valid email address' })),
  company: optionalText(160),
  phone: optionalText(40),
  siteUrl: siteUrlSchema,
  budgetBand: z.preprocess(blankToUndefined, z.enum(BUDGET_BAND_VALUES).optional()),
  timeline: z.preprocess(blankToUndefined, z.enum(START_TIMELINE_VALUES).optional()),
  referralSource: optionalText(80),
  serviceInterest: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  message: optionalText(4000),
  /** The routed enquiry type chosen on the contact form: an `EnquiryType.slug`, checked by the API. */
  enquiryType: z.preprocess(blankToUndefined, slugSchema.optional()),
  landingPageSlug: z.preprocess(blankToUndefined, slugSchema.optional()),
  /** The service page the enquiry came from. The API links the lead to it when it is published. */
  serviceSlug: z.preprocess(blankToUndefined, slugSchema.optional()),
  /** What the brief is for, from the start a project form (`LEAD_PROJECT_TYPES`). */
  projectType: z.preprocess(blankToUndefined, z.enum(LEAD_PROJECT_TYPE_VALUES).optional()),
  /**
   * Addresses of briefs, wireframes or references the visitor wants us to read. Files wait
   * for media storage, so the forms ask for links instead (docs/06-build-plan.md, task 5.3).
   */
  projectLinks: optionalText(1000),
  /** What is wrong with the site, from the free website audit form (`LEAD_AUDIT_CONCERNS`). */
  mainConcern: z.preprocess(blankToUndefined, z.enum(LEAD_AUDIT_CONCERN_VALUES).optional()),
  /** A competitor whose site the audit should be compared against. */
  competitorUrl: siteUrlSchema,
  /**
   * Structured answers stored on `Lead.answers`. The cost calculator sends its eight
   * answers here; the API validates them, recomputes the estimate itself and never trusts a
   * figure from the browser (calculator.ts).
   */
  answers: calculatorAnswersSchema.optional(),
  /**
   * An unfinished brief this submission completes, with the token the API issued for it, so
   * the final submit finishes the lead that progressive saving already stored rather than
   * creating a second one.
   */
  draftId: optionalText(64),
  draftToken: optionalText(128),
  attribution: attributionSchema.default({}),
  /** Honeypot. Hidden from people; a value here means a bot filled the form. */
  referenceCode: z.string().max(500).optional(),
  /** Cloudflare Turnstile token from the widget. The API verifies it before storing anything. */
  turnstileToken: z.preprocess(blankToUndefined, z.string().max(2048).optional()),
  /** How long the form was open before it was sent (antispam.ts). */
  formElapsedMs: formElapsedSchema,
});

export type LeadSubmissionInput = z.input<typeof leadSubmissionSchema>;
export type LeadSubmission = z.output<typeof leadSubmissionSchema>;

export const leadReceivedSchema = z.object({ status: z.literal('received') });
export type LeadReceived = z.infer<typeof leadReceivedSchema>;

/** `POST /leads` answers 403 with this body when Turnstile rejects the submission. */
export const botCheckFailedResponseSchema = z.object({ error: z.literal('bot_check_failed') });
export type BotCheckFailedResponse = z.infer<typeof botCheckFailedResponseSchema>;
