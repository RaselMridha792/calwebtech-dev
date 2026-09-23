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
