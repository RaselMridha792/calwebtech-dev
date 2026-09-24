import { z } from 'zod';

/**
 * Campaigns (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * A campaign's body is a short list of blocks, not HTML. The template decides how a block
 * looks, so every campaign is on brand without anyone writing markup, and the same body
 * renders to HTML and to a plain-text part from one source.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// ---------------------------------------------------------------- personalisation

/** The tokens a campaign may use, and what each one is filled from. */
export const CAMPAIGN_TOKENS = ['name', 'firstName', 'email'] as const;
export type CampaignToken = (typeof CAMPAIGN_TOKENS)[number];

export const CAMPAIGN_TOKEN_HELP: Record<CampaignToken, string> = {
  name: 'Full name, as they gave it',
  firstName: 'The first word of their name',
  email: 'Their email address',
};

/**
 * `{{firstName}}` or `{{firstName|there}}`. The part after the bar is the fallback, used
 * when the subscriber gave no name: "Hi {{firstName|there}}" reads "Hi there" rather than
 * "Hi ".
 */
const TOKEN_PATTERN = /\{\{\s*([A-Za-z]+)\s*(?:\|([^{}]*))?\}\}/g;

function isCampaignToken(value: string): value is CampaignToken {
  return (CAMPAIGN_TOKENS as readonly string[]).includes(value);
}

/** Token names in a piece of text that are not ones a campaign can fill. */
export function unknownTokens(text: string): string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map((match) => match[1] ?? '').filter((name) => !isCampaignToken(name));
}

export interface CampaignRecipient {
  name: string | null;
  email: string;
}

/** Fills every token from the recipient, falling back where a value is missing. */
export function personalise(text: string, recipient: CampaignRecipient): string {
  const name = recipient.name?.trim() ?? '';
  const values: Record<CampaignToken, string> = {
    name,
    firstName: name.split(/\s+/)[0] ?? '',
    email: recipient.email,
  };
  return text.replace(TOKEN_PATTERN, (_match, token: string, fallback: string | undefined) => {
    const value = isCampaignToken(token) ? values[token] : '';
    return value || (fallback ?? '').trim();
  });
}

/** A text field that may carry tokens, all of them ones a campaign can fill. */
function tokenText(max: number, required: string) {
  return z
    .string()
    .trim()
    .min(1, required)
    .max(max)
    .superRefine((value, context) => {
      const unknown = unknownTokens(value);
      if (unknown.length > 0) {
        context.addIssue({
          code: 'custom',
          message: `Unknown token ${unknown.map((name) => `{{${name}}}`).join(', ')}. Use ${CAMPAIGN_TOKENS.map((name) => `{{${name}}}`).join(', ')}.`,
        });
      }
    });
}

// ---------------------------------------------------------------- the body

export const campaignBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: tokenText(200, 'A heading needs words') }),
  z.object({ type: z.literal('paragraph'), text: tokenText(5000, 'A paragraph needs words') }),
  z.object({
    type: z.literal('button'),
    label: tokenText(60, 'A button needs a label'),
    url: z
      .string()
      .trim()
      .pipe(z.url({ protocol: /^https?$/, error: 'Enter a full address starting with https://' })),
  }),
  z.object({ type: z.literal('divider') }),
]);
export type CampaignBlock = z.infer<typeof campaignBlockSchema>;
export type CampaignBlockType = CampaignBlock['type'];

export const CAMPAIGN_MAX_BLOCKS = 60;

export const campaignBodySchema = z.object({
  blocks: z
    .array(campaignBlockSchema)
    .min(1, 'Add at least one block')
    .max(CAMPAIGN_MAX_BLOCKS)
    .refine((blocks) => blocks.some((block) => block.type !== 'divider'), 'A campaign needs some words'),
});
export type CampaignBody = z.infer<typeof campaignBodySchema>;

// ---------------------------------------------------------------- templates

/**
 * The branded templates. A template is code in `packages/emails`, so it is reviewed and on
 * brand; what the dashboard chooses is which one.
 */
export const CAMPAIGN_TEMPLATES = ['letter', 'announcement'] as const;
export type CampaignTemplate = (typeof CAMPAIGN_TEMPLATES)[number];

export const CAMPAIGN_TEMPLATE_LABELS: Record<CampaignTemplate, { label: string; description: string }> = {
  letter: { label: 'Letter', description: 'A plain note from the team. Reads like an email from a person.' },
  announcement: {
    label: 'Announcement',
    description: 'The first heading set large on a dark band, for news and offers.',
  },
};

/** What is rendered: the words and the template, without the bookkeeping around them. */
export const campaignContentSchema = z.object({
  subject: tokenText(150, 'A campaign needs a subject line'),
  preheader: z.preprocess(blankToUndefined, tokenText(150, 'Preview text cannot be blank').nullable().optional()),
  templateKey: z.enum(CAMPAIGN_TEMPLATES),
  body: campaignBodySchema,
});
export type CampaignContent = z.output<typeof campaignContentSchema>;

// ---------------------------------------------------------------- the dashboard

/** Mirrors the `CampaignStatus` enum in prisma/schema.prisma. */
export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
};

export const campaignWriteSchema = campaignContentSchema.extend({
  name: z.string().trim().min(1, 'A campaign needs a name').max(120),
  segmentId: z.preprocess(blankToUndefined, z.string().max(60).nullable().optional()),
});
export type CampaignWrite = z.output<typeof campaignWriteSchema>;

export const adminCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string(),
  preheader: z.string().nullable(),
  templateKey: z.enum(CAMPAIGN_TEMPLATES),
  body: campaignBodySchema,
  status: z.enum(CAMPAIGN_STATUSES),
  scheduledAt: z.iso.datetime().nullable(),
  sentAt: z.iso.datetime().nullable(),
  segment: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Delivery rows written so far; zero until the campaign is sent. */
  recipientCount: z.number().int(),
  /** How far the send has got: sent, and not sent for good (failed, or suppressed in time). */
  progress: z.object({ sent: z.number().int(), failed: z.number().int() }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminCampaign = z.infer<typeof adminCampaignSchema>;

export const adminCampaignQuerySchema = z.object({
  status: z.preprocess(blankToUndefined, z.enum(CAMPAIGN_STATUSES).optional()),
});
export type AdminCampaignQuery = z.output<typeof adminCampaignQuerySchema>;

export const adminCampaignListSchema = z.object({ items: z.array(adminCampaignSchema) });
export type AdminCampaignList = z.infer<typeof adminCampaignListSchema>;

/**
 * A preview of content that may not be saved yet. With a segment, the first person it
 * reaches fills the tokens, so the preview reads the way a real one will.
 */
export const campaignPreviewRequestSchema = z.object({
  content: campaignContentSchema,
  segmentId: z.preprocess(blankToUndefined, z.string().max(60).nullable().optional()),
});
export type CampaignPreviewRequest = z.output<typeof campaignPreviewRequestSchema>;

export const campaignPreviewSchema = z.object({
  subject: z.string(),
  preheader: z.string().nullable(),
  html: z.string(),
  text: z.string(),
  /** Whose details filled the tokens. */
  sample: z.object({ name: z.string().nullable(), email: z.string() }),
});
export type CampaignPreview = z.infer<typeof campaignPreviewSchema>;

export const CAMPAIGN_TEST_MAX_RECIPIENTS = 5;

/** A test goes to a handful of the team's own addresses, never to a segment. */
export const campaignTestSendSchema = z.object({
  to: z
    .array(z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter valid email addresses' })))
    .min(1, 'Enter at least one address')
    .max(CAMPAIGN_TEST_MAX_RECIPIENTS, `A test goes to ${String(CAMPAIGN_TEST_MAX_RECIPIENTS)} addresses at most`),
});
export type CampaignTestSend = z.output<typeof campaignTestSendSchema>;

export const campaignTestSentSchema = z.object({ to: z.array(z.string()), queuedAt: z.iso.datetime() });
export type CampaignTestSent = z.infer<typeof campaignTestSentSchema>;

// ---------------------------------------------------------------- scheduling and sending

/**
 * When to send. `sendAt` null means now; the worker picks a due campaign up within a minute.
 * A time in the past is refused rather than read as now, because it is usually a mistake.
 */
export const campaignScheduleSchema = z.object({
  sendAt: z.iso.datetime({ offset: true }).nullable(),
});
export type CampaignSchedule = z.output<typeof campaignScheduleSchema>;

/**
 * The campaign queues. Sends go one job per recipient on `campaign`, rate limited against the
 * provider. The sweep runs on its own queue so it is never stuck behind a long send: it is
 * what starts due campaigns, requeues anything lost and marks a finished send as sent.
 */
export const CAMPAIGN_QUEUE = 'campaign';
export const CAMPAIGN_SWEEP_QUEUE = 'campaign-sweep';

export const campaignSendJobSchema = z.object({ recipientId: z.string().min(1) });
export type CampaignSendJob = z.infer<typeof campaignSendJobSchema>;

/** One job per recipient, and the provider idempotency key, so a retry never sends twice. */
export function campaignSendJobId(recipientId: string): string {
  return `campaign-send-${recipientId}`;
}

/** Why a recipient was not sent to, in the words the report shows. */
export const RECIPIENT_SKIP_REASONS = { suppressed: 'suppressed', unsubscribed: 'unsubscribed' } as const;

export const CAMPAIGN_ERRORS = {
  locked: 'campaign_locked',
  segmentUnknown: 'segment_unknown',
  queueUnavailable: 'queue_unavailable',
  noSegment: 'segment_required',
  inThePast: 'send_time_in_past',
  notScheduled: 'campaign_not_scheduled',
  sendingUnavailable: 'sending_unavailable',
} as const;

// ---------------------------------------------------------------- unsubscribing

/** What the unsubscribe page shows: whose address, masked, and whether it is done. */
export const unsubscribeViewSchema = z.object({
  email: z.string(),
  unsubscribed: z.boolean(),
});
export type UnsubscribeView = z.infer<typeof unsubscribeViewSchema>;

/** `ava@example.com` reads `a**@example.com`: enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 6)))}${email.slice(at)}`;
}

// ---------------------------------------------------------------- the report

/**
 * Where one recipient stands, furthest first: a click implies an open, an open implies a
 * delivery. A bounce or complaint outranks them all, because it is what needs acting on.
 */
export const RECIPIENT_STATES = [
  'complained',
  'bounced',
  'clicked',
  'opened',
  'delivered',
  'sent',
  'not_sent',
  'pending',
] as const;
export type RecipientState = (typeof RECIPIENT_STATES)[number];

export const RECIPIENT_STATE_LABELS: Record<RecipientState, string> = {
  complained: 'Marked as spam',
  bounced: 'Bounced',
  clicked: 'Clicked',
  opened: 'Opened',
  delivered: 'Delivered',
  sent: 'Sent',
  not_sent: 'Not sent',
  pending: 'Waiting',
};

export const campaignReportRecipientSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  state: z.enum(RECIPIENT_STATES),
  /** Why a recipient was not sent to, or the last provider error. */
  error: z.string().nullable(),
  sentAt: z.iso.datetime().nullable(),
  lastEventAt: z.iso.datetime().nullable(),
});
export type CampaignReportRecipient = z.infer<typeof campaignReportRecipientSchema>;

export const CAMPAIGN_REPORT_PAGE_SIZE = 50;

export const campaignReportQuerySchema = z.object({
  state: z.preprocess(blankToUndefined, z.enum(RECIPIENT_STATES).optional()),
  page: z.coerce.number().int().min(1).default(1),
});
export type CampaignReportQuery = z.output<typeof campaignReportQuerySchema>;

/**
 * A campaign's report. Every count is of people, not of events: somebody who opened an
 * email five times is one open. Opens are a floor, not a measure, because many mail clients
 * load images for the reader or not at all.
 */
export const campaignReportSchema = z.object({
  campaign: z.object({
    id: z.string(),
    name: z.string(),
    subject: z.string(),
    status: z.enum(CAMPAIGN_STATUSES),
    segment: z.string().nullable(),
    startedAt: z.iso.datetime().nullable(),
    finishedAt: z.iso.datetime().nullable(),
  }),
  totals: z.object({
    recipients: z.number().int(),
    sent: z.number().int(),
    notSent: z.number().int(),
    delivered: z.number().int(),
    opened: z.number().int(),
    clicked: z.number().int(),
    bounced: z.number().int(),
    complained: z.number().int(),
    /** Recipients who unsubscribed after this campaign reached them. */
    unsubscribed: z.number().int(),
  }),
  recipients: z.object({
    items: z.array(campaignReportRecipientSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
});
export type CampaignReport = z.infer<typeof campaignReportSchema>;

// ---------------------------------------------------------------- provider events

/**
 * The Resend webhook events the platform acts on (Task 5.4). Anything else is logged and
 * ignored. `email.bounced` is a permanent rejection in Resend's terms; a transient one is
 * still recorded but does not suppress the address.
 */
export const EMAIL_EVENT_TYPES = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
} as const;
export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[keyof typeof EMAIL_EVENT_TYPES];

/** What the webhook reads from a Resend event. Extra fields are kept in the stored payload. */
export const resendWebhookEventSchema = z.object({
  type: z.string().min(1),
  created_at: z.string().min(1),
  data: z
    .object({
      email_id: z.string().min(1).optional(),
      to: z.union([z.array(z.string()), z.string()]).optional(),
      bounce: z.object({ type: z.string().optional() }).loose().optional(),
    })
    .loose(),
});
export type ResendWebhookEvent = z.infer<typeof resendWebhookEventSchema>;
