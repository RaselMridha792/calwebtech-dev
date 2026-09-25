import { describe, expect, it } from 'vitest';
import { emailJobId, emailJobSchema, type EmailJob } from './email-jobs';

const lead: Extract<EmailJob, { template: 'lead-notification' }>['lead'] = {
  leadId: 'cmf0lead0000abc',
  type: 'PROJECT',
  formId: 'lp-hero',
  name: 'Dana Whitfield',
  email: 'dana@company.com',
  serviceInterest: [],
  attribution: { lastTouch: { source: 'linkedin' } },
  submittedAt: '2026-09-13T12:00:00.000Z',
};

const confirmation: EmailJob = {
  template: 'lead-confirmation',
  to: ['dana@company.com'],
  lead,
  acknowledgement: { heading: 'Thanks. We have it.', body: 'A person will reply.' },
};

describe('emailJobSchema', () => {
  it('accepts a confirmation job and a notification job', () => {
    expect(emailJobSchema.parse(confirmation)).toEqual(confirmation);
    const notification: EmailJob = { template: 'lead-notification', to: ['leads@calwebtech.com'], lead };
    expect(emailJobSchema.parse(notification)).toEqual(notification);
  });

  it('requires the on-screen acknowledgement on a confirmation', () => {
    const withoutAcknowledgement: Record<string, unknown> = { ...confirmation };
    delete withoutAcknowledgement.acknowledgement;
    expect(emailJobSchema.safeParse(withoutAcknowledgement).success).toBe(false);
  });

  it('rejects a job with no valid recipient', () => {
    expect(emailJobSchema.safeParse({ ...confirmation, to: [] }).success).toBe(false);
    expect(emailJobSchema.safeParse({ ...confirmation, to: ['not-an-email'] }).success).toBe(false);
  });

  it('rejects an unknown template', () => {
    expect(emailJobSchema.safeParse({ ...confirmation, template: 'newsletter' }).success).toBe(false);
  });
});

describe('the booking jobs', () => {
  const booked: EmailJob = {
    template: 'booking-confirmation',
    to: ['dana@company.com'],
    bookingId: 'cmf0book0000abc',
    name: 'Dana Whitfield',
    consultationType: 'Discovery call',
    startsAt: '2026-09-24T15:45:00.000Z',
    endsAt: '2026-09-24T16:15:00.000Z',
    timezone: 'America/Los_Angeles',
  };

  it('accepts a confirmation and a notification', () => {
    expect(emailJobSchema.parse(booked)).toEqual(booked);
    const notification: EmailJob = {
      template: 'booking-notification',
      to: ['hello@calwebtech.com'],
      bookingId: 'cmf0book0000abc',
      name: 'Dana Whitfield',
      email: 'dana@company.com',
      consultationType: 'Discovery call',
      startsAt: '2026-09-24T15:45:00.000Z',
      timezone: 'America/Los_Angeles',
      context: null,
    };
    expect(emailJobSchema.parse(notification)).toEqual(notification);
  });

  it('needs the end of the call, since the email states how long it is', () => {
    const withoutEnd: Record<string, unknown> = { ...booked };
    delete withoutEnd.endsAt;
    expect(emailJobSchema.safeParse(withoutEnd).success).toBe(false);
  });
});

describe('emailJobId', () => {
  it('is one id per lead and template, without the colon BullMQ rejects', () => {
    expect(emailJobId(confirmation)).toBe('lead-confirmation-cmf0lead0000abc');
    expect(emailJobId({ template: 'lead-notification', lead })).toBe('lead-notification-cmf0lead0000abc');
    expect(emailJobId(confirmation)).not.toContain(':');
  });

  it('names the booking when there is no lead', () => {
    expect(emailJobId({ template: 'booking-confirmation', bookingId: 'cmf0book0000abc' })).toBe(
      'booking-confirmation-cmf0book0000abc',
    );
  });

  it('refuses a job that names neither', () => {
    expect(() => emailJobId({ template: 'booking-notification' })).toThrow();
  });

  it('gives each reminder and each change to a call an id of its own, stable across retries', () => {
    const at = '2026-09-24T15:45:00.000Z';
    const later = '2026-09-25T15:45:00.000Z';
    const day = emailJobId({ template: 'booking-reminder', bookingId: 'b1', window: '24h', startsAt: at });
    const hour = emailJobId({ template: 'booking-reminder', bookingId: 'b1', window: '1h', startsAt: at });
    const moved = emailJobId({ template: 'booking-reminder', bookingId: 'b1', window: '24h', startsAt: later });
    expect(new Set([day, hour, moved]).size).toBe(3);
    expect(day).toBe(emailJobId({ template: 'booking-reminder', bookingId: 'b1', window: '24h', startsAt: at }));
    expect(day).not.toContain(':');
    // The team hears of a booking once, and of each change separately.
    expect(emailJobId({ template: 'booking-notification', bookingId: 'b1', change: 'booked', startsAt: at })).toBe(
      'booking-notification-b1',
    );
    expect(emailJobId({ template: 'booking-notification', bookingId: 'b1', change: 'moved', startsAt: later })).toBe(
      `booking-notification-b1-moved-${String(Date.parse(later))}`,
    );
  });
});

describe('the jobs for a moved or cancelled call', () => {
  const call = {
    to: ['dana@company.com'],
    bookingId: 'cmf0book0000abc',
    name: 'Dana Whitfield',
    consultationType: 'Discovery call',
    startsAt: '2026-09-24T15:45:00.000Z',
    endsAt: '2026-09-24T16:15:00.000Z',
    timezone: 'America/Los_Angeles',
    manage: { rescheduleToken: 'test-reschedule-token', cancelToken: 'test-cancel-token' },
  };

  it('accepts a reminder a day or an hour before, and nothing else', () => {
    expect(emailJobSchema.safeParse({ ...call, template: 'booking-reminder', window: '24h' }).success).toBe(true);
    expect(emailJobSchema.safeParse({ ...call, template: 'booking-reminder', window: '1h' }).success).toBe(true);
    expect(emailJobSchema.safeParse({ ...call, template: 'booking-reminder', window: '2h' }).success).toBe(false);
  });

  it('accepts a moved or cancelled call, and a notification that says which', () => {
    const moved = { ...call, template: 'booking-changed', change: 'moved', previousStartsAt: '2026-09-23T15:45:00.000Z' };
    expect(emailJobSchema.safeParse(moved).success).toBe(true);
    expect(emailJobSchema.safeParse({ ...moved, change: 'booked' }).success).toBe(false);
    const notification = {
      template: 'booking-notification',
      to: ['hello@calwebtech.com'],
      bookingId: call.bookingId,
      name: call.name,
      email: 'dana@company.com',
      consultationType: call.consultationType,
      startsAt: call.startsAt,
      timezone: call.timezone,
      context: null,
      change: 'cancelled',
    };
    expect(emailJobSchema.safeParse(notification).success).toBe(true);
  });
});
