import { LOCATIONS_SETTING_KEYS, locationsIndexContentSchema } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { PAGE_SEEDS } from './index';
import { LOCATIONS_INDEX_PLACEHOLDER, locationsSeed } from './locations';

function fakeDb(existing: { id: string } | null) {
  const setting = { findUnique: vi.fn().mockResolvedValue(existing), create: vi.fn().mockResolvedValue({}) };
  return { db: { setting } as unknown as PrismaClient, setting };
}

describe('locations placeholder seed', () => {
  it('is registered and holds valid, visibly placeholder copy for the index', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('locations');
    const content = locationsIndexContentSchema.parse(LOCATIONS_INDEX_PLACEHOLDER);
    expect(content.title).toMatch(/^Placeholder/);
    expect(content.approach).toBeNull();
  });

  it('creates the index setting once and never overwrites copy set since', async () => {
    const fresh = fakeDb(null);
    await locationsSeed.seed(fresh.db);
    expect(fresh.setting.create).toHaveBeenCalledWith({
      data: { key: LOCATIONS_SETTING_KEYS.index, value: locationsIndexContentSchema.parse(LOCATIONS_INDEX_PLACEHOLDER) },
    });

    const edited = fakeDb({ id: 'existing' });
    await locationsSeed.seed(edited.db);
    expect(edited.setting.create).not.toHaveBeenCalled();
  });
});
