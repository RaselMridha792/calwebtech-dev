import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { seedLaunchContent } from '@calwebtech/db/seed';

/**
 * `node dist/seed.js`: the launch placeholder seed, run from the API image.
 * infra/scripts/deploy.sh runs it on stacks with SEED_ON_DEPLOY=true (staging). It is safe
 * on a reachable URL, and it runs only with APP_ENV=staging or development.
 */

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('seed: DATABASE_URL is required');
  const db = createPrismaClient(databaseUrl);
  try {
    const { landingPageSlug } = await seedLaunchContent(db);
    console.log(`seed: placeholder content; landing page at /lp/${landingPageSlug}/`);
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
