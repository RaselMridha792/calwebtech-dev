import { COMPANY_CONTENT_SCHEMAS, COMPANY_PAGES, COMPANY_SETTING_KEYS } from '@calwebtech/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { COMPANY_PLACEHOLDERS, companySeed } from './company';
import { PAGE_SEEDS } from './index';

describe('company placeholder seed', () => {
  it('is registered with the launch seed', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('company');
  });

  it('gives every company page copy that matches its contract and says it is a placeholder', () => {
    for (const page of COMPANY_PAGES) {
      const parsed = COMPANY_CONTENT_SCHEMAS[page].parse(COMPANY_PLACEHOLDERS[page]);
      expect(parsed.hero.title).toMatch(/^Placeholder/);
      expect(parsed.seo.title).toMatch(/^Placeholder/);
    }
  });

  it('creates missing settings and never overwrites one that exists', async () => {
    const existing = new Set([COMPANY_SETTING_KEYS.about]);
    const create = vi.fn(() => Promise.resolve({}));
    const db = {
      setting: {
        findUnique: vi.fn(({ where }: { where: { key: string } }) => Promise.resolve(existing.has(where.key) ? { id: 'x' } : null)),
        create,
      },
    } as unknown as PrismaClient;

    await companySeed.seed(db);

    const created = create.mock.calls.map((call: unknown[]) => (call[0] as { data: { key: string } }).data.key);
    expect(created).toEqual(COMPANY_PAGES.filter((page) => page !== 'about').map((page) => COMPANY_SETTING_KEYS[page]));
  });
});
