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
    recordBookingDelivery: (bookingId, record) => {
      deliveries.push({ leadId: bookingId, record });
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

/** The cost calculator's emailed copy of the result (packages/emails/src/calculator-result.tsx). */
const calculatorResult: EmailJob = {
  template: 'calculator-result',
  to: ['dana@company.com'],
  lead: { ...lead, type: 'CALCULATOR', formId: 'cost-calculator' },
  result: {
    heading: 'Your website cost estimate',
    intro: 'Here is the range your answers describe.',
    rangeHeading: 'Your indicative range',
    rangeLabel: '$18,500 to $29,000',
    tier: 'focused',
    budgetBand: '12k-25k',
    tierName: 'Focused build',
    tierSummary: 'Marketing site, custom design, a CMS and lead capture.',
    monthly: 'No ongoing plan chosen.',
    monthlyHeading: 'After launch',
    breakdownHeading: 'Where the number comes from',
    breakdown: [{ label: 'Project type', detail: 'Marketing website', value: '$12,000 to $16,000' }],
    moversHeading: 'What would move it',
    movers: [],
    noMovers: 'Nothing here would lower the range.',
    answersHeading: 'What you told us',
    answers: [{ label: 'Project type', detail: null, value: 'Marketing website' }],
    note: 'Indicative only. A fixed price follows discovery.',
    bookingPath: '/book-a-consultation/?source=cost-calculator',
    bookingLabel: 'Book a consultation',
    methodologyPath: '/cost-calculator/#methodology',
    methodologyLabel: 'How we work this out',
  },
};

describe('cost calculator result', () => {
  it('goes to the visitor with replies to the team, and one id per lead', async () => {
    const { sent, deliveries, transport, store } = fakes();
    await createEmailJobProcessor({ transport, store, from: FROM, siteOrigin: 'https://calwebtech.com' })({
      data: calculatorResult,
    });
    expect(sent[0]).toMatchObject({
      to: ['dana@company.com'],
      replyTo: 'hello@calwebtech.com',
      subject: 'Your website cost estimate: $18,500 to $29,000',
      idempotencyKey: 'calculator-result-cmf0lead0000abc',
    });
    expect(sent[0]?.html).toContain('https://calwebtech.com/book-a-consultation/?source=cost-calculator');
    expect(deliveries[0]?.record.template).toBe('calculator-result');
  });

  it('sends the result without its links when the worker has no origin configured', async () => {
    const { sent, transport, store } = fakes();
    await createEmailJobProcessor({ transport, store, from: FROM })({ data: calculatorResult });
    expect(sent[0]?.html).toContain('$18,500 to $29,000');
    expect(sent[0]?.html).not.toContain('book-a-consultation');
  });
});

describe('campaign test send', () => {
  const test: EmailJob = {
    template: 'campaign-test',
    to: ['team@calwebtech.com'],
    campaignId: 'cmcampaign01',
    testId: 'abc123',
    content: {
      subject: 'Hello {{firstName|there}}',
      templateKey: 'letter',
      body: { blocks: [{ type: 'paragraph', text: 'Hi {{firstName|there}}.' }] },
    },
    recipient: { name: 'Sam Lee', email: 'team@calwebtech.com' },
  };

  it('sends a marked test with its own idempotency key and writes no delivery row', async () => {
    const { sent, deliveries, transport, store } = fakes();
    await createEmailJobProcessor({ transport, store, from: FROM })({ data: test });
    expect(sent[0]?.subject).toBe('[Test] Hello Sam');
    expect(sent[0]?.to).toEqual(['team@calwebtech.com']);
    expect(sent[0]?.idempotencyKey).toBe('campaign-test-cmcampaign01-abc123');
    expect(deliveries).toEqual([]);
  });
});
