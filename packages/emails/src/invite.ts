/**
 * A calendar entry for a booked call, as an iCalendar file (RFC 5545) attached to the
 * booking's emails (docs/08-decisions.md, 60).
 *
 * It is the time and nothing else. No meeting link is generated anywhere in the system
 * (decision 47): a person sends one, so the entry's description says so rather than
 * carrying a link that does not exist. The same UID on every version, with a SEQUENCE that
 * only grows, is what lets a calendar move or cancel the entry it already holds instead of
 * adding a second one.
 */

export interface InviteAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface BookingInvite {
  /** Stable for the call's whole life: the booking's id. */
  bookingId: string;
  /** Grows with every change, so the newest version wins. Seconds since the epoch will do. */
  sequence: number;
  status: 'confirmed' | 'cancelled';
  startsAt: string;
  endsAt: string;
  summary: string;
  description: string;
  /** Who the call is with, when the site's contact address is known. */
  organizer: { name: string; email: string } | null;
  attendee: { name: string; email: string };
  /** When this version was made. */
  stamp: Date;
}

const DOMAIN = 'calwebtech.com';

/** `20260924T154500Z`: the one date form every calendar reads the same way. */
export function icsTime(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Text escaped as RFC 5545 asks: backslash, semicolon, comma and line breaks. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** A name safe inside a quoted parameter, which may hold neither quotes nor line breaks. */
function paramText(value: string): string {
  return value.replace(/["\r\n]/g, ' ').trim();
}

/**
 * Lines longer than 75 octets are folded onto continuation lines that start with a space.
 * Counted in bytes, and never split inside a character, so a name with accents survives.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const length = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + length > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += length;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** The file, with CRLF line endings as the format requires. */
export function bookingInvite(invite: BookingInvite): InviteAttachment {
  const method = invite.status === 'cancelled' ? 'CANCEL' : 'PUBLISH';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calwebtech//Bookings//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:booking-${invite.bookingId}@${DOMAIN}`,
    `SEQUENCE:${String(Math.max(0, Math.floor(invite.sequence)))}`,
    `DTSTAMP:${icsTime(invite.stamp)}`,
    `DTSTART:${icsTime(new Date(invite.startsAt))}`,
    `DTEND:${icsTime(new Date(invite.endsAt))}`,
    `SUMMARY:${icsText(invite.summary)}`,
    `DESCRIPTION:${icsText(invite.description)}`,
    `STATUS:${invite.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    ...(invite.organizer
      ? [`ORGANIZER;CN="${paramText(invite.organizer.name)}":mailto:${invite.organizer.email}`]
      : []),
    `ATTENDEE;CN="${paramText(invite.attendee.name)}";ROLE=REQ-PARTICIPANT:mailto:${invite.attendee.email}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return {
    filename: 'calwebtech-call.ics',
    content: `${lines.map(foldLine).join('\r\n')}\r\n`,
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}
