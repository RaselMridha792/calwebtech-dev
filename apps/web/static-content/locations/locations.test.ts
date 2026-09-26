import {
  LOCATION_FAQ_MAX,
  LOCATION_FAQ_MIN,
  LOCATION_NEARBY_MAX,
  LOCATION_UNIQUE_SHARE_MIN,
  locationCompleteness,
  locationDetailViewSchema,
  locationPath,
  locationsIndexViewSchema,
} from '@calwebtech/shared';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import home from '../home.json';
import { unfinishedCopy } from '../copy-rules';
import { locationSnapshots, locationsIndexSnapshot } from './index';

const directory = import.meta.dirname;
const detailFiles = readdirSync(directory).filter((file) => file.endsWith('.json') && file !== 'index.json');
const details = Object.entries(locationSnapshots).map(([slug, snapshot]) => ({
  slug,
  view: locationDetailViewSchema.parse(snapshot),
}));
const index = locationsIndexViewSchema.parse(locationsIndexSnapshot);

describe('locations snapshots', () => {
  it('match the contract, one file per city named after its slug', () => {
    expect(detailFiles.map((file) => file.replace(/\.json$/, '')).sort()).toEqual(Object.keys(locationSnapshots).sort());
    for (const { slug, view } of details) expect(view.slug).toBe(slug);
  });

  it('have publish-ready copy with nothing unfinished', () => {
    expect(unfinishedCopy(index)).toEqual([]);
    for (const { view } of details) expect(unfinishedCopy(view)).toEqual([]);
  });

  it('list exactly the cities that have a page, grouped by tier', () => {
    const listed = index.groups.flatMap((group) => group.locations.map((location) => location.slug));
    expect(listed.sort()).toEqual(Object.keys(locationSnapshots).sort());
    for (const group of index.groups) {
      expect(group.heading).toBe(index.content.tiers[group.tier].heading);
      for (const location of group.locations) expect(location.tier).toBe(group.tier);
    }
  });

  it('hold only the offices and addresses in the approved homepage content', () => {
    const offices = new Map(home.locations.map((location) => [location.slug, location]));
    for (const { slug, view } of details) {
      const office = offices.get(slug);
      expect(office, `${slug} is a location in home.json`).toBeDefined();
      expect([view.city, view.state, view.tier, view.address]).toEqual([office?.city, office?.state, office?.tier, office?.address]);
      expect(view.serviceArea).toBe(office?.serviceArea);
    }
  });

  it('give every city page four to five FAQs, at most six nearby links to pages that exist, and a local contact', () => {
    for (const { view } of details) {
      expect(view.faq?.items.length ?? 0).toBeGreaterThanOrEqual(LOCATION_FAQ_MIN);
      expect(view.faq?.items.length ?? 0).toBeLessThanOrEqual(LOCATION_FAQ_MAX);
      expect(view.nearby?.items.length ?? 0).toBeLessThanOrEqual(LOCATION_NEARBY_MAX);
      for (const nearby of view.nearby?.items ?? []) {
        expect(nearby.slug).not.toBe(view.slug);
        expect(Object.keys(locationSnapshots)).toContain(nearby.slug);
      }
      expect(locationPath(view.slug)).toBe(`/locations/${view.slug}/`);
      // A local contact is a mailbox, with a number only when the site publishes one.
      expect(view.contact.email).toMatch(/@/);
      if (view.contact.phoneE164 !== null) expect(view.contact.phoneE164).toMatch(/^\+[1-9]\d{6,14}$/);
    }
  });

  it('keep at least sixty per cent of each city page unique (docs/04-seo-keyword-map.md)', () => {
    const views = details.map(({ view }) => view);
    for (const { slug, view } of details) {
      const completeness = locationCompleteness(view, { others: views, places: ['California', 'Texas'] });
      expect(completeness.issues, `${slug} completeness`).toEqual([]);
      expect(completeness.uniqueShare, `${slug} unique share`).toBeGreaterThanOrEqual(LOCATION_UNIQUE_SHARE_MIN);
    }
  });

  it('keep the testimonial only where its company is a client named for that city', () => {
    for (const { view } of details) {
      if (!view.testimonial) continue;
      expect(view.clients?.names).toContain(view.testimonial.item.company);
    }
  });
});
