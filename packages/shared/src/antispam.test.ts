import { describe, expect, it } from 'vitest';
import {
  EMAIL_LIMITS,
  FORM_MINIMUM_MS,
  emailDomain,
  formElapsedSchema,
  isDisposableDomain,
} from './antispam';
import { bookingSubmissionSchema } from './booking';
import { emailJobId } from './email-jobs';
import { leadSubmissionSchema } from './lead';
import { subscribeSubmissionSchema } from './subscribe';

describe('the antispam contract', () => {
  it('knows the throwaway inbox providers and their subdomains, and nothing else', () => {
    expect(isDisposableDomain('mailinator.com')).toBe(true);
    expect(isDisposableDomain('eu.mailinator.com')).toBe(true);
    expect(isDisposableDomain('MAILINATOR.COM')).toBe(true);
    expect(isDisposableDomain('company.com')).toBe(false);
    // Only whole labels: a domain that merely ends in the same letters is somebody else's.
    expect(isDisposableDomain('notmailinator.com')).toBe(false);
    expect(emailDomain('Dana@Company.COM')).toBe('company.com');
  });

  it('gives every form a minimum time and an address limit a person would never reach', () => {
    for (const form of ['lead', 'booking', 'subscribe'] as const) {
      expect(FORM_MINIMUM_MS[form]).toBeGreaterThan(0);
      expect(FORM_MINIMUM_MS[form]).toBeLessThanOrEqual(3_000);
      expect(EMAIL_LIMITS[form].max).toBeGreaterThanOrEqual(3);
    }
  });

  it('reads how long the form was open from each form, and leaves it optional', () => {
    expect(formElapsedSchema.parse('4200')).toBe(4200);
    expect(formElapsedSchema.parse(undefined)).toBeUndefined();
    expect(formElapsedSchema.safeParse(-1).success).toBe(false);
    const lead = leadSubmissionSchema.parse({
      type: 'CONTACT',
      formId: 'contact',
      name: 'Dana Whitfield',
      email: 'dana@company.com',
      formElapsedMs: '5000',
    });
    expect(lead.formElapsedMs).toBe(5000);
    expect(subscribeSubmissionSchema.parse({ email: 'dana@company.com', formElapsedMs: 1500 }).formElapsedMs).toBe(1500);
    const booking = bookingSubmissionSchema.parse({
      consultationType: 'consultation',
      startsAt: '2026-10-01T16:00:00.000Z',
      timezone: 'Europe/London',
      name: 'Dana Whitfield',
      email: 'dana@company.com',
    });
    expect(booking.formElapsedMs).toBeUndefined();
  });

  it('gives a merged resubmission emails of its own, and a first submission the ids it always had', () => {
    const lead = { leadId: 'cmf0lead0000abc' };
    expect(emailJobId({ template: 'lead-notification', lead })).toBe('lead-notification-cmf0lead0000abc');
    expect(emailJobId({ template: 'lead-notification', lead, resubmission: 'act1' })).toBe(
      'lead-notification-cmf0lead0000abc-act1',
    );
  });
});
