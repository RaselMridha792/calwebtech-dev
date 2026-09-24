import { renderCampaign } from '@calwebtech/emails';
import {
  RECIPIENT_SKIP_REASONS,
  campaignSendJobId,
  campaignSendJobSchema,
  type CampaignContent,
} from '@calwebtech/shared';
import { signUnsubscribeToken, unsubscribeOneClickPath, unsubscribePagePath } from '@calwebtech/shared/unsubscribe-token';
import { UnrecoverableError } from 'bullmq';
import type { EmailTransport } from './transport';

/** One recipient, with everything the send decides on, read fresh when its turn comes. */
export interface RecipientToSend {
  id: string;
  email: string;
  subscriberId: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  name: string | null;
  unsubscribedAt: Date | null;
  /** On the suppression list now, not when the audience was counted. */
  suppressed: boolean;
  content: CampaignContent;
}

export interface CampaignSendStore {
  recipient(recipientId: string): Promise<RecipientToSend | null>;
  markSent(recipientId: string, providerId: string): Promise<void>;
  markNotSent(recipientId: string, reason: string): Promise<void>;
}

export interface CampaignSendOptions {
  transport: EmailTransport;
  store: CampaignSendStore;
  from: string;
  siteOrigin: string;
  secret: string;
  redirectTo?: string;
}

/**
 * Sends one campaign email (Task 5.4).
 *
 * Suppression and unsubscribes are checked again here, at the moment of sending, and not
 * only when the audience was counted: somebody who unsubscribes from the first email of a
 * long send must not get it again from a later campaign already under way. This is the rule
 * that no campaign can override the suppression list, applied where it cannot be skipped.
 *
 * A recipient already sent to is left alone, so a job run twice — a retry after the send
 * succeeded, or a requeue by the sweep — never emails anyone twice. The provider's
 * idempotency key covers the gap between the send and the row being written.
 */
export function createCampaignSendProcessor({ transport, store, from, siteOrigin, secret, redirectTo }: CampaignSendOptions) {
  return async (job: { data: unknown }): Promise<{ status: 'sent' | 'skipped' | 'already'; providerId?: string }> => {
    const parsed = campaignSendJobSchema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError(`Invalid campaign job payload: ${parsed.error.message}`);
    const { recipientId } = parsed.data;

    const recipient = await store.recipient(recipientId);
    if (!recipient) throw new UnrecoverableError(`Campaign recipient ${recipientId} no longer exists`);
    if (recipient.sentAt || recipient.failedAt) return { status: 'already' };

    if (recipient.suppressed) {
      await store.markNotSent(recipientId, RECIPIENT_SKIP_REASONS.suppressed);
      return { status: 'skipped' };
    }
    if (recipient.unsubscribedAt || !recipient.subscriberId) {
      await store.markNotSent(recipientId, RECIPIENT_SKIP_REASONS.unsubscribed);
      return { status: 'skipped' };
    }

    const token = signUnsubscribeToken(recipient.subscriberId, secret);
    const origin = siteOrigin.replace(/\/$/, '');
    const unsubscribeUrl = `${origin}${unsubscribePagePath(token)}`;
    const rendered = await renderCampaign({
      content: recipient.content,
      recipient: { name: recipient.name, email: recipient.email },
      unsubscribeUrl,
    });

    const { id } = await transport.send({
      from,
      to: redirectTo ? [redirectTo] : [recipient.email],
      subject: redirectTo ? `[to ${recipient.email}] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: campaignSendJobId(recipientId),
      headers: {
        // RFC 8058: one click in the mail client unsubscribes, with no page in between.
        'List-Unsubscribe': `<${origin}${unsubscribeOneClickPath(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    await store.markSent(recipientId, id);
    return { status: 'sent', providerId: id };
  };
}
