import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { settingsCommand } from './settings/settings-command';

/**
 * Reads or changes a setting without a redeploy, and without the dashboard:
 *
 *   node dist/settings-cli.js get leads.notificationRecipients
 *   node dist/settings-cli.js set leads.notificationRecipients '{"emails":["leads@example.com"]}'
 *
 * On the server: docker compose run --rm api node dist/settings-cli.js set ...
 * Values are validated with the schemas the API and worker read them with, and apply to
 * the next request. Every `set` is written to the audit log, marked `via: 'settings-cli'`
 * (docs/08-decisions.md, 68), so it shows beside the settings screen's own changes.
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
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const db = createPrismaClient(databaseUrl);
  try {
    console.log(await settingsCommand(db, process.argv.slice(2)));
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
