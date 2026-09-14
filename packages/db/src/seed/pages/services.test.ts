import { SERVICES_SETTING_KEYS, servicesIndexContentSchema } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { PAGE_FIXTURES, PAGE_SEEDS } from './index';
import { SERVICES_INDEX_PLACEHOLDER, servicesSeed } from './services';

describe('services placeholder seed', () => {
  it('is registered as a launch seed and adds no fixtures', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('services');
    const fixtures = await Promise.all(PAGE_FIXTURES.map((load) => load()));
    expect(fixtures.map((fixture) => fixture.family)).not.toContain('services');
  });

  it('matches the index contract and reads as placeholder copy', () => {
    const content = servicesIndexContentSchema.parse(SERVICES_INDEX_PLACEHOLDER);
    expect(content.title).toMatch(/^Placeholder/);
    expect(content.answerBlock).toMatch(/^Placeholder/);
    expect(content.guidance.body).toMatch(/^Placeholder/);
  });

  it('creates the setting once and never overwrites it', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await servicesSeed.seed({ setting: { upsert } } as unknown as PrismaClient);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: SERVICES_SETTING_KEYS.index },
      create: { key: SERVICES_SETTING_KEYS.index, value: servicesIndexContentSchema.parse(SERVICES_INDEX_PLACEHOLDER) },
      update: {},
    });
  });
});
