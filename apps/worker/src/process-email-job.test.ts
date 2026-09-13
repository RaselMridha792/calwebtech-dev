import type { EmailJob, LeadSummary, SiteContact } from '@calwebtech/shared';
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { createEmailJobProcessor, type DeliveryRecord, type DeliveryStore } from './process-email-job';
import type { EmailTransport, OutgoingEmail } from './transport';

const lead: LeadSummary = {
  leadId: 'cmf0lead0000abc',
  type: 'PROJECT',
  formId: 'lp-hero',
  name: 'Dana Whitfield',
  email: 'dana@company.com',
  serviceInterest: [],
  attribution: {},
  submittedAt: '2026-09-13T12:00:00.000Z',
};

const confirmation: EmailJob = {
  template: 'lead-confirmation',
  to: ['dana@company.com'],
  lead,
  acknowledgement: { heading: 'Thanks. We have it.', body: 'A person will reply.' },
};

const notification: EmailJob = {
  template: 'lead-notification',
  to: ['leads@calwebtech.com', 'owner@calwebtech.com'],
  lead,
};

const contact: SiteContact = { phone: '+1 (800) 555-0188', phoneE164: '+18005550188', email: 'hello@calwebtech.com' };
const FROM = 'Calwebtech <onboarding@resend.dev>';

/** A mocked transport: records what would have been sent and sends nothing. */
function fakes(failWith?: Error) {
  const sent: OutgoingEmail[] = [];
  const deliveries: { leadId: string; record: DeliveryRecord }[] = [];
  const transport: EmailTransport = {
    name: 'fake',
    send(email) {
      if (failWith) return Promise.reject(failWith);
      sent.push(email);
      return Promise.resolve({ id: `provider-${String(sent.length)}` });
    },
  };
  const store: DeliveryStore = {
    siteContact: () => Promise.resolve(contact),
    recordDelivery: (leadId, record) => {
      deliveries.push({ leadId, record });
      return Promise.resolve();
    },
  };
  return { sent, deliveries, transport, store };
}

describe('email job processor', () => {
  it('sends the confirmation to the visitor, with replies going to the team', async () => {
    const { sent, deliveries, transport, store } = fakes();
    const result = await createEmailJobProcessor({ transport, store, from: FROM })({ data: confirmation });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: FROM,
      to: ['dana@company.com'],
      replyTo: 'hello@calwebtech.com',
      subject: 'We have your request, Dana',
      idempotencyKey: 'lead-confirmation-cmf0lead0000abc',
    });
    expect(sent[0]?.html).toContain('A person will reply.');
    expect(sent[0]?.text).toContain('A person will reply.');
    expect(result).toEqual({ providerId: 'provider-1' });
    expect(deliveries).toEqual([
      {
        leadId: 'cmf0lead0000abc',
        record: { template: 'lead-confirmation', to: ['dana@company.com'], transport: 'fake', providerId: 'provider-1' },
      },
    ]);
  });

  it('sends the notification to every recipient, with replies going to the visitor', async () => {
    const { sent, transport, store } = fakes();
    await createEmailJobProcessor({ transport, store, from: FROM })({ data: notification });
    expect(sent[0]).toMatchObject({
      to: ['leads@calwebtech.com', 'owner@calwebtech.com'],
      replyTo: 'dana@company.com',
      idempotencyKey: 'lead-notification-cmf0lead0000abc',
    });
  });

  it('redirects every email in development and records who it was really for', async () => {
    const { sent, deliveries, transport, store } = fakes();
    await createEmailJobProcessor({ transport, store, from: FROM, redirectTo: 'delivered@resend.dev' })({
      data: notification,
    });
    expect(sent[0]?.to).toEqual(['delivered@resend.dev']);
    expect(sent[0]?.subject).toMatch(/^\[to leads@calwebtech\.com, owner@calwebtech\.com\] New lead: /);
    expect(deliveries[0]?.record.redirectedFrom).toEqual(['leads@calwebtech.com', 'owner@calwebtech.com']);
  });

  it('does not retry a payload that can never be valid', async () => {
    const { sent, transport, store } = fakes();
    const process = createEmailJobProcessor({ transport, store, from: FROM });
    await expect(process({ data: { ...confirmation, to: ['not-an-email'] } })).rejects.toBeInstanceOf(UnrecoverableError);
    expect(sent).toHaveLength(0);
  });

  it('throws on a transport failure so BullMQ retries, and records nothing', async () => {
    const { deliveries, transport, store } = fakes(new Error('Resend is down'));
    await expect(createEmailJobProcessor({ transport, store, from: FROM })({ data: confirmation })).rejects.toThrow(
      'Resend is down',
    );
    expect(deliveries).toHaveLength(0);
  });
});
