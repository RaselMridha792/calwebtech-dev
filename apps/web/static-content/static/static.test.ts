import {
  STATIC_LEGAL_SLUGS,
  STATIC_THANK_YOU_TYPES,
  countSentences,
  staticContactViewSchema,
  staticFaqViewSchema,
  staticLegalViewSchema,
  staticPricingViewSchema,
  staticProcessViewSchema,
  staticThankYouViewSchema,
} from '@calwebtech/shared';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { unfinishedCopy } from '../copy-rules';
import {
  staticContactSnapshot,
  staticFaqSnapshot,
  staticLegalSnapshots,
  staticPricingSnapshot,
  staticProcessSnapshot,
  staticThankYouSnapshots,
} from './index';

const here = import.meta.dirname;
const jsonFiles = (folder: string) =>
  fs
    .readdirSync(path.join(here, folder))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();

/**
 * The static family's snapshots (docs/10-site-pages.md): each is exactly what its endpoint
 * returns, matches the contract and carries publish-ready copy.
 */
describe('static family snapshots', () => {
  const singles = [
    ['pricing', staticPricingViewSchema, staticPricingSnapshot],
    ['process', staticProcessViewSchema, staticProcessSnapshot],
    ['contact', staticContactViewSchema, staticContactSnapshot],
    ['faq', staticFaqViewSchema, staticFaqSnapshot],
  ] as const;

  it.each(singles)('%s matches its contract and has no unfinished copy', (_name, schema, snapshot) => {
    const view = schema.parse(snapshot);
    expect(unfinishedCopy(view)).toEqual([]);
  });

  it('has a thank-you page for every conversion type, each file named after its type', () => {
    expect(jsonFiles('thank-you')).toEqual([...STATIC_THANK_YOU_TYPES].sort());
    for (const type of STATIC_THANK_YOU_TYPES) {
      const view = staticThankYouViewSchema.parse(staticThankYouSnapshots[type]);
      expect(view.type).toBe(type);
      expect(unfinishedCopy(view)).toEqual([]);
    }
    expect(Object.hasOwn(staticThankYouSnapshots, 'constructor')).toBe(false);
  });

  it('has every legal page, named after its slug, marked as a draft pending legal review', () => {
    expect(jsonFiles('legal')).toEqual([...STATIC_LEGAL_SLUGS].sort());
    for (const slug of STATIC_LEGAL_SLUGS) {
      const view = staticLegalViewSchema.parse(staticLegalSnapshots[slug]);
      expect(view.slug).toBe(slug);
      expect(view.reviewStatus).toBe('draft');
      expect(view.draftNotice).toMatch(/draft pending legal review/i);
      expect(unfinishedCopy(view)).toEqual([]);
    }
  });

  it('keeps titles and descriptions unique across the family', () => {
    const seos = [
      staticPricingViewSchema.parse(staticPricingSnapshot).content.seo,
      staticProcessViewSchema.parse(staticProcessSnapshot).content.seo,
      staticContactViewSchema.parse(staticContactSnapshot).content.seo,
      staticFaqViewSchema.parse(staticFaqSnapshot).seo,
      ...STATIC_THANK_YOU_TYPES.map((type) => staticThankYouViewSchema.parse(staticThankYouSnapshots[type]).seo),
      ...STATIC_LEGAL_SLUGS.map((slug) => staticLegalViewSchema.parse(staticLegalSnapshots[slug]).seo),
    ];
    expect(new Set(seos.map((seo) => seo.title)).size).toBe(seos.length);
    expect(new Set(seos.map((seo) => seo.description)).size).toBe(seos.length);
  });

  it('names the approved price bands the same way in the answer block and the tiers', () => {
    const pricing = staticPricingViewSchema.parse(staticPricingSnapshot);
    expect(countSentences(pricing.content.hero.answer)).toBeLessThanOrEqual(3);
    expect(pricing.tiers.map((tier) => tier.priceLabel)).toEqual(['$12k to $25k', '$25k to $60k', 'From $1.5k/mo']);
    expect(pricing.content.hero.answer).toContain('$12,000 to $25,000');
    expect(pricing.content.hero.answer).toContain('$25,000 to $60,000');
  });

  it('routes the contact form through enquiry types without exposing a mailbox', () => {
    const contact = staticContactViewSchema.parse(staticContactSnapshot);
    expect(contact.enquiryTypes.map((type) => type.slug)).toContain('free-website-audit');
    expect(JSON.stringify(staticContactSnapshot)).not.toMatch(/mailbox/i);
  });

  it('keeps one FAQ question per id and no question twice across groups', () => {
    const faq = staticFaqViewSchema.parse(staticFaqSnapshot);
    const items = faq.groups.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.question)).size).toBe(items.length);
  });
});
