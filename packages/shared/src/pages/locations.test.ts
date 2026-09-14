import { describe, expect, it } from 'vitest';
import {
  LOCATION_FAQ_MIN,
  LOCATION_UNIQUE_SHARE_MIN,
  locationCompleteness,
  locationContentSchema,
  locationDetailViewSchema,
  locationSectionDefaults,
  locationUniqueShare,
  locationsIndexContentSchema,
  type LocationDetailView,
} from './locations';

const ANSWER =
  'Test City has an office that builds websites for businesses nearby. This second sentence completes the answer block for the test.';

describe('locationContentSchema', () => {
  it('accepts an empty object, so a record with only its columns still renders', () => {
    const content = locationContentSchema.parse({});
    expect(content.services).toBeNull();
    expect(content.places).toEqual([]);
  });

  it('requires section headings written as questions', () => {
    const points = [
      { title: 'Test point', body: 'Test body.' },
      { title: 'Second point', body: 'Second body.' },
    ];
    expect(locationContentSchema.safeParse({ workingModel: { heading: 'How we work', points } }).success).toBe(false);
    expect(locationContentSchema.safeParse({ workingModel: { heading: 'How do we work here?', points } }).success).toBe(true);
  });

  it('caps case studies at three and services at six', () => {
    const slugs = ['a', 'b', 'c', 'd'];
    expect(locationContentSchema.safeParse({ caseStudies: { heading: 'What have we built?', projectSlugs: slugs } }).success).toBe(false);
    const items = Array.from({ length: 7 }, (_, index) => ({ slug: `service-${String(index)}`, body: 'Test body.' }));
    expect(locationContentSchema.safeParse({ services: { heading: 'Which services fit?', items } }).success).toBe(false);
  });
});

describe('locationSectionDefaults', () => {
  it('writes every default heading as a question naming the city', () => {
    for (const heading of Object.values(locationSectionDefaults('Test City'))) {
      expect(heading).toMatch(/Test City/);
      expect(heading.endsWith('?')).toBe(true);
    }
  });
});

describe('locationsIndexContentSchema', () => {
  it('needs an answer block and a question heading per tier', () => {
    const valid = {
      seo: { title: 'Test locations', description: 'Test description.' },
      title: 'Test locations',
      answerBlock: ANSWER,
      tiers: {
        TIER_1: { heading: 'Where is tier one?' },
        TIER_2: { heading: 'Where is tier two?' },
        TIER_3: { heading: 'Where is tier three?' },
      },
      empty: 'Nothing is published.',
    };
    expect(locationsIndexContentSchema.safeParse(valid).success).toBe(true);
    expect(locationsIndexContentSchema.safeParse({ ...valid, answerBlock: 'One sentence.' }).success).toBe(false);
    expect(
      locationsIndexContentSchema.safeParse({ ...valid, tiers: { ...valid.tiers, TIER_2: { heading: 'Tier two' } } }).success,
    ).toBe(false);
  });
});

describe('locationUniqueShare', () => {
  const places = ['Northtown', 'Southport', 'West Southport'];
  const northtown =
    'Northtown grew around its river port, and most of the firms here still move goods by water. Buyers search by vessel class and berth length before they call anyone.';

  it('scores a page with the city swapped as a copy', () => {
    const cloned = northtown.replaceAll('Northtown', 'Southport');
    expect(locationUniqueShare(cloned, [northtown], places)).toBe(0);
  });

  it('scores genuinely different writing as unique', () => {
    const southport =
      'Southport is a university town where research groups spin out small software companies. They hire locally and need recruiting pages as much as sales pages.';
    expect(locationUniqueShare(southport, [northtown], places)).toBe(1);
    expect(locationUniqueShare(southport, [northtown], places)).toBeGreaterThanOrEqual(LOCATION_UNIQUE_SHARE_MIN);
  });

  it('replaces longer place names first and treats empty copy as not unique', () => {
    const west = 'West Southport grew around its river port, and most of the firms here still move goods by water.';
    expect(locationUniqueShare(west, [northtown], places)).toBe(0);
    expect(locationUniqueShare('', [northtown], places)).toBe(0);
  });
});

describe('locationCompleteness', () => {
  /** A page whose every line comes from `paragraph`, so two pages share copy only where their paragraphs do. */
  function page(slug: string, city: string, paragraph: string, faqCount: number): LocationDetailView {
    const words = paragraph.split(/\W+/).filter(Boolean);
    return locationDetailViewSchema.parse({
      slug,
      city,
      state: null,
      tier: 'TIER_1',
      seo: { title: `Test ${city}`, description: 'Test description.' },
      updatedAt: '2026-09-01T00:00:00.000Z',
      answerBlock: paragraph,
      serviceArea: null,
      heroIntro: null,
      image: null,
      address: null,
      contact: { phone: '+1 (555) 010-0199', phoneE164: '+15550100199', email: 'test@example.com' },
      localContext: { heading: `What is ${city} like?`, intro: null, paragraphs: [paragraph], industries: [] },
      clients: null,
      caseStudies: null,
      services: null,
      workingModel: null,
      serviceAreaSection: null,
      testimonial: null,
      nearby: null,
      faq:
        faqCount > 0
          ? {
              heading: `What do ${city} businesses ask?`,
              intro: null,
              items: Array.from({ length: faqCount }, (_, index) => ({
                id: `${slug}-faq-${String(index)}`,
                question: `${words.slice(index * 2, index * 2 + 2).join(' ')}?`,
                answer: `${words[index * 2 + 2] ?? city}.`,
              })),
            }
          : null,
      cta: { heading: `Planning a project in ${city}?`, body: null },
    });
  }

  const northtown =
    'Northtown grew around its river port, and most of the firms here still move goods by water. Buyers search by vessel class and berth length before they call anyone.';
  const southport =
    'Southport is a university town where research groups spin out small software companies. They hire locally and need recruiting pages as much as sales pages.';

  it('needs four FAQs, and renders fewer as incomplete rather than failing', () => {
    expect(locationCompleteness(page('northtown', 'Northtown', northtown, LOCATION_FAQ_MIN))).toEqual({
      complete: true,
      faqCount: 4,
      uniqueShare: null,
      issues: [],
    });
    const short = locationCompleteness(page('northtown', 'Northtown', northtown, 3));
    expect([short.complete, short.faqCount, short.issues.length]).toEqual([false, 3, 1]);
    expect(locationCompleteness(page('northtown', 'Northtown', northtown, 0)).faqCount).toBe(0);
  });

  it('checks the unique share against the other pages when they are given, never against itself', () => {
    const north = page('northtown', 'Northtown', northtown, 4);
    const south = page('southport', 'Southport', southport, 4);
    const unique = locationCompleteness(north, { others: [north, south] });
    expect(unique.complete).toBe(true);
    expect(unique.uniqueShare).toBeGreaterThanOrEqual(LOCATION_UNIQUE_SHARE_MIN);

    const cloned = page('clonetown', 'Clonetown', northtown.replaceAll('Northtown', 'Clonetown'), 4);
    const copy = locationCompleteness(cloned, { others: [north] });
    expect(copy.complete).toBe(false);
    expect(copy.uniqueShare).toBeLessThan(LOCATION_UNIQUE_SHARE_MIN);
    expect(copy.issues).toHaveLength(1);
  });
});
