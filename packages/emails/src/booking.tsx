import type { EmailJob } from '@calwebtech/shared';
import { Heading, Text } from 'react-email';
import { firstName, oneLine, type DetailRow } from './format';
import { DetailRows, EmailLayout, styles } from './layout';

type Confirmation = Extract<EmailJob, { template: 'booking-confirmation' }>;
type Notification = Extract<EmailJob, { template: 'booking-notification' }>;

/**
 * The time in the clock the reader booked it with, named so there is no ambiguity.
 *
 * A zone arrives from the browser, so a zone the runtime does not know is possible; UTC is
 * then stated rather than guessed at, since a confirmation with the wrong hour in it is
 * worse than one that reads a little technically.
 */
export function bookingWhen(startsAt: string, timezone: string): string {
  const at = new Date(startsAt);
  const zone = safeZone(timezone);
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: zone,
  }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: zone,
  }).format(at);
  return `${day} at ${time}`;
}

function safeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

/** Whole minutes between the two instants, for "thirty minutes" in the body. */
function minutes(startsAt: string, endsAt: string): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
}

export function bookingConfirmationSubject(job: Confirmation): string {
  return oneLine(`Your call is confirmed for ${bookingWhen(job.startsAt, job.timezone)}`);
}

/**
 * Sent to the visitor. It promises exactly what happens next and nothing more: no meeting
 * link is generated anywhere in the system, a person sends one by hand, so the email says
 * so rather than implying a calendar invitation that is never coming.
 */
export function BookingConfirmationEmail(job: Confirmation) {
  const when = bookingWhen(job.startsAt, job.timezone);
  const rows: DetailRow[] = [
    ['When', when],
    ['Length', `${String(minutes(job.startsAt, job.endsAt))} minutes`],
    ['Timezone', safeZone(job.timezone)],
  ];

  return (
    <EmailLayout
      preview={`${when} — we will send the meeting link by email.`}
      footer="You received this because you booked a consultation on the Calwebtech website."
    >
      <Heading as="h1" style={styles.heading}>
        That time is yours
      </Heading>
      <Text style={styles.paragraph}>Hi {firstName(job.name)},</Text>
      <Text style={styles.paragraph}>
        Your {job.consultationType} is booked. We will email you the meeting link before we
        speak — nothing is scheduled automatically, so it comes from a person.
      </Text>

      <Text style={styles.label}>Your call</Text>
      <DetailRows rows={rows} />

      <Text style={styles.paragraph}>
        If that time stops working, reply to this email and we will move it. There is nothing
        to prepare.
      </Text>
    </EmailLayout>
  );
}

export function bookingNotificationSubject(job: Notification): string {
  return oneLine(`New booking: ${job.name} — ${bookingWhen(job.startsAt, job.timezone)}`);
}

/** Sent to us. Everything needed to send the invitation by hand, in the reader's own zone. */
export function BookingNotificationEmail(job: Notification) {
  const rows: DetailRow[] = [
    ['Name', oneLine(job.name)],
    ['Email', job.email],
    ['Type', job.consultationType],
    ['Their time', bookingWhen(job.startsAt, job.timezone)],
    ['Their zone', safeZone(job.timezone)],
    ['Reference', job.bookingId],
  ];

  return (
    <EmailLayout
      preview={`${oneLine(job.name)} booked ${bookingWhen(job.startsAt, job.timezone)}.`}
      footer="Sent by the Calwebtech booking engine."
    >
      <Heading as="h1" style={styles.heading}>
        A consultation was booked
      </Heading>
      <Text style={styles.paragraph}>Send the meeting link before the call.</Text>

      <Text style={styles.label}>The booking</Text>
      <DetailRows rows={rows} />

      {job.context ? (
        <>
          <Text style={styles.label}>What they want to talk about</Text>
          <Text style={styles.message}>{job.context}</Text>
        </>
      ) : null}
    </EmailLayout>
  );
}
