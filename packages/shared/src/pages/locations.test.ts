import { describe, expect, it } from 'vitest';
import {
  LOCATION_UNIQUE_SHARE_MIN,
  locationContentSchema,
  locationSectionDefaults,
  locationUniqueShare,
  locationsIndexContentSchema,
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
