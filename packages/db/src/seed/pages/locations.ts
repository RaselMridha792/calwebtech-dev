import { LOCATIONS_SETTING_KEYS, locationsIndexContentSchema, type LocationsIndexContentInput } from '@calwebtech/shared';
import type { Prisma } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for `/locations/`, so the page renders its empty state against the
 * launch seed. No location records are seeded: a city page needs honest local content,
 * which a placeholder cannot give (docs/04-seo-keyword-map.md, "Location rules").
 */
export const LOCATIONS_INDEX_PLACEHOLDER: LocationsIndexContentInput = {
  seo: {
    title: 'Placeholder locations title',
    description: 'Placeholder. The approved copy describes where the business works.',
  },
  title: 'Placeholder locations heading',
  answerBlock:
    'Placeholder answer block for the locations page. The approved copy replaces these two sentences with where the business works.',
  intro: 'Placeholder. The approved copy introduces the locations.',
  tiers: {
    TIER_1: { heading: 'Placeholder first tier heading?', intro: null },
    TIER_2: { heading: 'Placeholder second tier heading?', intro: null },
    TIER_3: { heading: 'Placeholder third tier heading?', intro: null },
  },
  empty: 'No locations are published yet.',
  approach: null,
};

export const locationsSeed: PageSeed = {
  family: 'locations',
  content: LOCATIONS_INDEX_PLACEHOLDER,
  /** Creates the setting once; copy a person has set since is never overwritten. */
  async seed(db) {
    const key = LOCATIONS_SETTING_KEYS.index;
    const existing = await db.setting.findUnique({ where: { key }, select: { id: true } });
    if (existing) return;
    const value = locationsIndexContentSchema.parse(LOCATIONS_INDEX_PLACEHOLDER) as Prisma.InputJsonObject;
    await db.setting.create({ data: { key, value } });
  },
};
