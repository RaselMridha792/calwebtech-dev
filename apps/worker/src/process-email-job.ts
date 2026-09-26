import { renderEmail } from '@calwebtech/emails';
import {
  emailJobId,
  emailJobSchema,
  emailOutboxJobId,
  emailOutboxJobSchema,
  type EmailTemplateKey,
  type SiteContact,
} from '@calwebtech/shared';
import { UnrecoverableError } from 'bullmq';
import type { EmailTransport } from './transport';

export interface DeliveryRecord {
  template: EmailTemplateKey;
  to: string[];
  transport: string;
  providerId: string;
  /** The real recipients, when EMAIL_REDIRECT_TO sent the email elsewhere. */
  redirectedFrom?: string[];
  /** Which reminder this was, for a booking's timeline. */
  window?: string;
  /** The outbox row the email was, marked sent in the same transaction as this record. */
  outboxId?: string;
}

/** A booking as the reminder check needs it: whether it is still on, and when. */
export interface BookingState {
  status: string;
  startsAt: Date;
}

/** An outbox row as the processor reads it (docs/08-decisions.md, 71). */
export interface OutboxEmailState {
  payload: unknown;
  sentAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
}

/** What the processor needs from the database. */
export interface DeliveryStore {
  siteContact(): Promise<SiteContact | null>;
  recordDelivery(leadId: string, record: DeliveryRecord): Promise<void>;
  /** A booking has no lead, so its emails are recorded on its own timeline. */
  recordBookingDelivery(bookingId: string, record: DeliveryRecord): Promise<void>;
  /** The booking as it stands now, or null when there is none. */
  bookingState(bookingId: string): Promise<BookingState | null>;
  /** The outbox row a job names, or null when it went with its lead or booking. */
  outboxEmail(outboxId: string): Promise<OutboxEmailState | null>;
  /** Withdraws a row that is not to be sent, with why, so the sweep stops queuing it. */
  withdrawOutboxEmail(outboxId: string, reason: string): Promise<void>;
}

/** The row an outbox job names, or null for a job that carries its own email. */
export function outboxIdOf(data: unknown): string | null {
  const parsed = emailOutboxJobSchema.safeParse(data);
  return parsed.success ? parsed.data.outboxId : null;
}

/** A booking in one of these still happens at its time; any other is over or cancelled. */
const ACTIVE_BOOKING = new Set(['CONFIRMED', 'RESCHEDULED']);

/** Why a reminder was not sent. */
const REMINDER_NOT_DUE = 'the call was moved or cancelled';

/**
 * Whether a reminder queued for a call's time still describes the call. The API removes a
 * cancelled or moved call's reminders, but a removal that failed, or one that raced the
 * worker picking the job up, must not remind anyone of a call that is not happening then
 * (docs/08-decisions.md, 60).
 */
export function reminderStillDue(state: BookingState | null, startsAt: string): boolean {
  return state !== null && ACTIVE_BOOKING.has(state.status) && state.startsAt.getTime() === Date.parse(startsAt);
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
 * A lead's or a booking's email is an outbox row, and its job only names the row
 * (docs/08-decisions.md, 71). The row is read first: one already sent, withdrawn or given
 * up on is not sent again, however it came to be queued twice. A job queued before the
 * outbox, and a campaign's test send, carry their email themselves.
 *
 * A payload that fails the shared schema can never succeed, so it is not retried. A
 * transport or database failure throws and BullMQ retries it; the idempotency key stops
 * a retry after a successful send from emailing anyone twice.
 */
export function createEmailJobProcessor({ transport, store, from, redirectTo, siteOrigin }: EmailJobProcessorOptions) {
  return async (job: { data: unknown }): Promise<{ providerId: string }> => {
    const outboxId = outboxIdOf(job.data);
    let payload: unknown = job.data;
    if (outboxId) {
      const row = await store.outboxEmail(outboxId);
      if (!row) return { providerId: 'skipped: the email went with its lead or booking' };
      if (row.sentAt || row.cancelledAt || row.failedAt) return { providerId: 'skipped: already sent or withdrawn' };
      payload = row.payload;
    }

    const parsed = emailJobSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid email job payload: ${parsed.error.message}`);
    }
    const email = parsed.data;

    if (email.template === 'booking-reminder') {
      const state = await store.bookingState(email.bookingId);
      if (!reminderStillDue(state, email.startsAt)) {
        if (outboxId) await store.withdrawOutboxEmail(outboxId, REMINDER_NOT_DUE);
        return { providerId: `skipped: ${REMINDER_NOT_DUE}` };
      }
    }

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
      ...(rendered.attachments ? { attachments: rendered.attachments } : {}),
      idempotencyKey: outboxId ? emailOutboxJobId(outboxId) : emailJobId(email),
    });

    const record: DeliveryRecord = {
      template: email.template,
      to: redirectTo ? [redirectTo] : email.to,
      transport: transport.name,
      providerId: id,
      ...(redirectTo ? { redirectedFrom: email.to } : {}),
      ...(email.template === 'booking-reminder' ? { window: email.window } : {}),
      ...(outboxId ? { outboxId } : {}),
    };
    // A campaign test belongs to no lead or booking. The API audited the request, and the
    // provider id is in the job's return value; a test writes no delivery row, because the
    // campaign's report counts only the people it was sent to.
    if (email.template === 'campaign-test') return { providerId: id };
    if ('bookingId' in email) await store.recordBookingDelivery(email.bookingId, record);
    else await store.recordDelivery(email.lead.leadId, record);
    return { providerId: id };
  };
}
