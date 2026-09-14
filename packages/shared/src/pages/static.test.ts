import { describe, expect, it } from 'vitest';
import { LEAD_TYPES, leadSubmissionSchema } from '../lead';
import { thankYouPath } from '../site-paths';
import {
  STATIC_SETTING_KEYS,
  STATIC_LEGAL_SLUGS,
  STATIC_THANK_YOU_BY_LEAD_TYPE,
  STATIC_THANK_YOU_TYPES,
  isStaticInlineHref,
  staticNotFoundContentSchema,
  staticThankYouPathForLead,
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
    lastUpdated: '2026-09-14',
    sections: [{ id: 'use', heading: 'Using the site', blocks: [{ type: 'paragraph', text: 'Read the [privacy policy](/privacy-policy/).' }] }],
    contactSection: { heading: 'Questions about these terms', body: 'Write to us and a person will reply.' },
    ...overrides,
  };
}

describe('static family constants', () => {
  it('sends every lead type to a thank-you page that exists, at a lowercase, hyphenated path', () => {
    expect(Object.keys(STATIC_THANK_YOU_BY_LEAD_TYPE).sort()).toEqual([...LEAD_TYPES].sort());
    for (const type of LEAD_TYPES) expect(STATIC_THANK_YOU_TYPES).toContain(STATIC_THANK_YOU_BY_LEAD_TYPE[type]);
    for (const type of STATIC_THANK_YOU_TYPES) expect(type).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    expect(staticThankYouPathForLead('CONTACT')).toBe(thankYouPath('contact'));
    expect(staticThankYouPathForLead('CONSULTATION')).toBe('/thank-you/booking/');
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
  it('accepts a page with inline links a visitor can follow', () => {
    expect(staticLegalContentSchema.safeParse(legalPage()).success).toBe(true);
  });

  it('rejects links a visitor cannot follow, and two sections with the same id', () => {
    const unsafe = [{ id: 'use', heading: 'Using the site', blocks: [{ type: 'paragraph', text: '[Click](javascript:alert(1))' }] }];
    expect(staticLegalContentSchema.safeParse(legalPage({ sections: unsafe })).success).toBe(false);
    const section = { id: 'use', heading: 'Using the site', blocks: [{ type: 'paragraph', text: 'Text.' }] };
    expect(staticLegalContentSchema.safeParse(legalPage({ sections: [section, section] })).success).toBe(false);
  });
});

describe('staticNotFoundContentSchema', () => {
  const content = {
    eyebrow: 'Error 404',
    title: 'That page is not here',
    intro: 'It may have moved.',
    search: { label: 'Search', placeholder: 'Pricing', submitLabel: 'Search', resultsLabel: 'matching pages', noResults: 'Nothing matches.' },
    destinations: { heading: 'Popular pages', items: [{ title: 'Pricing', body: 'What it costs.', href: '/pricing/' }] },
    help: { heading: 'Still lost?', body: 'Call us.' },
  };

  it('lists at most six destinations, each a site path or URL rather than an anchor', () => {
    expect(staticNotFoundContentSchema.safeParse(content).success).toBe(true);
    const seven = Array.from({ length: 7 }, (_, index) => ({ title: `Page ${String(index)}`, body: 'Body.', href: '/' }));
    expect(staticNotFoundContentSchema.safeParse({ ...content, destinations: { heading: 'Popular', items: seven } }).success).toBe(false);
    const anchor = [{ title: 'Pricing', body: 'Body.', href: '#pricing' }];
    expect(staticNotFoundContentSchema.safeParse({ ...content, destinations: { heading: 'Popular', items: anchor } }).success).toBe(false);
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
