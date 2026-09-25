import { CONSULTATION_PATH, bookingLinkPath, type EmailJob } from '@calwebtech/shared';
import { Heading, Text } from 'react-email';
import { firstName, oneLine, type DetailRow } from './format';
import { DetailRows, EmailLayout, styles } from './layout';

type Confirmation = Extract<EmailJob, { template: 'booking-confirmation' }>;
type Notification = Extract<EmailJob, { template: 'booking-notification' }>;
type Reminder = Extract<EmailJob, { template: 'booking-reminder' }>;
type Changed = Extract<EmailJob, { template: 'booking-changed' }>;
type Manage = NonNullable<Confirmation['manage']>;

/** The two signed links, on the site's own origin. Null without either, so no link is half made. */
function manageLinks(manage: Manage | undefined, siteOrigin: string | null): { move: string; cancel: string } | null {
  if (!manage || !siteOrigin) return null;
  return {
    move: `${siteOrigin}${bookingLinkPath('reschedule', manage.rescheduleToken)}`,
    cancel: `${siteOrigin}${bookingLinkPath('cancel', manage.cancelToken)}`,
  };
}

/** "Move this call · Cancel this call", or the reply-to-this-email fallback without links. */
function ManageLine({ links }: { links: { move: string; cancel: string } | null }) {
  if (!links) {
    return (
      <Text style={styles.paragraph}>
        If that time stops working, reply to this email and we will move it. There is nothing to prepare.
      </Text>
    );
  }
  return (
    <Text style={styles.paragraph}>
      If that time stops working,{' '}
      <a href={links.move} style={styles.link}>
        move this call
      </a>{' '}
      or{' '}
      <a href={links.cancel} style={styles.link}>
        cancel it
      </a>
      . There is nothing to prepare.
    </Text>
  );
}

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

function callRows(job: { startsAt: string; endsAt: string; timezone: string }): DetailRow[] {
  return [
    ['When', bookingWhen(job.startsAt, job.timezone)],
    ['Length', `${String(minutes(job.startsAt, job.endsAt))} minutes`],
    ['Timezone', safeZone(job.timezone)],
  ];
}

/**
 * Sent to the visitor. It promises exactly what happens next and nothing more: no meeting
 * link is generated anywhere in the system, a person sends one by hand, so the email says
 * so. The attached calendar entry holds the time and nothing else (docs/08-decisions.md, 60).
 */
export function BookingConfirmationEmail(job: Confirmation & { siteOrigin?: string | null }) {
  const when = bookingWhen(job.startsAt, job.timezone);

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
        speak — nothing is scheduled automatically, so it comes from a person. A calendar entry
        for the time is attached.
      </Text>

      <Text style={styles.label}>Your call</Text>
      <DetailRows rows={callRows(job)} />

      <ManageLine links={manageLinks(job.manage, job.siteOrigin ?? null)} />
    </EmailLayout>
  );
}

export function bookingReminderSubject(job: Reminder): string {
  return job.window === '24h'
    ? oneLine(`Tomorrow: your call at ${bookingWhen(job.startsAt, job.timezone)}`)
    : oneLine(`In an hour: your call at ${bookingWhen(job.startsAt, job.timezone)}`);
}

/** A day before the call, and an hour before it. The time, and how to move it. */
export function BookingReminderEmail(job: Reminder & { siteOrigin?: string | null }) {
  const when = bookingWhen(job.startsAt, job.timezone);
  return (
    <EmailLayout
      preview={job.window === '24h' ? `Tomorrow, ${when}.` : `In an hour, ${when}.`}
      footer="You received this because you booked a consultation on the Calwebtech website."
    >
      <Heading as="h1" style={styles.heading}>
        {job.window === '24h' ? 'Your call is tomorrow' : 'Your call starts in an hour'}
      </Heading>
      <Text style={styles.paragraph}>Hi {firstName(job.name)},</Text>
      <Text style={styles.paragraph}>
        A reminder of your {job.consultationType}. The meeting link comes from a person by email; if you
        cannot find it, reply to this one.
      </Text>

      <Text style={styles.label}>Your call</Text>
      <DetailRows rows={callRows(job)} />

      <ManageLine links={manageLinks(job.manage, job.siteOrigin ?? null)} />
    </EmailLayout>
  );
}

export function bookingChangedSubject(job: Changed): string {
  if (job.change === 'cancelled') {
    return oneLine(`Cancelled: your call at ${bookingWhen(job.startsAt, job.timezone)}`);
  }
  return oneLine(`Moved: your call is now ${bookingWhen(job.startsAt, job.timezone)}`);
}

/**
 * Sent when the visitor moved or cancelled their call from its signed link, so the inbox
 * holds the latest word. A moved call carries its updated calendar entry, a cancelled one
 * the entry's cancellation.
 */
export function BookingChangedEmail(job: Changed & { siteOrigin?: string | null }) {
  const when = bookingWhen(job.startsAt, job.timezone);
  const cancelled = job.change === 'cancelled';
  const bookAgain = job.siteOrigin ? `${job.siteOrigin}${CONSULTATION_PATH}` : null;

  return (
    <EmailLayout
      preview={cancelled ? `Your call at ${when} is cancelled.` : `Your call is now ${when}.`}
      footer="You received this because you booked a consultation on the Calwebtech website."
    >
      <Heading as="h1" style={styles.heading}>
        {cancelled ? 'Your call is cancelled' : 'Your call has moved'}
      </Heading>
      <Text style={styles.paragraph}>Hi {firstName(job.name)},</Text>
      {cancelled ? (
        <Text style={styles.paragraph}>
          Your {job.consultationType} is cancelled and the time is free again.
          {bookAgain ? (
            <>
              {' '}
              If you would like another,{' '}
              <a href={bookAgain} style={styles.link}>
                choose a new time
              </a>
              .
            </>
          ) : null}
        </Text>
      ) : (
        <Text style={styles.paragraph}>
          Your {job.consultationType} is at its new time
          {job.previousStartsAt ? `, moved from ${bookingWhen(job.previousStartsAt, job.timezone)}` : ''}. The
          attached calendar entry replaces the old one.
        </Text>
      )}

      <Text style={styles.label}>{cancelled ? 'The call that was cancelled' : 'Your call'}</Text>
      <DetailRows rows={callRows(job)} />

      {cancelled ? null : <ManageLine links={manageLinks(job.manage, job.siteOrigin ?? null)} />}
    </EmailLayout>
  );
}

const NOTIFICATION_WORDS = {
  booked: {
    subject: 'New booking',
    heading: 'A consultation was booked',
    verb: 'booked',
    next: 'Send the meeting link before the call.',
  },
  moved: {
    subject: 'Booking moved',
    heading: 'A consultation was moved',
    verb: 'moved to',
    next: 'Send the meeting link for the new time.',
  },
  cancelled: {
    subject: 'Booking cancelled',
    heading: 'A consultation was cancelled',
    verb: 'cancelled',
    next: 'The time is free again; nothing to send.',
  },
} as const;

export function bookingNotificationSubject(job: Notification): string {
  const words = NOTIFICATION_WORDS[job.change ?? 'booked'];
  return oneLine(`${words.subject}: ${job.name} — ${bookingWhen(job.startsAt, job.timezone)}`);
}

/** Sent to us. Everything needed to send the invitation by hand, in the reader's own zone. */
export function BookingNotificationEmail(job: Notification) {
  const words = NOTIFICATION_WORDS[job.change ?? 'booked'];
  const rows: DetailRow[] = [
    ['Name', oneLine(job.name)],
    ['Email', job.email],
    ['Type', job.consultationType],
    ['Their time', bookingWhen(job.startsAt, job.timezone)],
    ...(job.previousStartsAt ? [['Was', bookingWhen(job.previousStartsAt, job.timezone)] as const] : []),
    ['Their zone', safeZone(job.timezone)],
    ['Reference', job.bookingId],
  ];

  return (
    <EmailLayout
      preview={`${oneLine(job.name)} ${words.verb} ${bookingWhen(job.startsAt, job.timezone)}.`}
      footer="Sent by the Calwebtech booking engine."
    >
      <Heading as="h1" style={styles.heading}>
        {words.heading}
      </Heading>
      <Text style={styles.paragraph}>{words.next}</Text>

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
