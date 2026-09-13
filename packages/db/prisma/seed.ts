/**
 * `pnpm db:seed`: placeholder content that is safe on a reachable URL (src/seed/content.ts).
 * The API image runs the same seed as `node dist/seed.js` when a stack sets SEED_ON_DEPLOY.
 */
import { config } from 'dotenv';
import { createPrismaClient } from '../src';
import { seedLaunchContent } from '../src/seed';

config({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const prisma = createPrismaClient(databaseUrl);

void seedLaunchContent(prisma)
  .then(({ landingPageSlug }) => {
    console.log(`Seeded placeholder content; landing page at /lp/${landingPageSlug}/`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
