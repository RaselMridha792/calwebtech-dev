import { describe, expect, it } from 'vitest';
import { campaignContentSchema, campaignTestSendSchema, personalise, unknownTokens } from './campaigns';
import { emailJobId } from './email-jobs';

const ava = { name: 'Ava Stone', email: 'ava@example.com' };
const nameless = { name: null, email: 'ben@example.org' };

describe('personalise', () => {
  it('fills each token from the recipient', () => {
    expect(personalise('Hi {{firstName}}, this is for {{name}} at {{email}}.', ava)).toBe(
      'Hi Ava, this is for Ava Stone at ava@example.com.',
    );
  });

  it('uses the fallback when the value is missing', () => {
    expect(personalise('Hi {{firstName|there}},', nameless)).toBe('Hi there,');
    expect(personalise('Hi {{ firstName | there }},', nameless)).toBe('Hi there,');
  });

  it('prefers the value over the fallback', () => {
    expect(personalise('Hi {{firstName|there}},', ava)).toBe('Hi Ava,');
  });

  it('leaves text without tokens alone', () => {
    expect(personalise('Plain words, {not a token}.', ava)).toBe('Plain words, {not a token}.');
  });
});

describe('campaign content', () => {
  const valid = {
    subject: 'News for {{firstName|you}}',
    templateKey: 'letter',
    body: { blocks: [{ type: 'paragraph', text: 'Hello.' }] },
  };

  it('accepts a subject and a block', () => {
    expect(campaignContentSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses a token nothing can fill', () => {
    expect(unknownTokens('Hi {{company}} and {{firstName}}')).toEqual(['company']);
    const result = campaignContentSchema.safeParse({ ...valid, subject: 'Hi {{company}}' });
    expect(result.success).toBe(false);
  });

  it('refuses a body of dividers only', () => {
    expect(campaignContentSchema.safeParse({ ...valid, body: { blocks: [{ type: 'divider' }] } }).success).toBe(false);
  });

  it('refuses a button that does not link to a web page', () => {
    const body = { blocks: [{ type: 'button', label: 'Go', url: 'javascript:alert(1)' }] };
    expect(campaignContentSchema.safeParse({ ...valid, body }).success).toBe(false);
  });

  it('treats blank preview text as none', () => {
    expect(campaignContentSchema.parse({ ...valid, preheader: '  ' }).preheader).toBeUndefined();
  });
});

describe('test sends', () => {
  it('go to five addresses at most', () => {
    const to = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'];
    expect(campaignTestSendSchema.safeParse({ to }).success).toBe(false);
    expect(campaignTestSendSchema.safeParse({ to: to.slice(0, 5) }).success).toBe(true);
  });

  it('have one job id per request, so two tests are two emails and a retry is one', () => {
    expect(emailJobId({ template: 'campaign-test', campaignId: 'c1', testId: 't1' })).toBe('campaign-test-c1-t1');
    expect(emailJobId({ template: 'campaign-test', campaignId: 'c1', testId: 't2' })).not.toBe(
      emailJobId({ template: 'campaign-test', campaignId: 'c1', testId: 't1' }),
    );
  });
});
