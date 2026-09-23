import { renderEmail } from '@calwebtech/emails';
import { emailJobId, emailJobSchema, type EmailTemplateKey, type SiteContact } from '@calwebtech/shared';
import { UnrecoverableError } from 'bullmq';
import type { EmailTransport } from './transport';

export interface DeliveryRecord {
  template: EmailTemplateKey;
  to: string[];
  transport: string;
  providerId: string;
  /** The real recipients, when EMAIL_REDIRECT_TO sent the email elsewhere. */
  redirectedFrom?: string[];
}

/** What the processor needs from the database. */
export interface DeliveryStore {
  siteContact(): Promise<SiteContact | null>;
  recordDelivery(leadId: string, record: DeliveryRecord): Promise<void>;
  /** A booking has no lead, so its emails are recorded on its own timeline. */
  recordBookingDelivery(bookingId: string, record: DeliveryRecord): Promise<void>;
}

export interface EmailJobProcessorOptions {
  transport: EmailTransport;
  store: DeliveryStore;
  from: string;
  redirectTo?: string;
  /** APP_ORIGIN, for emails that link back to a page. Without it those links are left out. */
  siteOrigin?: string;
}

/**
 * Processes one job from the email queue: validate, render, send, record.
 *
 * A payload that fails the shared schema can never succeed, so it is not retried. A
 * transport or database failure throws and BullMQ retries it; the idempotency key stops
 * a retry after a successful send from emailing anyone twice.
 */
export function createEmailJobProcessor({ transport, store, from, redirectTo, siteOrigin }: EmailJobProcessorOptions) {
  return async (job: { data: unknown }): Promise<{ providerId: string }> => {
    const parsed = emailJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid email job payload: ${parsed.error.message}`);
    }
    const email = parsed.data;

    const contact = await store.siteContact();
    const rendered = await renderEmail(email, { contact, siteOrigin: siteOrigin ?? null });
    // An internal notification is replied to by us, to the person it is about; everything
    // else goes to the visitor, so a reply reaches the team.
    const replyTo =
      email.template === 'lead-notification'
        ? email.lead.email
        : email.template === 'booking-notification'
          ? email.email
          : contact?.email;

    const { id } = await transport.send({
      from,
      to: redirectTo ? [redirectTo] : email.to,
      subject: redirectTo ? `[to ${email.to.join(', ')}] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(replyTo ? { replyTo } : {}),
      idempotencyKey: emailJobId(email),
    });

    const record: DeliveryRecord = {
      template: email.template,
      to: redirectTo ? [redirectTo] : email.to,
      transport: transport.name,
      providerId: id,
      ...(redirectTo ? { redirectedFrom: email.to } : {}),
    };
    if ('bookingId' in email) await store.recordBookingDelivery(email.bookingId, record);
    else await store.recordDelivery(email.lead.leadId, record);
    return { providerId: id };
  };
}
