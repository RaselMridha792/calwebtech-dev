import { landingPageContentSchema } from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { LANDING_CONTENT } from './content';
import { assertSeedAllowed } from './guard';
import { PAGE_FIXTURES, runPageSeeds } from './pages';

/** A hidden landing page for end-to-end tests of components the launch seed leaves empty. */
export const FIXTURE_LANDING_SLUG = 'e2e-fixtures';

const fixtureImage = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=70`;

/**
 * Proof-shaped test fixtures, labelled as such. Local and CI only: `pnpm db:seed:fixtures`.
 * Refused when APP_ENV is staging or production, so they never reach a URL someone can open.
 */
export async function seedTestFixtures(db: PrismaClient): Promise<{ landingPageSlug: string }> {
  assertSeedAllowed('fixtures');

  const comparison = {
    title: 'Test fixture: before and after',
    clientName: 'Test fixture client',
    summary: 'Test fixture for the before and after slider.',
    answerBlock: 'Test fixture.',
    outcomeMetrics: [
      { value: 'A', label: 'Fixture measure one' },
      { value: 'B', label: 'Fixture measure two' },
      { value: 'C', label: 'Fixture measure three' },
    ],
    beforeImageUrl: fixtureImage('photo-1498050108023-c5249f4df085'),
    afterImageUrl: fixtureImage('photo-1460925895917-afdab827c52f'),
    beforeAfterMetrics: [{ label: 'Fixture measure', before: 'A', after: 'B' }],
    status: 'PUBLISHED' as const,
  };
  const project = await db.project.upsert({
    where: { slug: 'e2e-fixture-before-after' },
    create: { slug: 'e2e-fixture-before-after', ...comparison },
    update: comparison,
    select: { id: true },
  });

  const content = landingPageContentSchema.parse({
    ...LANDING_CONTENT,
    hero: { ...LANDING_CONTENT.hero, heading: 'End-to-end test fixtures' },
  }) as Prisma.InputJsonObject;
  const data = {
    name: 'End-to-end test fixtures',
    status: 'PUBLISHED' as const,
    noindex: true,
    publishedAt: new Date(),
    content,
    beforeAfterProject: { connect: { id: project.id } },
  };
  await db.landingPage.upsert({
    where: { slug: FIXTURE_LANDING_SLUG },
    create: { slug: FIXTURE_LANDING_SLUG, ...data },
    update: data,
  });
  await runPageSeeds(db, PAGE_FIXTURES);
  return { landingPageSlug: FIXTURE_LANDING_SLUG };
}
