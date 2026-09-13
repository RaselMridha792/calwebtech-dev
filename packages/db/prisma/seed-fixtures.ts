/**
 * `pnpm db:seed:fixtures`: proof-shaped end-to-end test fixtures (src/seed/fixtures.ts).
 * Local and CI only. It runs only with APP_ENV=development.
 */
import { config } from 'dotenv';
import { createPrismaClient } from '../src';
import { seedTestFixtures } from '../src/seed';

config({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const prisma = createPrismaClient(databaseUrl);

void seedTestFixtures(prisma)
  .then(({ landingPageSlug }) => {
    console.log(`Seeded end-to-end fixtures; fixture page at /lp/${landingPageSlug}/`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
