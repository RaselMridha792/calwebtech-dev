import { BOOKING_REMINDER_WINDOWS, emailJobId, type EmailJob } from '@calwebtech/shared';

/**
 * A booking's reminders, a day and an hour before the call (docs/08-decisions.md, 60).
 *
 * They are delayed jobs on the email queue, named by the booking, the window and the call's
 * time: moving a call removes the reminders for its old time and adds new ones, and cancelling
 * it removes them. The worker checks the booking again before sending, which covers a removal
 * that could not happen — a job already being sent, or Redis briefly away.
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

/** The reminder jobs for a call and when each is due. */
export function reminderJobs(call: RemindedCall): { job: EmailJob; at: Date }[] {
  return BOOKING_REMINDER_WINDOWS.map((window) => ({
    at: new Date(call.startsAt.getTime() - window.hours * 60 * 60 * 1000),
    job: {
      template: 'booking-reminder',
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
  }));
}

/** The ids of a call's reminders at a given time, to take them off the queue. */
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
