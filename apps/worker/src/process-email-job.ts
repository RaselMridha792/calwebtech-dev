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
}

export interface EmailJobProcessorOptions {
  transport: EmailTransport;
  store: DeliveryStore;
  from: string;
  redirectTo?: string;
}

/**
 * Processes one job from the email queue: validate, render, send, record.
 *
 * A payload that fails the shared schema can never succeed, so it is not retried. A
 * transport or database failure throws and BullMQ retries it; the idempotency key stops
 * a retry after a successful send from emailing anyone twice.
 */
export function createEmailJobProcessor({ transport, store, from, redirectTo }: EmailJobProcessorOptions) {
  return async (job: { data: unknown }): Promise<{ providerId: string }> => {
    const parsed = emailJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid email job payload: ${parsed.error.message}`);
    }
    const email = parsed.data;

    const contact = await store.siteContact();
    const rendered = await renderEmail(email, { contact });
    const replyTo = email.template === 'lead-confirmation' ? contact?.email : email.lead.email;

    const { id } = await transport.send({
      from,
      to: redirectTo ? [redirectTo] : email.to,
      subject: redirectTo ? `[to ${email.to.join(', ')}] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(replyTo ? { replyTo } : {}),
      idempotencyKey: emailJobId(email),
    });

    await store.recordDelivery(email.lead.leadId, {
      template: email.template,
      to: redirectTo ? [redirectTo] : email.to,
      transport: transport.name,
      providerId: id,
      ...(redirectTo ? { redirectedFrom: email.to } : {}),
    });
    return { providerId: id };
  };
}
