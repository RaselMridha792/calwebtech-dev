import { describe, expect, it } from 'vitest';
import { emailJobId, emailJobSchema, type EmailJob } from './email-jobs';

const lead: EmailJob['lead'] = {
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

describe('emailJobId', () => {
  it('is one id per lead and template, without the colon BullMQ rejects', () => {
    expect(emailJobId(confirmation)).toBe('lead-confirmation-cmf0lead0000abc');
    expect(emailJobId({ template: 'lead-notification', lead })).toBe('lead-notification-cmf0lead0000abc');
    expect(emailJobId(confirmation)).not.toContain(':');
  });
});
