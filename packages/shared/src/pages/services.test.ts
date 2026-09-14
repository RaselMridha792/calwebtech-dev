import { describe, expect, it } from 'vitest';
import { leadSubmissionSchema } from '../lead';
import {
  formatServicePrice,
  groupHeadingFallback,
  serviceContentSchema,
  servicePriceSchema,
  servicesIndexContentSchema,
  type ServiceContentInput,
} from './services';

const content: ServiceContentInput = {
  hero: { outcome: 'A site your team can publish to on its own.', primaryCtaLabel: 'Get a quote' },
  included: { heading: 'What is included?' },
  process: { heading: 'How does the project run?' },
  technology: { heading: 'Which technologies do you use?' },
  proof: { heading: 'What results has this work delivered?', linkLabel: 'See the work' },
  industries: { heading: 'Which industries is it built for?' },
  testimonial: { heading: 'What do clients say?' },
  faq: { heading: 'What do buyers ask first?' },
  enquiry: { heading: 'How do I get a quote?', submitLabel: 'Send my enquiry' },
  formSuccess: { heading: 'Thanks.', body: 'We will reply by email.' },
  related: { heading: 'Which services go with it?' },
};

describe('servicePriceSchema and formatServicePrice', () => {
  it('reads a project band, an open-ended band and a monthly price', () => {
    expect(formatServicePrice(servicePriceSchema.parse({ currency: 'USD', min: 12000, max: 25000, unit: 'PROJECT' }))).toBe(
      '$12,000 to $25,000',
    );
    expect(formatServicePrice(servicePriceSchema.parse({ currency: 'USD', min: 25000, unit: 'PROJECT' }))).toBe('From $25,000');
    expect(formatServicePrice(servicePriceSchema.parse({ currency: 'USD', min: 1500, unit: 'MONTH' }))).toBe(
      'From $1,500 a month',
    );
  });

  it('rejects a band whose top is not above its start, fractions and lowercase currencies', () => {
    expect(servicePriceSchema.safeParse({ currency: 'USD', min: 25000, max: 12000, unit: 'PROJECT' }).success).toBe(false);
    expect(servicePriceSchema.safeParse({ currency: 'USD', min: 1500.5, unit: 'MONTH' }).success).toBe(false);
    expect(servicePriceSchema.safeParse({ currency: 'usd', min: 1500, unit: 'MONTH' }).success).toBe(false);
  });
});

describe('serviceContentSchema', () => {
  it('accepts the required copy and leaves the optional sections out', () => {
    const parsed = serviceContentSchema.parse(content);
    expect(parsed.problem).toBeNull();
    expect(parsed.comparison).toBeNull();
    expect(parsed.pricing).toBeNull();
    expect(parsed.price).toBeNull();
    expect(parsed.included.intro).toBeNull();
  });

  it('holds section headings to questions and problem framing to exactly three situations', () => {
    expect(serviceContentSchema.safeParse({ ...content, faq: { heading: 'Frequently asked questions' } }).success).toBe(false);
    const two = [
      { title: 'One', body: 'First situation.' },
      { title: 'Two', body: 'Second situation.' },
    ];
    expect(
      serviceContentSchema.safeParse({ ...content, problem: { heading: 'Why do buyers come here?', situations: two } }).success,
    ).toBe(false);
  });
});

describe('servicesIndexContentSchema', () => {
  it('requires an answer block and a question-shaped guidance heading', () => {
    const index = {
      seo: { title: 'Services', description: 'What we build.' },
      title: 'Services',
      answerBlock: 'We design and build websites and web applications. Every project runs on a fixed scope and price.',
      intro: 'Pick a service.',
      otherGroupName: 'More services',
      otherGroupHeading: 'Which other services do you offer?',
      empty: 'No services are published yet.',
      cardLinkLabel: 'See the service',
      guidance: { heading: 'Not sure which service you need', body: 'Ask us.', primaryCta: { label: 'Contact us', href: '/contact/' } },
    };
    expect(servicesIndexContentSchema.safeParse(index).success).toBe(false);
    expect(
      servicesIndexContentSchema.safeParse({ ...index, guidance: { ...index.guidance, heading: 'Not sure which service you need?' } })
        .success,
    ).toBe(true);
  });

  it('writes every category heading as a question, including the fallback', () => {
    const index = {
      seo: { title: 'Services', description: 'What we build.' },
      title: 'Services',
      answerBlock: 'We design and build websites and web applications. Every project runs on a fixed scope and price.',
      intro: 'Pick a service.',
      otherGroupName: 'More services',
      otherGroupHeading: 'Which other services do you offer?',
      empty: 'No services are published yet.',
      cardLinkLabel: 'See the service',
      guidance: { heading: 'Not sure which service you need?', body: 'Ask us.', primaryCta: { label: 'Contact us', href: '/contact/' } },
    };
    expect(servicesIndexContentSchema.parse(index).groupHeadings).toEqual({});
    // A setting stored before the headings existed still parses.
    expect(servicesIndexContentSchema.parse({ ...index, otherGroupHeading: undefined }).otherGroupHeading).toBeNull();
    expect(servicesIndexContentSchema.safeParse({ ...index, groupHeadings: { platforms: 'Platforms' } }).success).toBe(false);
    expect(servicesIndexContentSchema.safeParse({ ...index, groupHeadings: { Platforms: 'Which platform fits?' } }).success).toBe(false);
    expect(servicesIndexContentSchema.safeParse({ ...index, groupHeadings: { platforms: 'Which platform fits?' } }).success).toBe(true);
    expect(servicesIndexContentSchema.safeParse({ ...index, otherGroupHeading: 'More services' }).success).toBe(false);
    expect(groupHeadingFallback('Design & build')).toBe('Which services are in Design & build?');
  });
});

describe('leadSubmissionSchema serviceSlug', () => {
  const lead = { type: 'SERVICE_ENQUIRY', formId: 'service-enquiry', name: 'Test Person', email: 'test@example.com' };

  it('is optional, blank means absent, and it must be a slug', () => {
    expect(leadSubmissionSchema.parse(lead).serviceSlug).toBeUndefined();
    expect(leadSubmissionSchema.parse({ ...lead, serviceSlug: '' }).serviceSlug).toBeUndefined();
    expect(leadSubmissionSchema.parse({ ...lead, serviceSlug: 'website-redesign' }).serviceSlug).toBe('website-redesign');
    expect(leadSubmissionSchema.safeParse({ ...lead, serviceSlug: '../admin' }).success).toBe(false);
  });
});
