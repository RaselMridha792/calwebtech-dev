import { BOOKING_REMINDER_WINDOWS, emailJobId } from '@calwebtech/shared';
import type { OutboxEmail } from '../queue/email-outbox';

/**
 * A booking's reminders, a day and an hour before the call (docs/08-decisions.md, 60).
 *
 * They are outbox rows due at their time (decision 71), queued as delayed jobs. Moving a call
 * withdraws the rows for its old time and writes new ones, and cancelling or closing it
 * withdraws them, in the same transaction as the change; the jobs are then taken off the
 * queue. The worker checks the row and the booking again before sending, which covers a
 * removal that could not happen — a job already being sent, or Redis briefly away.
 */
export interface RemindedCall {
  id: string;
  name: string;
  email: string;
  consultationType: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  rescheduleToken: string;
  cancelToken: string;
}

/**
 * The reminders for a call, each due at its time. A time already past is left out, since a
 * reminder after the fact reminds nobody.
 */
export function reminderEmails(call: RemindedCall, now: Date = new Date()): OutboxEmail[] {
  return BOOKING_REMINDER_WINDOWS.map((window) => ({
    sendAt: new Date(call.startsAt.getTime() - window.hours * 60 * 60 * 1000),
    job: {
      template: 'booking-reminder' as const,
      to: [call.email],
      bookingId: call.id,
      name: call.name,
      consultationType: call.consultationType,
      startsAt: call.startsAt.toISOString(),
      endsAt: call.endsAt.toISOString(),
      timezone: call.timezone,
      window: window.key,
      manage: { rescheduleToken: call.rescheduleToken, cancelToken: call.cancelToken },
    },
  })).filter((email) => email.sendAt.getTime() > now.getTime());
}

/**
 * The ids reminders had before the outbox, when they were queued straight from the API. A
 * call booked before decision 71 may still have such a job waiting, so moving or cancelling it
 * takes these off the queue as well.
 */
export function reminderJobIds(call: { id: string; startsAt: Date }): string[] {
  return BOOKING_REMINDER_WINDOWS.map((window) =>
    emailJobId({
      template: 'booking-reminder',
      bookingId: call.id,
      window: window.key,
      startsAt: call.startsAt.toISOString(),
    }),
  );
}
