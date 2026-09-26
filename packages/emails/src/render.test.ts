import type { EmailJob, LeadSummary } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { renderEmail } from './render';

const lead: LeadSummary = {
  leadId: 'cmf0lead0000abc',
  type: 'PROJECT',
  formId: 'lp-final',
  name: 'Dana Whitfield',
  email: 'dana@company.com',
  company: 'Halloway',
  siteUrl: 'https://halloway.com',
  budgetBand: '25k-60k',
  timeline: 'this-quarter',
  serviceInterest: ['Redesign', 'Ecommerce'],
  message: 'Our quote form breaks on mobile.\n<script>alert(1)</script>',
  landingPageSlug: 'b2b-website-design',
  attribution: {
    firstTouch: { source: 'google', medium: 'cpc', campaign: 'q3-b2b' },
    lastTouch: { source: 'linkedin' },
    landingPage: '/lp/b2b-website-design/',
    device: 'mobile',
  },
  submittedAt: '2026-09-13T12:00:00.000Z',
};

const contact = { phone: '+1 (800) 555-0188', phoneE164: '+18005550188', email: 'hello@calwebtech.com' };

const confirmation: EmailJob = {
  template: 'lead-confirmation',
  to: [lead.email],
  lead,
  acknowledgement: { heading: 'Thanks. We have it.', body: 'A person will reply to book a call.' },
};

const notification: EmailJob = { template: 'lead-notification', to: ['leads@calwebtech.com'], lead };

describe('lead confirmation', () => {
  it('repeats what the page promised and what the visitor sent', async () => {
    const email = await renderEmail(confirmation, { contact });
    expect(email.subject).toBe('We have your request, Dana');
    expect(email.html).toContain('Thanks. We have it.');
    expect(email.html).toContain('A person will reply to book a call.');
    expect(email.html).toContain('$25,000 to $60,000');
    expect(email.html).toContain('href="tel:+18005550188"');
    expect(email.text).toContain('A person will reply to book a call.');
  });

  it('never shows the visitor their own attribution', async () => {
    const email = await renderEmail(confirmation, { contact });
    expect(email.html).not.toContain('linkedin');
    expect(email.html).not.toContain('q3-b2b');
  });

  it('leaves out the phone line when no contact setting exists', async () => {
    const email = await renderEmail(confirmation, { contact: null });
    expect(email.html).not.toContain('tel:');
  });
});

describe('internal lead notification', () => {
  it('names the lead, the page and where they came from', async () => {
    const email = await renderEmail(notification, { contact });
    expect(email.subject).toBe('New lead: Dana Whitfield (Halloway) via /lp/b2b-website-design/');
    expect(email.html).toContain('Redesign, Ecommerce');
    expect(email.html).toContain('This quarter');
    expect(email.html).toContain('google / cpc / q3-b2b');
    expect(email.text).toContain('linkedin');
    expect(email.text).toContain('cmf0lead0000abc');
  });

  it('escapes whatever the visitor typed', async () => {
    const email = await renderEmail(notification, { contact });
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('keeps a newline out of the subject header', async () => {
    const email = await renderEmail(
      { ...notification, lead: { ...lead, name: 'Dana\nBcc: x@y.com', company: undefined } },
      { contact },
    );
    expect(email.subject).toBe('New lead: Dana Bcc: x@y.com via /lp/b2b-website-design/');
  });
});

describe('a lead that came back', () => {
  it('tells the team it was added to the open lead, rather than announcing a new one', async () => {
    const email = await renderEmail({ ...notification, resubmission: 'act-2' }, { contact });
    expect(email.subject).toMatch(/^Lead updated: /);
    expect(email.text).toMatch(/wrote again/i);
    expect(email.text).toMatch(/added to their open lead/);
    const first = await renderEmail(notification, { contact });
    expect(first.subject).toMatch(/^New lead: /);
  });
});

describe('brand rules', () => {
  it('uses no teal, which is reserved for outcome figures', async () => {
    for (const job of [confirmation, notification]) {
      const email = await renderEmail(job, { contact });
      expect(email.html.toLowerCase()).not.toContain('#0e9f87');
    }
  });
});
