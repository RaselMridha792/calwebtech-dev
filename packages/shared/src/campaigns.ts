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

export const CAMPAIGN_ERRORS = {
  locked: 'campaign_locked',
  segmentUnknown: 'segment_unknown',
  queueUnavailable: 'queue_unavailable',
} as const;
