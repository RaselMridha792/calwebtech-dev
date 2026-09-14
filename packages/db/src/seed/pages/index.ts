import type { PrismaClient } from '../../generated/prisma/client';

/**
 * Rows a site page family needs in the database (docs/10-site-pages.md). Each family keeps
 * its seed in `packages/db/src/seed/pages/<family>.ts` and appends one loader line below.
 */
export interface PageSeed {
  family: string;
  /**
   * Every piece of copy the seed writes, so content.test.ts can scan launch seeds for the
   * invented proof the reference mockups carry.
   */
  content: unknown;
  /** Safe to run again; never overwrites a value a person set since. */
  seed: (db: PrismaClient) => Promise<void>;
}

export type PageSeedLoader = () => Promise<PageSeed>;

/**
 * Placeholder rows, run by `pnpm db:seed` after the homepage and landing page. Safe on a URL
 * someone can open, so placeholder-only (content.ts rules), for example:
 *
 *   () => import('./services').then((module) => module.servicesSeed),
 */
export const PAGE_SEEDS: readonly PageSeedLoader[] = [
  // Site page families: one line each, below this one.
  () => import('./insights.js').then((module) => module.insightsSeed),
];

/**
 * Proof-shaped end-to-end fixtures, run by `pnpm db:seed:fixtures` in development only, for
 * templates the launch seed leaves empty (a case study, a consented testimonial).
 */
export const PAGE_FIXTURES: readonly PageSeedLoader[] = [
  // Site page families: one line each, below this one.
  () => import('./insights.js').then((module) => module.insightsFixtures),
];

export async function runPageSeeds(db: PrismaClient, loaders: readonly PageSeedLoader[]): Promise<void> {
  for (const load of loaders) {
    const page = await load();
    await page.seed(db);
  }
}
