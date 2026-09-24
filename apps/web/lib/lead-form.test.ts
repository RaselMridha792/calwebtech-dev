import { leadSubmissionSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { attributionFromForm, leadSubmissionFromForm } from './lead-form';

function formWith(entries: [string, string][]): FormData {
  const form = new FormData();
  for (const [name, value] of entries) form.append(name, value);
  return form;
}

const base: [string, string][] = [
  ['type', 'PROJECT'],
  ['formId', 'lp-final'],
  ['landingPageSlug', 'b2b-website-design'],
  ['name', 'Dana Whitfield'],
  ['email', 'dana@company.com'],
];

describe('leadSubmissionFromForm', () => {
  it('produces a payload the shared schema accepts, including every checked service', () => {
    const form = formWith([
      ...base,
      ['serviceInterest', 'Redesign'],
      ['serviceInterest', 'Ecommerce'],
      ['budgetBand', '25k-60k'],
      ['siteUrl', 'halloway.com'],
    ]);
    const lead = leadSubmissionSchema.parse(leadSubmissionFromForm(form, null));
    expect(lead.serviceInterest).toEqual(['Redesign', 'Ecommerce']);
    expect(lead.siteUrl).toBe('https://halloway.com');
    expect(lead.landingPageSlug).toBe('b2b-website-design');
  });

  it('passes the Turnstile token on to the API, and leaves it out when the widget wrote none', () => {
    const withToken = formWith([...base, ['cf-turnstile-response', 'XXXX.DUMMY.TOKEN.XXXX']]);
    expect(leadSubmissionSchema.parse(leadSubmissionFromForm(withToken, null)).turnstileToken).toBe(
      'XXXX.DUMMY.TOKEN.XXXX',
    );
    const withoutToken = formWith([...base, ['cf-turnstile-response', '']]);
    expect(leadSubmissionSchema.parse(leadSubmissionFromForm(withoutToken, null)).turnstileToken).toBeUndefined();
  });

  it('carries the routed enquiry type of the contact form', () => {
    const form = formWith([...base, ['type', 'CONTACT'], ['enquiryType', 'free-website-audit']]);
    expect(leadSubmissionSchema.parse(leadSubmissionFromForm(form, null)).enquiryType).toBe('free-website-audit');
  });

  it('carries the start a project brief: its type, its links and the draft it completes', () => {
    const form = formWith([
      ...base,
      ['formId', 'start-a-project'],
      ['projectType', 'redesign'],
      ['projectLinks', 'https://example.com/brief\nhttps://example.com/figma'],
      ['draftId', 'cmdraft0001'],
      ['draftToken', 'a-draft-token'],
    ]);
    const lead = leadSubmissionSchema.parse(leadSubmissionFromForm(form, null));
    expect(lead.projectType).toBe('redesign');
    expect(lead.projectLinks).toBe('https://example.com/brief\nhttps://example.com/figma');
    expect(lead.draftId).toBe('cmdraft0001');
    expect(lead.draftToken).toBe('a-draft-token');
  });

  it('carries the free website audit: the concern and a competitor to compare against', () => {
    const form = formWith([
      ...base,
      ['type', 'AUDIT'],
      ['formId', 'free-website-audit'],
      ['siteUrl', 'halloway.com'],
      ['mainConcern', 'not-enough-enquiries'],
      ['competitorUrl', 'rival.com'],
    ]);
    const lead = leadSubmissionSchema.parse(leadSubmissionFromForm(form, null));
    expect(lead.mainConcern).toBe('not-enough-enquiries');
    expect(lead.competitorUrl).toBe('https://rival.com');
  });
});

describe('attributionFromForm', () => {
  it('uses attribution captured in the browser when present', () => {
    const captured = { lastTouch: { source: 'linkedin' }, landingPage: '/lp/b2b/', device: 'mobile' };
    const form = formWith([['attribution', JSON.stringify(captured)]]);
    expect(attributionFromForm(form, 'https://calwebtech.com/lp/other/')).toEqual(captured);
  });

  it('falls back to the Referer path and UTM tags when script did not run', () => {
    const form = formWith([['attribution', '']]);
    const referer = 'https://calwebtech.com/lp/b2b/?utm_source=google&utm_campaign=q3-b2b';
    expect(attributionFromForm(form, referer)).toEqual({
      lastTouch: { source: 'google', campaign: 'q3-b2b' },
      landingPage: '/lp/b2b/',
    });
  });

  it('ignores malformed attribution JSON', () => {
    const form = formWith([['attribution', '{not json']]);
    expect(attributionFromForm(form, null)).toEqual({});
  });
});
