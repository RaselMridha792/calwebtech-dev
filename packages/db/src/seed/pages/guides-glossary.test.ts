import {
  GUIDES_GLOSSARY_SETTING_KEYS,
  glossaryIndexContentSchema,
  guideSummarySections,
  guidesIndexContentSchema,
} from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { PAGE_FIXTURES, PAGE_SEEDS } from './index';
import {
  FIXTURE_GUIDE_SLUG,
  FIXTURE_TERM_SLUGS,
  GLOSSARY_INDEX_PLACEHOLDER,
  GUIDES_INDEX_PLACEHOLDER,
  guidesGlossaryFixtures,
  guidesGlossarySeed,
} from './guides-glossary';

describe('guides and glossary placeholder seed', () => {
  it('is registered as a launch seed and as a fixture', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('guides-glossary');
    const fixtures = await Promise.all(PAGE_FIXTURES.map((load) => load()));
    expect(fixtures.map((fixture) => fixture.family)).toContain('guides-glossary');
  });

  it('matches both index contracts and reads as placeholder copy', () => {
    const guides = guidesIndexContentSchema.parse(GUIDES_INDEX_PLACEHOLDER);
    const glossary = glossaryIndexContentSchema.parse(GLOSSARY_INDEX_PLACEHOLDER);
    expect(guides.answerBlock).toMatch(/^Placeholder/);
    expect(glossary.answerBlock).toMatch(/^Placeholder/);
    expect(guides.list.empty).toBe('No guides are published yet.');
    expect(glossary.list.empty).toBe('No terms are published yet.');
  });

  it('creates each setting once and never overwrites it', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await guidesGlossarySeed.seed({ setting: { upsert } } as unknown as PrismaClient);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map((call) => (call[0] as { where: { key: string } }).where.key)).toEqual([
      GUIDES_GLOSSARY_SETTING_KEYS.guides,
      GUIDES_GLOSSARY_SETTING_KEYS.glossary,
    ]);
    for (const call of upsert.mock.calls) expect((call[0] as { update: unknown }).update).toEqual({});
  });
});

describe('guides and glossary fixtures', () => {
  it('publish one guide and two terms, linked to a service the launch seed publishes', async () => {
    const guideUpsert = vi.fn().mockResolvedValue({});
    const termUpsert = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue({ id: 'service-1' });
    await guidesGlossaryFixtures.seed({
      guide: { upsert: guideUpsert },
      glossaryTerm: { upsert: termUpsert },
      service: { findUnique },
    } as unknown as PrismaClient);

    expect((guideUpsert.mock.calls[0]?.[0] as { where: { slug: string } }).where.slug).toBe(FIXTURE_GUIDE_SLUG);
    expect(termUpsert.mock.calls.map((call) => (call[0] as { where: { slug: string } }).where.slug)).toEqual([
      ...FIXTURE_TERM_SLUGS,
    ]);
    for (const call of termUpsert.mock.calls) {
      expect((call[0] as { create: { relatedServiceId: string | null } }).create.relatedServiceId).toBe('service-1');
    }
  });

  it('still seeds the terms when that service is not published', async () => {
    const termUpsert = vi.fn().mockResolvedValue({});
    await guidesGlossaryFixtures.seed({
      guide: { upsert: vi.fn().mockResolvedValue({}) },
      glossaryTerm: { upsert: termUpsert },
      service: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient);
    expect((termUpsert.mock.calls[0]?.[0] as { create: { relatedServiceId: string | null } }).create.relatedServiceId).toBeNull();
  });

  it('writes a guide summary the mapper turns into an answer and question-shaped sections', () => {
    const summary = String((guidesGlossaryFixtures.content as string[])[0]);
    const sections = guideSummarySections(summary);
    expect(sections).toHaveLength(3);
    expect(sections[0]?.heading).toBeNull();
    expect(sections[1]?.heading).toMatch(/\?$/);
    expect(sections[1]?.bullets).toHaveLength(2);
  });
});
