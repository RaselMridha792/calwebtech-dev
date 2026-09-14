import { insightsCategoryCopyFor, insightsCopySchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { PAGE_FIXTURES, PAGE_SEEDS } from './index';
import { INSIGHTS_PLACEHOLDER_COPY, insightsFixtures, insightsSeed } from './insights';

describe('insights page seed', () => {
  it('writes copy that matches the contract and reads as a placeholder', () => {
    const copy = insightsCopySchema.parse(INSIGHTS_PLACEHOLDER_COPY);
    expect(copy.index.title).toMatch(/^Placeholder/);
    expect(copy.categories).toEqual({});
    expect(copy.article.newsletter.heading).toMatch(/^Placeholder/);
  });

  it('gives a topic that has no copy of its own a complete page', () => {
    const copy = insightsCopySchema.parse(INSIGHTS_PLACEHOLDER_COPY);
    const topic = insightsCategoryCopyFor(copy, { slug: 'e2e-fixture-topic', name: 'Test fixture topic' });
    expect(topic.seo.title).toBe('Test fixture topic articles');
    expect(topic.listHeading.endsWith('?')).toBe(true);
  });

  it('is registered as a launch seed and as an end-to-end fixture', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    const fixtures = await Promise.all(PAGE_FIXTURES.map((load) => load()));
    expect(seeds).toContain(insightsSeed);
    expect(fixtures).toContain(insightsFixtures);
  });

  it('publishes no article as a fixture: every published article shows on the homepage', () => {
    expect(JSON.stringify(insightsFixtures.content)).not.toMatch(/body|answerBlock/i);
  });
});
