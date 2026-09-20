import { existsSync } from 'node:fs';
import path from 'node:path';
import { migrateDeploy } from './prisma/migrate-deploy';

/**
 * Applies committed migrations: `node dist/migrate.js`.
 *
 * The release workflow runs it as a one-off container from the new API image before the
 * rollout (docs/01-architecture.md, Deployment). The work is in prisma/migrate-deploy.ts,
 * which the content import test also uses on a database of its own.
 */

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('migrate: DATABASE_URL is required');
process.exitCode = migrateDeploy(databaseUrl);
