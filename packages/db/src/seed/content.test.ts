import { describe, expect, it } from 'vitest';
import * as content from './content';
import { PAGE_SEEDS } from './pages';

/**
 * The proof the reference mockups invented, and the shapes it came in. None of it may
 * reach a URL someone can open, so the placeholder seed must never contain any of it.
 */
// Words right after `#` are section anchors (`#awards`), not claims.
const FORBIDDEN: [string, RegExp][] = [
  ['percentage', /\d\s?%/],
  ['price or revenue figure', /[$£€]\s?\d/],
  ['multiplier or tenure', /\b\d+(\.\d+)?\s?(x|yrs?|years?)\b/i],
  ['star rating', /\b[1-5]\.\d\b/],
  ['review count', /\b\d+\s+(verified\s+)?reviews?\b/i],
  ['turnaround or reply-time promise', /\b(one|two|three|four|\d+)\s+(business\s+)?(hours?|days?|weeks?)\b/i],
  ['warranty', /\bwarrant(y|ies)\b/i],
  ['award or ranking', /(?<!#)\b(award(ed|s)?|winner|ranked|top\s+b2b|honourable mention)\b/i],
  ['trust or press claim', /\b(trusted by|featured in|as seen in|certified|partner since)\b/i],
  ['review platform or publication name', /\b(google|clutch|designrush|goodfirms|forbes|techcrunch|fast company|smashing magazine|cnbc|awwwards)\b/i],
  ['vendor partnership', /\b(shopify|vercel|cloudflare|wordpress|woocommerce)\b/i],
  ['invented client', /\b(northmark|verona|halloway|truvia|cascadia|meridian|bridgeline|ridgeway)\b/i],
  ['invented person', /\b(dale ferris|elena marsh|priya raman|marcus bell|dana whitfield)\b/i],
  ['stock photography', /unsplash/i],
  ['net promoter score', /\bNPS\b|\bnet promoter\b/i],
];

const everything = JSON.stringify(content);

describe('placeholder seed content', () => {
  it.each(FORBIDDEN)('contains no %s', (_what, pattern) => {
    expect(everything).not.toMatch(pattern);
  });

  it('uses contact details reserved for fiction and documentation', () => {
    expect(content.PLACEHOLDER_CONTACT.phoneE164).toMatch(/^\+1555010\d{4}$/);
    expect(content.PLACEHOLDER_CONTACT.email.endsWith('@example.com')).toBe(true);
  });

  it('leaves every proof section without records', () => {
    expect(content.LANDING_CONTENT.hero.stats).toEqual([]);
    expect(content.LANDING_CONTENT.problem.cards).toEqual([]);
    expect(content.LANDING_CONTENT.guarantees.items).toEqual([]);
    expect(content.LANDING_CONTENT.finalCta.points).toEqual([]);
    expect(content.PLACEHOLDER_PROOF).toEqual({ npsScore: null, npsProjectCount: null });
    expect(content.HOME_CONTENT.capability.showreel).toBeNull();
    expect(content.HOME_CONTENT.estimate.bullets).toEqual([]);
    expect(content.HOME_CONTENT.book.points).toEqual([]);
  });

  it.each(FORBIDDEN)('gives the site page families no %s either', async (_what, pattern) => {
    const pages = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(JSON.stringify(pages.map((page) => page.content))).not.toMatch(pattern);
  });

  it('points every homepage anchor at a section the template always renders', () => {
    const anchors = JSON.stringify(content.HOME_CONTENT).match(/"#[a-z]+"/g) ?? [];
    const rendered = ['#work', '#estimate', '#book', '#awards', '#locations', '#insights', '#pricing', '#process', '#tech', '#beforeafter', '#quote'];
    for (const anchor of anchors) expect(rendered).toContain(anchor.replaceAll('"', ''));
  });
});
