import type { Faq, Location, Testimonial } from '@calwebtech/db';
import { PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import { LOCATION_FAQ_MIN, locationCompleteness, type LocationContentInput, type LocationsIndexContentInput } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  locationPhoneE164,
  locationReferences,
  toLocationDetailView,
  toLocationsIndexView,
  type LocationDetailRecord,
  type LocationDetailSources,
  type LocationProjectRecord,
} from './locations.mapper';

const at = new Date('2026-09-01T00:00:00Z');
let sequence = 0;

const ANSWER =
  'Test City has a test office that builds test websites for test businesses nearby. This second sentence completes the answer block for the test.';

function baseLocation(overrides: Partial<Location> = {}): Location {
  sequence += 1;
  return {
    id: `location-${String(sequence)}`,
    city: 'Test City',
    slug: `test-city-${String(sequence)}`,
    state: 'TC',
    tier: 'TIER_1',
    answerBlock: ANSWER,
    serviceArea: 'Test service area statement.',
    localContext: 'First test paragraph.\n\nSecond test paragraph.',
    localIndustries: ['Test industry'],
    localClients: null,
    address: null,
    phone: null,
    latitude: null,
    longitude: null,
    content: null,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    nearbyIds: null,
    ...overrides,
  };
}

function location(overrides: Partial<LocationDetailRecord> = {}): LocationDetailRecord {
  return { ...baseLocation(), faqs: [], ...overrides };
}

function faq(overrides: Partial<Faq> = {}): Faq {
  sequence += 1;
  return {
    id: `faq-${String(sequence)}`,
    question: 'Is this a test question?',
    answer: 'Test answer.',
    group: null,
    order: sequence,
    serviceId: null,
    industryId: null,
    locationId: null,
    landingPageId: null,
    ...overrides,
  };
}

function testimonial(overrides: Partial<Testimonial> = {}): Testimonial {
  sequence += 1;
  return {
    id: `testimonial-${String(sequence)}`,
    clientName: 'Test reviewer',
    role: null,
    company: 'Test client',
    avatarUrl: null,
    rating: 5,
    quote: 'A test quote.',
    source: null,
    videoUrl: null,
    featured: false,
    consentAt: at,
    deletedAt: null,
    date: null,
    createdAt: at,
    updatedAt: at,
    projectId: null,
    ...overrides,
  };
}

function project(slug: string, overrides: Partial<LocationProjectRecord> = {}): LocationProjectRecord {
  return {
    id: `project-${slug}`,
    title: 'Test project',
    slug,
    clientName: 'Test client',
    clientAlias: null,
    answerBlock: 'Test answer block.',
    summary: 'Test project summary.',
    liveUrl: null,
    location: 'Test state',
    segment: null,
    coverImageUrl: null,
    coverImageAlt: null,
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics: [{ value: '10', label: 'Test figure' }],
    duration: null,
    year: null,
    featured: false,
    beforeImageUrl: null,
    afterImageUrl: null,
    beforeAfterMetrics: null,
    content: null,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    industryId: null,
    industry: { name: 'Test industry' },
    testimonials: [],
    ...overrides,
  };
}

function sources(overrides: Partial<LocationDetailSources> = {}): LocationDetailSources {
  return {
    location: location(),
    contactSetting: PLACEHOLDER_CONTACT,
    services: [],
    projects: [],
    nearby: [],
    ...overrides,
  };
}

const content = (value: LocationContentInput) => value;

const INDEX_CONTENT: LocationsIndexContentInput = {
  seo: { title: 'Test locations', description: 'Test description.' },
  title: 'Test locations',
  answerBlock: ANSWER,
  tiers: {
    TIER_1: { heading: 'Where is tier one?' },
    TIER_2: { heading: 'Where is tier two?' },
    TIER_3: { heading: 'Where is tier three?' },
  },
  empty: 'No test locations are published.',
};

describe('toLocationDetailView', () => {
  it('renders a record without content from its columns, with default question headings', () => {
    const view = toLocationDetailView(sources());
    expect(view.localContext).toEqual({
      heading: 'What is the market like for businesses in Test City?',
      intro: null,
      paragraphs: ['First test paragraph.', 'Second test paragraph.'],
      industries: ['Test industry'],
    });
    expect(view.cta.heading).toBe('Planning a website project in Test City?');
    expect([view.clients, view.caseStudies, view.services, view.workingModel, view.testimonial, view.nearby, view.faq]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(view.serviceAreaSection).toBeNull();
    expect(view.contact).toEqual(PLACEHOLDER_CONTACT);
  });

  it('falls back to a title and a description within the SEO limits', () => {
    const view = toLocationDetailView(sources({ location: location({ answerBlock: `${ANSWER} ${'Long test sentence. '.repeat(1)}`.trim() }) }));
    expect(view.seo.title).toBe('Web design and development in Test City');
    expect(view.seo.description.length).toBeLessThanOrEqual(155);
    const custom = toLocationDetailView(sources({ location: location({ seo: { title: 'Custom title', description: 'Custom description.' } }) }));
    expect([custom.seo.title, custom.seo.description]).toEqual(['Custom title', 'Custom description.']);
  });

  it('fails the contract on malformed copy, a missing local context or a missing answer block', () => {
    expect(() => toLocationDetailView(sources({ location: location({ content: { services: { heading: 'Not a question' } } }) }))).toThrow(ZodError);
    expect(() => toLocationDetailView(sources({ location: location({ localContext: '  ' }) }))).toThrow(ZodError);
    expect(() => toLocationDetailView(sources({ location: location({ answerBlock: 'One sentence only.' }) }))).toThrow(ZodError);
    expect(() => toLocationDetailView(sources({ contactSetting: null }))).toThrow(ZodError);
  });

  it('keeps only published services and projects with figures, in the order the copy names them', () => {
    const record = location({
      content: content({
        services: {
          heading: 'Which services fit?',
          items: [
            { slug: 'unpublished-service', body: 'Test body.' },
            { slug: 'test-service', body: 'Test body for the market.' },
          ],
        },
        caseStudies: { heading: 'What have we built?', projectSlugs: ['second', 'no-figures', 'first'] },
      }),
    });
    const view = toLocationDetailView(
      sources({
        location: record,
        services: [{ slug: 'test-service', title: 'Test service' }],
        projects: [project('first'), project('second'), project('no-figures', { outcomeMetrics: [] })],
      }),
    );
    expect(view.services?.items).toEqual([{ slug: 'test-service', title: 'Test service', body: 'Test body for the market.' }]);
    expect(view.caseStudies?.items.map((study) => study.slug)).toEqual(['second', 'first']);
    expect(view.caseStudies?.items[0]?.tags).toEqual(['Test state', 'Test industry']);
  });

  it('leaves out services and case studies when none of them is published', () => {
    const record = location({
      content: content({
        services: { heading: 'Which services fit?', items: [{ slug: 'gone', body: 'Test body.' }] },
        caseStudies: { heading: 'What have we built?', projectSlugs: ['gone'] },
      }),
    });
    const view = toLocationDetailView(sources({ location: record }));
    expect([view.services, view.caseStudies]).toEqual([null, null]);
  });

  it('takes the local quote only from the named project, which loads consented testimonials only', () => {
    const quote = testimonial();
    const record = location({
      content: content({ testimonial: { heading: 'What does a local client say?', projectSlug: 'local' } }),
    });
    const withQuote = toLocationDetailView(
      sources({ location: record, projects: [project('other', { testimonials: [testimonial()] }), project('local', { testimonials: [quote] })] }),
    );
    expect(withQuote.testimonial?.item.id).toBe(quote.id);

    // The query filters on consent, so an unconsented quote never reaches the mapper and the section is left out.
    const withoutQuote = toLocationDetailView(sources({ location: record, projects: [project('local', { testimonials: [] })] }));
    expect(withoutQuote.testimonial).toBeNull();
  });

  it('links at most six published nearby locations in the order given, never itself', () => {
    const self = location();
    const others = Array.from({ length: 8 }, (_, index) => ({
      id: `nearby-${String(index)}`,
      slug: `nearby-${String(index)}`,
      city: `Nearby ${String(index)}`,
      state: null,
      serviceArea: null,
    }));
    const view = toLocationDetailView(
      sources({
        location: { ...self, nearbyIds: [self.id, 'unpublished', ...others.map((other) => other.id).reverse()] },
        nearby: others,
      }),
    );
    expect(view.nearby?.items.map((item) => item.slug)).toEqual(['nearby-7', 'nearby-6', 'nearby-5', 'nearby-4', 'nearby-3', 'nearby-2']);
  });

  it('treats a blank state or service area as unset, on the page and on a nearby record', () => {
    const self = location({ state: '', serviceArea: '   ', nearbyIds: ['blank-nearby'] });
    const view = toLocationDetailView(
      sources({
        location: self,
        nearby: [{ id: 'blank-nearby', slug: 'blank-nearby', city: 'Blank Nearby', state: ' ', serviceArea: '' }],
      }),
    );
    expect([view.state, view.serviceArea]).toEqual([null, null]);
    expect(view.nearby?.items).toEqual([{ slug: 'blank-nearby', city: 'Blank Nearby', state: null, serviceArea: null }]);
  });

  it('keeps five FAQs at most and uses the default heading', () => {
    const view = toLocationDetailView(sources({ location: location({ faqs: Array.from({ length: 7 }, () => faq()) }) }));
    expect(view.faq?.items).toHaveLength(5);
    expect(view.faq?.heading).toBe('What do Test City businesses ask before hiring us?');
  });

  it('renders a published record with three FAQs, which the completeness check reports as short', () => {
    const view = toLocationDetailView(sources({ location: location({ faqs: Array.from({ length: LOCATION_FAQ_MIN - 1 }, () => faq()) }) }));
    expect(view.faq?.items).toHaveLength(3);
    expect(locationCompleteness(view)).toMatchObject({ complete: false, faqCount: 3 });
    const complete = toLocationDetailView(sources({ location: location({ faqs: Array.from({ length: LOCATION_FAQ_MIN }, () => faq()) }) }));
    expect(locationCompleteness(complete).complete).toBe(true);
  });

  it('shows the service area when there is an address or places, and the local clients when named', () => {
    const view = toLocationDetailView(
      sources({ location: location({ address: '1 Test Street\nTest City, TC 00000', localClients: ['Test client'] }) }),
    );
    expect(view.serviceAreaSection).toEqual({ heading: 'Which areas around Test City do we cover?', intro: null, places: [], image: null });
    expect(view.clients?.names).toEqual(['Test client']);
  });

  it("uses the location's own number when it reads as one", () => {
    const own = toLocationDetailView(sources({ location: location({ phone: '(555) 010-0199' }) }));
    expect(own.contact).toEqual({ ...PLACEHOLDER_CONTACT, phone: '(555) 010-0199', phoneE164: '+15550100199' });
    const unreadable = toLocationDetailView(sources({ location: location({ phone: 'ask reception' }) }));
    expect(unreadable.contact).toEqual(PLACEHOLDER_CONTACT);
  });
});

describe('locationReferences', () => {
  it('names the services, projects and nearby locations a page needs, once each', () => {
    const record = location({
      nearbyIds: ['a', 'b'],
      content: content({
        services: { heading: 'Which services fit?', items: [{ slug: 'test-service', body: 'Test body.' }] },
        caseStudies: { heading: 'What have we built?', projectSlugs: ['local', 'other'] },
        testimonial: { heading: 'What does a local client say?', projectSlug: 'local' },
      }),
    });
    expect(locationReferences(record)).toEqual({ serviceSlugs: ['test-service'], projectSlugs: ['local', 'other'], nearbyIds: ['a', 'b'] });
    expect(locationReferences(location({ nearbyIds: { not: 'a list' } }))).toEqual({ serviceSlugs: [], projectSlugs: [], nearbyIds: [] });
  });
});

describe('locationPhoneE164', () => {
  it('reads national and international forms', () => {
    expect(locationPhoneE164('+1 (555) 010-0199')).toBe('+15550100199');
    expect(locationPhoneE164('555 010 0199')).toBe('+15550100199');
    expect(locationPhoneE164(null)).toBeNull();
    expect(locationPhoneE164('12')).toBeNull();
  });
});

describe('toLocationsIndexView', () => {
  const published = baseLocation;

  it('groups published locations by tier in order and leaves out empty tiers', () => {
    const view = toLocationsIndexView({
      contentSetting: INDEX_CONTENT,
      locations: [
        published({ slug: 'tier-two', tier: 'TIER_2' }),
        published({ slug: 'tier-one', tier: 'TIER_1', content: { image: { src: '/media/test.jpg', alt: 'Test image' } } }),
      ],
    });
    expect(view.groups.map((group) => [group.tier, group.heading, group.locations.map((card) => card.slug)])).toEqual([
      ['TIER_1', 'Where is tier one?', ['tier-one']],
      ['TIER_2', 'Where is tier two?', ['tier-two']],
    ]);
    expect(view.groups[0]?.locations[0]?.image).toEqual({ src: '/media/test.jpg', alt: 'Test image' });
  });

  it('has no groups when nothing is published, and a card keeps rendering when its page copy is malformed', () => {
    expect(toLocationsIndexView({ contentSetting: INDEX_CONTENT, locations: [] }).groups).toEqual([]);
    const view = toLocationsIndexView({ contentSetting: INDEX_CONTENT, locations: [published({ content: { image: 'not an image' } })] });
    expect(view.groups[0]?.locations[0]?.image).toBeNull();
  });

  it('treats a blank state, service area or address on a card as unset', () => {
    const view = toLocationsIndexView({
      contentSetting: INDEX_CONTENT,
      locations: [published({ state: ' ', serviceArea: '', address: '  ' })],
    });
    const card = view.groups[0]?.locations[0];
    expect([card?.state, card?.serviceArea, card?.address]).toEqual([null, null, null]);
  });

  it('fails the contract without its copy', () => {
    expect(() => toLocationsIndexView({ contentSetting: null, locations: [] })).toThrow(ZodError);
  });
});
