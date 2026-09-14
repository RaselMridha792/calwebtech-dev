import { INDUSTRY_SETTING_KEYS, industriesIndexContentSchema } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { INDUSTRIES_INDEX_PLACEHOLDER, industriesFixtures, industriesSeed } from './industries';

function fakeDb(existing: unknown) {
  const create = vi.fn();
  const db = { setting: { findUnique: vi.fn().mockResolvedValue(existing), create } };
  return { db: db as unknown as PrismaClient, create };
}

describe('industries page seed', () => {
  it('writes placeholder index copy that satisfies the page contract', () => {
    const content = industriesIndexContentSchema.parse(INDUSTRIES_INDEX_PLACEHOLDER);
    expect(content.answerBlock).toMatch(/^Placeholder\./);
    expect(content.approach.items).toEqual([]);
    expect(industriesSeed.content).toBe(INDUSTRIES_INDEX_PLACEHOLDER);
  });

  it('creates the index setting once and never overwrites it', async () => {
    const missing = fakeDb(null);
    await industriesSeed.seed(missing.db);
    expect(missing.create).toHaveBeenCalledWith({
      data: { key: INDUSTRY_SETTING_KEYS.index, value: expect.objectContaining({ title: 'Industries' }) as unknown },
    });

    const present = fakeDb({ key: INDUSTRY_SETTING_KEYS.index, value: {} });
    await industriesSeed.seed(present.db);
    expect(present.create).not.toHaveBeenCalled();
  });

  it('labels the end-to-end fixture as a test fixture', () => {
    expect(JSON.stringify(industriesFixtures.content)).toMatch(/Test fixture/);
  });
});
