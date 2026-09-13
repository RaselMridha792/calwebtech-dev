import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env on its own. Scripts run from packages/db, and the
// repo keeps a single .env at the root.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read lazily so `prisma generate` works in CI without a database.
    url: process.env.DATABASE_URL ?? '',
    // Only `migrate dev` needs a shadow database; production uses `migrate deploy`.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
});
