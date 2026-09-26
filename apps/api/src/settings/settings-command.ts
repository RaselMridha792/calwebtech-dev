import type { Prisma, PrismaClient } from '@calwebtech/db';
import {
  SETTING_KEYS,
  homepageIndexingSchema,
  leadNotificationRecipientsSchema,
  siteContactSchema,
  siteIndexingSchema,
  siteProofSchema,
} from '@calwebtech/shared';
import type { z } from 'zod';
import { writeAudit } from '../auth/audit-writer';
import { changedSections, redactSecrets } from '../common/changed-fields';

/**
 * What `settings-cli` does, apart from the process around it, so it can be tested against a
 * database (docs/08-decisions.md, 68).
 *
 * Values are validated with the schemas the API and worker read them with. A `set` writes the
 * setting and its audit row in one transaction, so a change is never made unrecorded: the
 * same action the settings screen writes, `setting.changed`, with no user, marked
 * `via: 'settings-cli'`, the key, the fields that changed, and the value before and after
 * with any secret-named field's value left out.
 */
export const SETTINGS_CLI_SCHEMAS: Record<string, z.ZodType> = {
  [SETTING_KEYS.contact]: siteContactSchema,
  [SETTING_KEYS.proof]: siteProofSchema,
  [SETTING_KEYS.leadNotificationRecipients]: leadNotificationRecipientsSchema,
  [SETTING_KEYS.homepageIndexing]: homepageIndexingSchema,
  [SETTING_KEYS.siteIndexing]: siteIndexingSchema,
};

export const SETTINGS_CLI_USAGE = `usage: settings-cli get|set <${Object.keys(SETTINGS_CLI_SCHEMAS).join('|')}> ['<json>']`;

/** Runs one command and returns what to print. Throws on bad usage or a value the schema refuses. */
export async function settingsCommand(db: PrismaClient, args: readonly string[]): Promise<string> {
  const [command, key, raw] = args;
  const schema = key ? SETTINGS_CLI_SCHEMAS[key] : undefined;
  if ((command !== 'get' && command !== 'set') || !key || !schema || (command === 'set' && !raw)) {
    throw new Error(SETTINGS_CLI_USAGE);
  }

  if (command === 'get') {
    const row = await db.setting.findUnique({ where: { key } });
    return JSON.stringify(row?.value ?? null, null, 2);
  }

  const value: unknown = JSON.parse(raw ?? '');
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid value for ${key}: ${parsed.error.message}`);
  // Validated JSON from JSON.parse, so it is a JSON value.
  const json = value as Prisma.InputJsonValue;

  await db.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key }, select: { value: true } });
    await tx.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
    await writeAudit(tx, {
      userId: null,
      action: 'setting.changed',
      entityType: 'Setting',
      entityId: key,
      before: { value: redactSecrets(before?.value ?? null) },
      after: {
        via: 'settings-cli',
        changed: changedSections(before?.value ?? null, typeof value === 'object' && value !== null ? value : {}),
        value: redactSecrets(value),
      },
    });
  });
  return `${key} = ${JSON.stringify(value)}`;
}
