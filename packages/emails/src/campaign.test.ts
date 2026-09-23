import type { CampaignContent, EmailJob } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { renderCampaign } from './campaign';
import { renderEmail } from './render';

const content: CampaignContent = {
  subject: 'Autumn update for {{firstName|you}}',
  preheader: 'What changed this quarter',
  templateKey: 'announcement',
  body: {
    blocks: [
      { type: 'heading', text: 'Three new services, {{firstName|friend}}' },
      { type: 'paragraph', text: 'Hi {{firstName|there}},\nHere is what is new.' },
      { type: 'button', label: 'See them', url: 'https://calwebtech.com/services/' },
      { type: 'divider' },
    ],
  },
};

describe('campaign email', () => {
  it('fills the tokens for the recipient in the subject and the body', async () => {
    const email = await renderCampaign({
      content,
      recipient: { name: 'Ava Stone', email: 'ava@example.com' },
      unsubscribeUrl: 'https://calwebtech.com/unsubscribe/abc/',
    });
    expect(email.subject).toBe('Autumn update for Ava');
    expect(email.html).toContain('Three new services, Ava');
    expect(email.text).toContain('Hi Ava,');
    expect(email.html).toContain('https://calwebtech.com/services/');
    expect(email.html).toContain('https://calwebtech.com/unsubscribe/abc/');
  });

  it('falls back where the subscriber gave no name', async () => {
    const email = await renderCampaign({ content, recipient: { name: null, email: 'b@x.com' }, unsubscribeUrl: null });
    expect(email.subject).toBe('Autumn update for you');
    expect(email.text).toContain('Hi there,');
    expect(email.text).toContain('Each recipient gets their own unsubscribe link here.');
  });

  it('escapes what a subscriber typed as their name', async () => {
    const email = await renderCampaign({
      content,
      recipient: { name: '<script>alert(1)</script>', email: 'x@x.com' },
      unsubscribeUrl: null,
    });
    expect(email.html).not.toContain('<script>alert(1)</script>');
  });

  it('marks a test in its subject', async () => {
    const job: EmailJob = {
      template: 'campaign-test',
      to: ['team@calwebtech.com'],
      campaignId: 'c1',
      testId: 't1',
      content,
      recipient: { name: 'Sam Lee', email: 'team@calwebtech.com' },
    };
    const email = await renderEmail(job, { contact: null });
    expect(email.subject).toBe('[Test] Autumn update for Sam');
  });
});
