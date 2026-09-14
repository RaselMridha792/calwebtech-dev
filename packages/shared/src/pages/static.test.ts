import { describe, expect, it } from 'vitest';
import { LEAD_TYPES, leadSubmissionSchema } from '../lead';
import {
  STATIC_SETTING_KEYS,
  STATIC_LEGAL_SLUGS,
  STATIC_THANK_YOU_BY_LEAD_TYPE,
  STATIC_THANK_YOU_TYPES,
  isStaticInlineHref,
  staticFaqContentSchema,
  staticLegalContentSchema,
  staticTextParts,
} from './static';

const seo = { title: 'Terms of service', description: 'The terms that apply when you use this website.' };

function legalPage(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'terms',
    seo,
    title: 'Terms of service',
    intro: 'These terms apply to anyone who uses this website.',
    reviewStatus: 'draft',
    draftNotice: 'This page is a draft pending legal review.',
    lastUpdated: '2026-09-14',
    sections: [{ id: 'use', heading: 'Using the site', blocks: [{ type: 'paragraph', text: 'Read the [privacy policy](/privacy-policy/).' }] }],
    contactSection: { heading: 'Questions about these terms', body: 'Write to us and a person will reply.' },
    ...overrides,
  };
}

describe('static family constants', () => {
  it('gives every lead type exactly one thank-you page with a lowercase, hyphenated slug', () => {
    expect(Object.keys(STATIC_THANK_YOU_BY_LEAD_TYPE).sort()).toEqual([...LEAD_TYPES].sort());
    expect(new Set(STATIC_THANK_YOU_TYPES).size).toBe(LEAD_TYPES.length);
    for (const type of STATIC_THANK_YOU_TYPES) expect(type).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  });

  it('keys each legal page in its own setting under the family prefix', () => {
    const keys = STATIC_LEGAL_SLUGS.map((slug) => STATIC_SETTING_KEYS.legal[slug]);
    expect(new Set(keys).size).toBe(STATIC_LEGAL_SLUGS.length);
    for (const key of [...keys, STATIC_SETTING_KEYS.pricing, STATIC_SETTING_KEYS.faq]) expect(key).toMatch(/^static\./);
  });
});

describe('staticTextParts', () => {
  it('splits copy into text and inline links, in order', () => {
    expect(staticTextParts('See the [cookie policy](/cookie-policy/) or [email us](mailto:hello@example.com).')).toEqual([
      'See the ',
      { label: 'cookie policy', href: '/cookie-policy/' },
      ' or ',
      { label: 'email us', href: 'mailto:hello@example.com' },
      '.',
    ]);
    expect(staticTextParts('No links here.')).toEqual(['No links here.']);
  });

  it('allows site paths and https, mailto and tel links only', () => {
    expect(isStaticInlineHref('/terms/')).toBe(true);
    expect(isStaticInlineHref('https://www.w3.org/TR/WCAG22/')).toBe(true);
    expect(isStaticInlineHref('tel:+15550100100')).toBe(true);
    expect(isStaticInlineHref('//evil.example')).toBe(false);
    expect(isStaticInlineHref('javascript:alert(1)')).toBe(false);
    expect(isStaticInlineHref('http://insecure.example')).toBe(false);
  });
});

describe('staticLegalContentSchema', () => {
  it('accepts a draft page with its notice', () => {
    expect(staticLegalContentSchema.safeParse(legalPage()).success).toBe(true);
  });

  it('rejects a draft without a visible notice, and links a visitor cannot follow', () => {
    expect(staticLegalContentSchema.safeParse(legalPage({ draftNotice: null })).success).toBe(false);
    expect(staticLegalContentSchema.safeParse(legalPage({ reviewStatus: 'reviewed', draftNotice: null })).success).toBe(true);
    const unsafe = [{ id: 'use', heading: 'Using the site', blocks: [{ type: 'paragraph', text: '[Click](javascript:alert(1))' }] }];
    expect(staticLegalContentSchema.safeParse(legalPage({ sections: unsafe })).success).toBe(false);
  });
});

describe('staticFaqContentSchema', () => {
  it('lists each group once, with a question for its heading', () => {
    const base = {
      seo,
      hero: {
        title: 'Frequently asked questions',
        answer: 'Most questions are about price, timing and ownership. The answers below are the ones we give on first calls.',
        intro: 'Grouped by topic.',
      },
      navLabel: 'Topics',
      empty: 'No questions are published yet.',
      cta: { heading: 'Still unsure?', body: 'Ask us directly.', primaryCta: { label: 'Contact us', href: '/contact/' }, secondaryCta: null },
    };
    const group = { key: 'pricing', heading: 'How is a project priced?', intro: 'Money questions.' };
    expect(staticFaqContentSchema.safeParse({ ...base, groups: [group] }).success).toBe(true);
    expect(staticFaqContentSchema.safeParse({ ...base, groups: [group, group] }).success).toBe(false);
    expect(staticFaqContentSchema.safeParse({ ...base, groups: [{ ...group, heading: 'Pricing' }] }).success).toBe(false);
  });
});

describe('leadSubmissionSchema enquiryType', () => {
  const lead = { type: 'CONTACT', formId: 'contact-page', name: 'Test Person', email: 'test@example.com' };

  it('takes an optional enquiry type slug and treats a blank one as absent', () => {
    expect(leadSubmissionSchema.parse({ ...lead, enquiryType: 'free-website-audit' }).enquiryType).toBe('free-website-audit');
    expect(leadSubmissionSchema.parse({ ...lead, enquiryType: '' }).enquiryType).toBeUndefined();
    expect(leadSubmissionSchema.safeParse({ ...lead, enquiryType: 'Not A Slug' }).success).toBe(false);
  });
});
