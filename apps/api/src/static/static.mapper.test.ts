import type { Faq, PricingTier, ProcessStep } from '@calwebtech/db';
import { PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  staticFaqGroupKeys,
  staticFaqItems,
  toStaticContactView,
  toStaticFaqView,
  toStaticLegalView,
  toStaticNotFoundView,
  toStaticPricingView,
  toStaticProcessView,
  toStaticThankYouView,
} from './static.mapper';

const at = new Date('2026-09-01T00:00:00Z');
const answer = 'Test answer block that opens the page with a direct answer. It has a second sentence to count.';
const note = 'Test copy.';
const seo = { title: 'Test page', description: 'Test description.' };
const cta = { heading: 'Test call to action', body: note, primaryCta: { label: 'Contact', href: '/contact/' }, secondaryCta: null };
const titled = [{ title: 'Test item', body: note }];

let sequence = 0;
function faq(overrides: Partial<Faq> = {}): Faq {
  sequence += 1;
  return {
    id: `faq-${String(sequence)}`,
    question: 'Is this a test question?',
    answer: 'Test answer.',
    group: 'pricing',
    order: sequence,
    serviceId: null,
    industryId: null,
    locationId: null,
    landingPageId: null,
    ...overrides,
  };
}

const pricingContent = {
  seo,
  hero: { title: 'Pricing', answer, intro: note },
  backdrop: null,
  tiers: { heading: 'What does it cost?', intro: note, highlightLabel: 'Most common', note, empty: 'None yet.' },
  included: { heading: 'What is included?', intro: note, items: ['Test inclusion'] },
  factors: { heading: 'What moves the number?', intro: note, items: titled },
  quoting: { heading: 'How is it quoted?', intro: note, steps: titled },
  faq: { heading: 'Any questions?', intro: note },
  cta,
};

const processContent = {
  seo,
  hero: { title: 'Process', answer, intro: note },
  backdrop: null,
  steps: { heading: 'How does it run?', intro: note, youGetLabel: 'You get', weNeedLabel: 'We need', empty: 'None yet.' },
  principles: { heading: 'What holds it together?', intro: note, items: titled },
  delays: { heading: 'What slows it down?', intro: note, items: titled },
  afterLaunch: { heading: 'What happens after launch?', body: note, items: ['Test item'], link: null },
  faq: { heading: 'Any questions?', intro: note },
  cta,
};

const contactContent = {
  seo,
  hero: { title: 'Contact', intro: note },
  image: null,
  form: {
    heading: 'Send a message',
    intro: note,
    enquiryLabel: 'Topic',
    messageLabel: 'Message',
    messagePlaceholder: 'Hint',
    submitLabel: 'Send',
    footnote: note,
    success: { heading: 'Thanks', body: note },
  },
  details: { heading: 'Details', phoneLabel: 'Phone', emailLabel: 'Email', officesLabel: 'Offices', response: note },
  routing: { heading: 'Who reads it?', intro: note, linkLabel: 'Choose', descriptions: [{ slug: 'support', body: 'Goes to support.' }] },
  nextSteps: { heading: 'What happens next?', steps: titled },
};

const faqContent = {
  seo,
  hero: { title: 'Questions', answer, intro: note },
  groups: [
    { key: 'pricing', heading: 'How is it priced?', intro: note },
    { key: 'process', heading: 'How does it run?', intro: note },
  ],
  navLabel: 'Topics',
  empty: 'None yet.',
  cta,
};

const thankYouContent = {
  image: null,
  callLabel: 'Call us',
  pages: [
    {
      type: 'contact',
      seo,
      eyebrow: 'Received',
      title: 'Thanks',
      intro: note,
      received: { heading: 'You sent', items: ['Your name and email'] },
      response: { label: 'Reply', value: 'Test window', detail: note },
      nextSteps: { heading: 'Next', steps: titled },
      secondary: { heading: 'Meanwhile', body: note, cta: { label: 'Home', href: '/' } },
      links: [],
    },
  ],
};

const legalContent = {
  slug: 'terms',
  seo,
  title: 'Terms',
  intro: note,
  lastUpdated: '2026-09-14',
  sections: [{ id: 'use', heading: 'Use', blocks: [{ type: 'paragraph', text: note }] }],
  contactSection: { heading: 'Questions', body: note },
};

function step(overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id: 'step',
    title: 'Discovery',
    timing: 'Test timing',
    summary: 'Test summary.',
    heading: 'Test heading',
    body: 'Test body.',
    youGet: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    weNeed: ['A'],
    imageUrl: null,
    imageAlt: null,
    order: 0,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

function tier(overrides: Partial<PricingTier> = {}): PricingTier {
  return {
    id: 'tier',
    name: 'Test tier',
    priceLabel: 'Test price',
    summary: 'Test summary.',
    highlighted: false,
    active: true,
    order: 0,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

describe('staticFaqItems', () => {
  it('leaves out questions that are not written as questions', () => {
    const items = staticFaqItems([faq({ id: 'kept' }), faq({ id: 'dropped', question: 'Not a question' }), faq({ id: 'empty', answer: ' ' })]);
    expect(items.map((item) => item.id)).toEqual(['kept']);
  });
});

describe('toStaticPricingView', () => {
  it('maps tiers and questions, and renders with none of either', () => {
    const view = toStaticPricingView({ contentSetting: pricingContent, tiers: [tier({ highlighted: true })], faqs: [faq()] });
    expect(view.tiers).toEqual([{ name: 'Test tier', priceLabel: 'Test price', summary: 'Test summary.', highlighted: true }]);
    expect(view.faqs).toHaveLength(1);
    expect(toStaticPricingView({ contentSetting: pricingContent, tiers: [], faqs: [] })).toMatchObject({ tiers: [], faqs: [] });
  });

  it('throws on missing or malformed copy', () => {
    expect(() => toStaticPricingView({ contentSetting: null, tiers: [], faqs: [] })).toThrow(ZodError);
    const noAnswer = { ...pricingContent, hero: { ...pricingContent.hero, answer: 'One sentence.' } };
    expect(() => toStaticPricingView({ contentSetting: noAnswer, tiers: [], faqs: [] })).toThrow(ZodError);
    const plainHeading = { ...pricingContent, factors: { ...pricingContent.factors, heading: 'Factors' } };
    expect(() => toStaticPricingView({ contentSetting: plainHeading, tiers: [], faqs: [] })).toThrow(ZodError);
  });
});

describe('toStaticProcessView', () => {
  it('maps steps with images only when they carry alt text, and caps the lists', () => {
    const view = toStaticProcessView({
      contentSetting: processContent,
      steps: [
        step({ imageUrl: 'https://images.example.com/a.jpg', imageAlt: 'A workshop' }),
        step({ title: 'Design', imageUrl: 'https://images.example.com/b.jpg', imageAlt: null }),
      ],
      faqs: [],
    });
    expect(view.steps[0]?.image).toEqual({ src: 'https://images.example.com/a.jpg', alt: 'A workshop' });
    expect(view.steps[1]?.image).toBeNull();
    expect(view.steps[0]?.youGet).toHaveLength(6);
  });

  it('renders with no steps, and throws on missing copy', () => {
    expect(toStaticProcessView({ contentSetting: processContent, steps: [], faqs: [] }).steps).toEqual([]);
    expect(() => toStaticProcessView({ contentSetting: undefined, steps: [], faqs: [] })).toThrow(ZodError);
  });
});

describe('toStaticContactView', () => {
  it('lists offices with an address and describes enquiry types the copy knows', () => {
    const view = toStaticContactView({
      contentSetting: contactContent,
      contactSetting: PLACEHOLDER_CONTACT,
      locations: [
        { city: 'Test city', address: 'Test street\nTest city' },
        { city: 'No office', address: null },
      ],
      enquiryTypes: [
        { slug: 'support', name: 'Support' },
        { slug: 'press', name: 'Press' },
      ],
    });
    expect(view.offices).toEqual([{ city: 'Test city', address: 'Test street\nTest city' }]);
    expect(view.enquiryTypes).toEqual([
      { slug: 'support', name: 'Support', description: 'Goes to support.' },
      { slug: 'press', name: 'Press', description: null },
    ]);
    expect(JSON.stringify(view)).not.toContain('mailbox');
  });

  it('throws on malformed contact details', () => {
    expect(() =>
      toStaticContactView({ contentSetting: contactContent, contactSetting: { phone: 'x' }, locations: [], enquiryTypes: [] }),
    ).toThrow(ZodError);
  });
});

describe('toStaticFaqView', () => {
  it('groups questions in the configured order and leaves out empty groups', () => {
    const view = toStaticFaqView({
      contentSetting: faqContent,
      faqs: [faq({ group: 'process', id: 'p1' }), faq({ group: 'unknown', id: 'u1' })],
    });
    expect(view.groups.map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([['process', ['p1']]]);
    expect(toStaticFaqView({ contentSetting: faqContent, faqs: [] }).groups).toEqual([]);
  });

  it('names the groups to query, or none when the copy is malformed', () => {
    expect(staticFaqGroupKeys(faqContent)).toEqual(['pricing', 'process']);
    expect(staticFaqGroupKeys(null)).toEqual([]);
    expect(() => toStaticFaqView({ contentSetting: null, faqs: [] })).toThrow(ZodError);
  });
});

describe('toStaticThankYouView', () => {
  it('returns the page for a type, with the contact details, or null for a type without one', () => {
    const view = toStaticThankYouView({ type: 'contact', contentSetting: thankYouContent, contactSetting: PLACEHOLDER_CONTACT });
    expect(view).toMatchObject({ type: 'contact', callLabel: 'Call us', contact: PLACEHOLDER_CONTACT });
    expect(toStaticThankYouView({ type: 'careers', contentSetting: thankYouContent, contactSetting: PLACEHOLDER_CONTACT })).toBeNull();
    expect(toStaticThankYouView({ type: 'nope', contentSetting: thankYouContent, contactSetting: PLACEHOLDER_CONTACT })).toBeNull();
  });
});

describe('toStaticLegalView', () => {
  it('adds the contact details to the page copy', () => {
    const view = toStaticLegalView({ slug: 'terms', contentSetting: legalContent, contactSetting: PLACEHOLDER_CONTACT });
    expect(view).toMatchObject({ slug: 'terms', lastUpdated: '2026-09-14', contact: PLACEHOLDER_CONTACT });
  });

  it('throws when the stored copy belongs to another page or is malformed', () => {
    expect(() => toStaticLegalView({ slug: 'privacy-policy', contentSetting: legalContent, contactSetting: PLACEHOLDER_CONTACT })).toThrow();
    expect(() =>
      toStaticLegalView({ slug: 'terms', contentSetting: { ...legalContent, sections: [] }, contactSetting: PLACEHOLDER_CONTACT }),
    ).toThrow(ZodError);
    expect(() => toStaticLegalView({ slug: 'terms', contentSetting: null, contactSetting: PLACEHOLDER_CONTACT })).toThrow(ZodError);
  });
});

describe('toStaticNotFoundView', () => {
  const notFoundContent = {
    eyebrow: 'Error 404',
    title: 'Page not found',
    intro: note,
    search: { label: 'Search', placeholder: 'Hint', submitLabel: 'Go', resultsLabel: 'pages match', noResults: note },
    destinations: { heading: 'Popular pages', items: [{ title: 'Pricing', body: note, href: '/pricing/' }] },
    help: { heading: 'Need a person?', body: note },
  };

  it('adds the contact details, and throws on missing copy or more than six destinations', () => {
    expect(toStaticNotFoundView({ contentSetting: notFoundContent, contactSetting: PLACEHOLDER_CONTACT }).contact).toEqual(PLACEHOLDER_CONTACT);
    expect(() => toStaticNotFoundView({ contentSetting: null, contactSetting: PLACEHOLDER_CONTACT })).toThrow(ZodError);
    const items = Array.from({ length: 7 }, (_, index) => ({ title: `Page ${String(index)}`, body: note, href: '/' }));
    const tooMany = { ...notFoundContent, destinations: { heading: 'Popular pages', items } };
    expect(() => toStaticNotFoundView({ contentSetting: tooMany, contactSetting: PLACEHOLDER_CONTACT })).toThrow(ZodError);
  });
});
