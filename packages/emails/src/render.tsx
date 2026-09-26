import type { EmailJob, SiteContact } from '@calwebtech/shared';
import { render } from 'react-email';
import type { ReactElement } from 'react';
import {
  BookingChangedEmail,
  BookingConfirmationEmail,
  BookingNotificationEmail,
  BookingReminderEmail,
  bookingChangedSubject,
  bookingConfirmationSubject,
  bookingNotificationSubject,
  bookingReminderSubject,
} from './booking';
import { CalculatorResultEmailTemplate, calculatorResultSubject } from './calculator-result';
import { CampaignEmail, campaignSubject } from './campaign';
import { bookingInvite, type InviteAttachment } from './invite';
import { LeadConfirmationEmail, leadConfirmationSubject } from './lead-confirmation';
import { LeadNotificationEmail, leadNotificationSubject } from './lead-notification';

/** Data the worker loads at send time rather than carrying in the job. */
export interface EmailContext {
  contact: SiteContact | null;
  /**
   * The site's public origin (APP_ORIGIN), for emails that link back to a page. Jobs carry
   * site paths, never a host, so nothing a form is submitted with can put another domain in
   * an email. Null leaves those links out.
   */
  siteOrigin?: string | null;
  /** When the email is rendered; a calendar entry's version is taken from it. */
  now?: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** A calendar entry, on the emails about a booked, moved or cancelled call. */
  attachments?: InviteAttachment[];
}

function compose(job: EmailJob, context: EmailContext): { subject: string; element: ReactElement } {
  switch (job.template) {
    case 'lead-confirmation':
      return {
        subject: leadConfirmationSubject(job.lead),
        element: (
          <LeadConfirmationEmail lead={job.lead} acknowledgement={job.acknowledgement} contact={context.contact} />
        ),
      };
    case 'lead-notification':
      return {
        subject: leadNotificationSubject(job.lead, job.resubmission !== undefined),
        element: <LeadNotificationEmail lead={job.lead} returning={job.resubmission !== undefined} />,
      };
    case 'calculator-result':
      return {
        subject: calculatorResultSubject(job.result),
        element: (
          <CalculatorResultEmailTemplate lead={job.lead} result={job.result} siteOrigin={context.siteOrigin ?? null} />
        ),
      };
    case 'booking-confirmation':
      return {
        subject: bookingConfirmationSubject(job),
        element: <BookingConfirmationEmail {...job} siteOrigin={context.siteOrigin ?? null} />,
      };
    case 'booking-notification':
      return { subject: bookingNotificationSubject(job), element: <BookingNotificationEmail {...job} /> };
    case 'booking-reminder':
      return {
        subject: bookingReminderSubject(job),
        element: <BookingReminderEmail {...job} siteOrigin={context.siteOrigin ?? null} />,
      };
    case 'booking-changed':
      return {
        subject: bookingChangedSubject(job),
        element: <BookingChangedEmail {...job} siteOrigin={context.siteOrigin ?? null} />,
      };
    case 'campaign-test':
      // Marked, so a test in an inbox is never mistaken for the campaign itself.
      return {
        subject: `[Test] ${campaignSubject(job.content, job.recipient)}`,
        element: <CampaignEmail content={job.content} recipient={job.recipient} unsubscribeUrl={null} />,
      };
  }
}

/**
 * The calendar entry an email about the visitor's own call carries: the time on a booking or
 * a move, its cancellation on a cancel. The team's notification and the reminders carry none,
 * since the entry is already in the visitor's calendar.
 */
function invite(job: EmailJob, context: EmailContext): InviteAttachment | null {
  if (job.template !== 'booking-confirmation' && job.template !== 'booking-changed') return null;
  const now = context.now ?? new Date();
  const cancelled = job.template === 'booking-changed' && job.change === 'cancelled';
  return bookingInvite({
    bookingId: job.bookingId,
    sequence: Math.floor(now.getTime() / 1000),
    status: cancelled ? 'cancelled' : 'confirmed',
    startsAt: job.startsAt,
    endsAt: job.endsAt,
    summary: `${job.consultationType} with Calwebtech`,
    description: 'The meeting link comes from a person at Calwebtech by email before the call.',
    organizer: context.contact ? { name: 'Calwebtech', email: context.contact.email } : null,
    attendee: { name: job.name, email: job.to[0] ?? '' },
    stamp: now,
  });
}

/** Renders a queued email job to a subject, HTML and a plain-text alternative. */
export async function renderEmail(job: EmailJob, context: EmailContext): Promise<RenderedEmail> {
  const { subject, element } = compose(job, context);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const attachment = invite(job, context);
  return { subject, html, text, ...(attachment ? { attachments: [attachment] } : {}) };
}
