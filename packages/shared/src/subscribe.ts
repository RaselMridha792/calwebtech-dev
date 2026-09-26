import { z } from 'zod';
import { formElapsedSchema } from './antispam';

/**
 * Subscribing from the website: one email address, and nothing else.
 *
 * This is where `Subscriber` rows come from. Until the owner asked for a "Subscribe now" call
 * to action on the homepage nothing created them (docs/08-decisions.md, 53), so the campaign
 * engine had an audience builder and no audience.
 */

/** Where the address was given, as a path on this site. Stored as the subscriber's source page. */
export const SUBSCRIBE_SOURCE_HOME = '/';

/** A path, not a URL: this is stored and later matched by a segment rule, so it stays tidy. */
const sourcePageSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/[A-Za-z0-9\-._~/]*$/, 'A path on this site');

export const subscribeSubmissionSchema = z.object({
  /** Lower-cased on the way in, so `A@B.com` and `a@b.com` are one person. */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email()),
  sourcePage: sourcePageSchema.default(SUBSCRIBE_SOURCE_HOME),
  turnstileToken: z.string().max(2048).optional(),
  /**
   * The honeypot, under the name the lead forms already use for theirs. It is a visually hidden
   * field a person never fills in; a bot that does has its submission discarded.
   */
  referenceCode: z.string().max(500).optional(),
  /** How long the form was open before it was sent (antispam.ts). */
  formElapsedMs: formElapsedSchema,
});
export type SubscribeSubmission = z.output<typeof subscribeSubmissionSchema>;
export type SubscribeSubmissionInput = z.input<typeof subscribeSubmissionSchema>;

/**
 * The same answer whether the address is new, already subscribed, unsubscribed or suppressed.
 * Anything else would let a stranger type an address into a public form and learn whether it
 * is on a list, or whether its owner once asked to be left alone.
 */
export const subscribeResultSchema = z.object({ status: z.literal('subscribed') });
export type SubscribeResult = z.infer<typeof subscribeResultSchema>;

export const SUBSCRIBE_ERRORS = {
  botCheckFailed: 'bot_check_failed',
} as const;

// ---------------------------------------------------------------- the call to action's copy

const text = (max: number) => z.string().trim().min(1).max(max);

/** The homepage band's words. Editable content, like every other line on the page. */
export const subscribeCopySchema = z.object({
  heading: text(80),
  intro: text(240),
  emailLabel: text(40),
  placeholder: text(60),
  submitLabel: text(30),
  /** Shown beside the button: what the address is being given for. */
  consent: text(240),
  success: text(160),
  /** The errors a visitor can do something about. */
  invalid: text(120),
  botCheck: text(160),
  rateLimited: text(160),
  unavailable: text(160),
});
export type SubscribeCopy = z.infer<typeof subscribeCopySchema>;

export const DEFAULT_SUBSCRIBE_COPY: SubscribeCopy = {
  heading: 'Subscribe now',
  intro: 'Get our latest articles and guides by email. No spam, and you can unsubscribe at any time.',
  emailLabel: 'Email address',
  placeholder: 'you@company.com',
  submitLabel: 'Subscribe',
  consent: 'By subscribing you agree to receive emails from Calwebtech.',
  success: 'Thank you. You are on the list.',
  invalid: 'Please enter a valid email address.',
  botCheck: 'We could not confirm this request came from a person. Please try again.',
  rateLimited: 'You have sent several requests in a row. Please wait a minute and try again.',
  unavailable: 'Subscribing is not available right now. Please try again later.',
};
