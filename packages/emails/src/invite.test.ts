import { describe, expect, it } from 'vitest';
import { bookingInvite, foldLine, icsText, icsTime } from './invite';

const base = {
  bookingId: 'cmf0book0000abc',
  sequence: 1790000000,
  status: 'confirmed' as const,
  startsAt: '2026-09-24T15:45:00.000Z',
  endsAt: '2026-09-24T16:15:00.000Z',
  summary: 'Discovery call with Calwebtech',
  description: 'The meeting link comes from a person at Calwebtech by email before the call.',
  organizer: { name: 'Calwebtech', email: 'hello@calwebtech.com' },
  attendee: { name: 'Dana Whitfield', email: 'dana@company.com' },
  stamp: new Date('2026-09-20T10:00:00.000Z'),
};

describe('the calendar entry for a booked call', () => {
  it("holds the call's time in UTC, with the lines calendars need and CRLF endings", () => {
    const { content, contentType, filename } = bookingInvite(base);
    expect(filename).toMatch(/\.ics$/);
    expect(contentType).toBe('text/calendar; charset=utf-8; method=PUBLISH');
    const lines = content.split('\r\n');
    expect(lines).toContain('DTSTART:20260924T154500Z');
    expect(lines).toContain('DTEND:20260924T161500Z');
    expect(lines).toContain('UID:booking-cmf0book0000abc@calwebtech.com');
    expect(lines).toContain('STATUS:CONFIRMED');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(content.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(content.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('carries no meeting link, because the system never makes one', () => {
    const { content } = bookingInvite(base);
    expect(content).not.toMatch(/meet\.google|zoom\.us|teams\.microsoft|^URL/m);
  });

  it('cancels the same entry by its UID when the call is cancelled', () => {
    const { content, contentType } = bookingInvite({ ...base, status: 'cancelled', sequence: base.sequence + 60 });
    expect(contentType).toContain('method=CANCEL');
    expect(content).toContain('METHOD:CANCEL');
    expect(content).toContain('STATUS:CANCELLED');
    expect(content).toContain('UID:booking-cmf0book0000abc@calwebtech.com');
    expect(content).toContain(`SEQUENCE:${String(base.sequence + 60)}`);
  });

  it('leaves the organiser out when the site has no contact address', () => {
    expect(bookingInvite({ ...base, organizer: null }).content).not.toContain('ORGANIZER');
  });

  it('escapes text and names, so a comma or a quote in a name cannot break the file', () => {
    expect(icsText('Hello, world; a\\b\nnext')).toBe('Hello\\, world\\; a\\\\b\\nnext');
    const { content } = bookingInvite({ ...base, attendee: { name: 'Dana "D" Whitfield', email: 'dana@company.com' } });
    expect(content).toContain('ATTENDEE;CN="Dana  D  Whitfield";');
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    const line = `DESCRIPTION:${'é'.repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(icsTime(new Date('2026-01-02T03:04:05.678Z'))).toBe('20260102T030405Z');
  });
});
