import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient, type Prisma } from '@calwebtech/db';
import {
  SETTING_KEYS,
  leadNotificationRecipientsSchema,
  siteContactSchema,
  siteProofSchema,
} from '@calwebtech/shared';
import type { z } from 'zod';

/**
 * Reads or changes a setting without a redeploy, until the admin settings screen exists:
 *
 *   node dist/settings-cli.js get leads.notificationRecipients
 *   node dist/settings-cli.js set leads.notificationRecipients '{"emails":["leads@example.com"]}'
 *
 * On the server: docker compose run --rm api node dist/settings-cli.js set ...
 * Values are validated with the schemas the API and worker read them with, and apply to
 * the next request.
 */

const SCHEMAS: Record<string, z.ZodType> = {
  [SETTING_KEYS.contact]: siteContactSchema,
  [SETTING_KEYS.proof]: siteProofSchema,
  [SETTING_KEYS.leadNotificationRecipients]: leadNotificationRecipientsSchema,
};

for (const candidate of ['.env', '../../.env']) {
  const file = path.resolve(process.cwd(), candidate);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

async function main(): Promise<void> {
  const [command, key, raw] = process.argv.slice(2);
  const schema = key ? SCHEMAS[key] : undefined;
  if ((command !== 'get' && command !== 'set') || !key || !schema || (command === 'set' && !raw)) {
    throw new Error(`usage: settings-cli get|set <${Object.keys(SCHEMAS).join('|')}> ['<json>']`);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const db = createPrismaClient(databaseUrl);
  try {
    if (command === 'get') {
      const row = await db.setting.findUnique({ where: { key } });
      console.log(JSON.stringify(row?.value ?? null, null, 2));
      return;
    }
    const value: unknown = JSON.parse(raw ?? '');
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid value for ${key}: ${parsed.error.message}`);
    // Validated JSON from JSON.parse, so it is a JSON value.
    const json = value as Prisma.InputJsonValue;
    await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
    console.log(`${key} = ${JSON.stringify(value)}`);
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
