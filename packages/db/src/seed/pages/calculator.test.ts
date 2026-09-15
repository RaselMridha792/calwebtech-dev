import {
  CALCULATOR_OPTIONS,
  CALCULATOR_SETTING_KEYS,
  CALCULATOR_STEP_KEYS,
  calculatorPageContentSchema,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { CALCULATOR_PAGE_PLACEHOLDER, calculatorPlaceholderCopy, calculatorSeed } from './calculator';
import { PAGE_SEEDS } from './index';

/** A client that records the settings it is asked to write. */
function recordingClient() {
  const upserts: { key: string; create: unknown; update: unknown }[] = [];
  const db = {
    setting: {
      upsert: ({ where, create, update }: { where: { key: string }; create: unknown; update: unknown }) => {
        upserts.push({ key: where.key, create, update });
        return Promise.resolve(create);
      },
    },
  };
  return { db: db as unknown as PrismaClient, upserts };
}

describe('calculator placeholder seed', () => {
  it('is registered with the page seeds', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('calculator');
  });

  it('matches the page contract, with a label for every stored answer value', () => {
    const content = calculatorPageContentSchema.parse(CALCULATOR_PAGE_PLACEHOLDER);
    for (const step of CALCULATOR_STEP_KEYS) {
      const options: Record<string, { label: string }> = content.calculator.steps[step].options;
      expect(Object.keys(options).sort()).toEqual([...CALCULATOR_OPTIONS[step]].sort());
      for (const option of CALCULATOR_OPTIONS[step]) expect(options[option]?.label).toMatch(/^Placeholder/);
    }
  });

  it('creates the copy setting once and never overwrites a value someone has set', async () => {
    const { db, upserts } = recordingClient();
    await calculatorSeed.seed(db);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.key).toBe(CALCULATOR_SETTING_KEYS.page);
    expect(upserts[0]?.update).toEqual({});
  });

  it('promises nothing: no figures, no vendors and no proof in the placeholder copy', () => {
    const copy = calculatorPlaceholderCopy().join(' ');
    expect(copy).not.toMatch(/[$£€]\s?\d/);
    expect(copy).not.toMatch(/\d\s?%/);
    expect(copy).not.toMatch(/\b(shopify|wordpress|woocommerce|unsplash)\b/i);
  });

  it('scans its words, not the stored answer values a platform name can appear in', () => {
    expect(calculatorSeed.content).toEqual(calculatorPlaceholderCopy());
    expect(JSON.stringify(CALCULATOR_PAGE_PLACEHOLDER)).toMatch(/"wordpress"/);
  });
});
