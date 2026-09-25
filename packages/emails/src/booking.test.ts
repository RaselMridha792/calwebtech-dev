import type { EmailJob } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { renderEmail } from './render';

const context = { contact: null };

/** 16:45 in London on a Thursday in September, which is 08:45 in Los Angeles. */
const startsAt = '2026-09-24T15:45:00.000Z';

const confirmation: EmailJob = {
  template: 'booking-confirmation',
  to: ['dana@company.com'],
  bookingId: 'cmf0book0000abc',
  name: 'Dana Whitfield',
  consultationType: 'Discovery call',
  startsAt,
  endsAt: '2026-09-24T16:15:00.000Z',
  timezone: 'America/Los_Angeles',
};

const notification: EmailJob = {
  template: 'booking-notification',
  to: ['hello@calwebtech.com'],
  bookingId: 'cmf0book0000abc',
  name: 'Dana Whitfield',
  email: 'dana@company.com',
  consultationType: 'Discovery call',
  startsAt,
  timezone: 'America/Los_Angeles',
  context: 'Our enquiries go missing between the form and the inbox.',
};

describe('the booking confirmation', () => {
  it('states the time in the zone the visitor booked it from, named', async () => {
    const email = await renderEmail(confirmation, context);
    expect(email.text).toContain('8:45');
    expect(email.text).toContain('Thursday 24 September');
    // Named, because "8:45" alone is the one detail a reader cannot afford to assume.
    expect(email.text).toMatch(/PDT|GMT-7/);
    expect(email.subject).toContain('8:45');
  });

  it('promises a link sent by a person, never an automatic invitation', async () => {
    const email = await renderEmail(confirmation, context);
    expect(email.text).toMatch(/nothing is scheduled automatically/i);
    expect(email.text).not.toMatch(/calendar invit|google meet|zoom/i);
  });

  it('falls back to UTC rather than guessing when the zone is not one we know', async () => {
    const email = await renderEmail({ ...confirmation, timezone: 'Mars/Olympus' }, context);
    expect(email.text).toContain('UTC');
    expect(email.text).toContain('15:45');
  });

  it('says how long the call is, from the two instants', async () => {
    const email = await renderEmail(confirmation, context);
    expect(email.text).toContain('30 minutes');
  });
});

describe('the internal notification', () => {
  it('carries who booked, when in their own clock, and what they want to talk about', async () => {
    const email = await renderEmail(notification, context);
    expect(email.subject).toContain('Dana Whitfield');
    expect(email.text).toContain('dana@company.com');
    expect(email.text).toContain('America/Los_Angeles');
    expect(email.text).toContain('enquiries go missing');
    expect(email.text).toContain('cmf0book0000abc');
  });

  it('leaves the context out when there is none', async () => {
    const email = await renderEmail({ ...notification, context: null }, context);
    expect(email.text).not.toMatch(/what they want to talk about/i);
  });
});

const manage = { rescheduleToken: 'test-reschedule-token-0001', cancelToken: 'test-cancel-token-000001' };
const withSite = {
  contact: { email: 'hello@calwebtech.com', phone: null, phoneE164: null },
  siteOrigin: 'https://example.com',
  now: new Date('2026-09-20T10:00:00.000Z'),
};

describe('the signed links and the calendar entry', () => {
  it("link the confirmation to moving and cancelling the call, on the site's own origin", async () => {
    const email = await renderEmail({ ...confirmation, manage }, withSite);
    expect(email.html).toContain('https://example.com/book-a-consultation/reschedule/test-reschedule-token-0001/');
    expect(email.html).toContain('https://example.com/book-a-consultation/cancel/test-cancel-token-000001/');
    expect(email.text).toMatch(/calendar entry/i);
  });

  it('fall back to replying when there are no links, rather than half a link', async () => {
    const email = await renderEmail({ ...confirmation, manage }, context);
    expect(email.html).not.toContain('/reschedule/');
    expect(email.text).toMatch(/reply to this email/i);
  });

  it("attach the time as a calendar entry to the confirmation, and not to the team's notification", async () => {
    const booked = await renderEmail(confirmation, withSite);
    expect(booked.attachments?.[0]?.content).toContain('DTSTART:20260924T154500Z');
    expect(booked.attachments?.[0]?.content).toContain('ORGANIZER;CN="Calwebtech":mailto:hello@calwebtech.com');
    expect((await renderEmail(notification, withSite)).attachments).toBeUndefined();
  });
});

describe('the reminders', () => {
  const reminder: EmailJob = { ...confirmation, template: 'booking-reminder', window: '24h', manage };

  it('say tomorrow a day before and in an hour an hour before, with the time', async () => {
    const day = await renderEmail(reminder, withSite);
    expect(day.subject).toMatch(/^Tomorrow/);
    expect(day.text).toContain('8:45');
    const hour = await renderEmail({ ...reminder, window: '1h' }, withSite);
    expect(hour.subject).toMatch(/^In an hour/);
    expect(hour.html).toContain('/book-a-consultation/cancel/test-cancel-token-000001/');
    expect(hour.attachments).toBeUndefined();
  });
});

describe('a moved or cancelled call', () => {
  const moved: EmailJob = {
    ...confirmation,
    template: 'booking-changed',
    change: 'moved',
    previousStartsAt: '2026-09-23T15:45:00.000Z',
    manage,
  };

  it('tells the visitor the new time and the old, and replaces the calendar entry', async () => {
    const email = await renderEmail(moved, withSite);
    expect(email.subject).toMatch(/^Moved/);
    expect(email.text).toContain('Wednesday 23 September');
    expect(email.attachments?.[0]?.content).toContain('STATUS:CONFIRMED');
  });

  it('confirms a cancellation, cancels the calendar entry, and offers a new time', async () => {
    const email = await renderEmail({ ...moved, change: 'cancelled', previousStartsAt: null }, withSite);
    expect(email.subject).toMatch(/^Cancelled/);
    expect(email.attachments?.[0]?.content).toContain('METHOD:CANCEL');
    expect(email.html).toContain('https://example.com/book-a-consultation/');
    expect(email.html).not.toContain('/reschedule/');
  });

  it('tells the team what changed', async () => {
    const email = await renderEmail(
      { ...notification, change: 'moved', previousStartsAt: '2026-09-23T15:45:00.000Z' },
      withSite,
    );
    expect(email.subject).toMatch(/^Booking moved/);
    expect(email.text).toContain('Wednesday 23 September');
    const cancelled = await renderEmail({ ...notification, change: 'cancelled' }, withSite);
    expect(cancelled.subject).toMatch(/^Booking cancelled/);
  });
});
