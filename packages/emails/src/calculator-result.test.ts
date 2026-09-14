import type { CalculatorResultEmail, EmailJob, LeadSummary } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { renderEmail } from './render';

const lead: LeadSummary = {
  leadId: 'cmf0lead0000abc',
  type: 'CALCULATOR',
  formId: 'cost-calculator',
  name: 'Dana Whitfield',
  email: 'dana@company.com',
  serviceInterest: [],
  attribution: {},
  submittedAt: '2026-09-14T12:00:00.000Z',
};

const result: CalculatorResultEmail = {
  heading: 'Your website cost estimate',
  intro: 'Here is the range your answers describe, and where the number comes from.',
  rangeHeading: 'Your indicative range',
  rangeLabel: '$41,500 to $66,500',
  tierName: 'Platform build',
  tierSummary: 'Booking, a dashboard, campaigns and integrations on top of the marketing site.',
  monthly: 'Care plan: from $1,500 a month',
  monthlyHeading: 'After launch',
  breakdownHeading: 'Where the number comes from',
  breakdown: [
    { label: 'Project type', detail: 'Ecommerce store', value: '$22,000 to $30,000' },
    { label: 'Content', detail: 'Write it for us', value: '$6,500 to $11,500' },
    { label: 'Platform', detail: 'Shopify', value: 'Included' },
  ],
  moversHeading: 'What would move it',
  movers: [{ label: 'Without the ERP integration', detail: null, value: 'About $6,000 to $12,000 less' }],
  noMovers: 'Nothing here would lower the range.',
  answersHeading: 'What you told us',
  answers: [{ label: 'Project type', detail: null, value: 'Ecommerce store <script>alert(1)</script>' }],
  note: 'Indicative only. A fixed price follows discovery.',
  bookingPath: '/book-a-consultation/?source=cost-calculator&project-type=ecommerce',
  bookingLabel: 'Book a consultation',
  methodologyPath: '/cost-calculator/#methodology',
  methodologyLabel: 'How we work this out',
};

const job: EmailJob = { template: 'calculator-result', to: [lead.email], lead, result };
const contact = { phone: '+1 (800) 555-0188', phoneE164: '+18005550188', email: 'hello@calwebtech.com' };

describe('the emailed copy of a cost estimate', () => {
  it('repeats the range, the band, the breakdown and what would move it', async () => {
    const email = await renderEmail(job, { contact, siteOrigin: 'https://calwebtech.com' });
    expect(email.subject).toBe('Your website cost estimate: $41,500 to $66,500');
    expect(email.html).toContain('$41,500 to $66,500');
    expect(email.html).toContain('Platform build');
    expect(email.html).toContain('Ecommerce store — $22,000 to $30,000');
    expect(email.html).toContain('About $6,000 to $12,000 less');
    expect(email.text).toContain('Care plan: from $1,500 a month');
    expect(email.text).toContain('Indicative only.');
  });

  it('links back to this site only, building the URLs from the configured origin', async () => {
    const email = await renderEmail(job, { contact, siteOrigin: 'https://calwebtech.com' });
    expect(email.html).toContain('https://calwebtech.com/book-a-consultation/?source=cost-calculator');
    expect(email.html).toContain('https://calwebtech.com/cost-calculator/#methodology');
  });

  it('leaves the links out rather than guessing a host when no origin is configured', async () => {
    const email = await renderEmail(job, { contact, siteOrigin: null });
    expect(email.html).not.toContain('/book-a-consultation/');
    expect(email.html).toContain('$41,500 to $66,500');
  });

  it('says so plainly when nothing would lower the range', async () => {
    const email = await renderEmail({ ...job, result: { ...result, movers: [] } }, { contact, siteOrigin: null });
    expect(email.html).toContain('Nothing here would lower the range.');
  });

  it('escapes whatever the visitor typed and uses no teal', async () => {
    const email = await renderEmail(job, { contact, siteOrigin: 'https://calwebtech.com' });
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html.toLowerCase()).not.toContain('#0e9f87');
  });
});
