import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { SETTING_KEYS } from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { migrateDeploy } from '../prisma/migrate-deploy';
import { settingsCommand } from './settings-command';

/**
 * `settings-cli` against a real database (docs/08-decisions.md, 68): a `set` changes the
 * setting and writes the audit row the settings screen would, marked as the command line's;
 * a `get` and a refused value write nothing.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_settings_cli_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const db = createPrismaClient(databaseUrl);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

const auditRows = () => db.auditLog.findMany({ where: { entityType: 'Setting' }, orderBy: { createdAt: 'asc' } });

describe('settings-cli', () => {
  it('writes the setting and an audit row that says the command line changed it', async () => {
    const key = SETTING_KEYS.siteIndexing;
    expect(await settingsCommand(db, ['set', key, '{"index":false}'])).toBe(`${key} = {"index":false}`);
    await settingsCommand(db, ['set', key, '{"index":true}']);

    expect((await db.setting.findUniqueOrThrow({ where: { key } })).value).toEqual({ index: true });
    const rows = await auditRows();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      userId: null,
      action: 'setting.changed',
      entityId: key,
      before: { value: { index: false } },
      after: { via: 'settings-cli', changed: ['index'], value: { index: true } },
    });
    // The first set had nothing before it.
    expect(rows[0]?.before).toEqual({ value: null });
  });

  it('records which fields changed in a larger setting', async () => {
    const key = SETTING_KEYS.contact;
    await settingsCommand(db, ['set', key, '{"email":"hello@example.com","phone":null,"phoneE164":null}']);
    await settingsCommand(db, ['set', key, '{"email":"leads@example.com","phone":null,"phoneE164":null}']);
    const last = (await auditRows()).at(-1);
    expect(last?.after).toMatchObject({ changed: ['email'] });
  });

  it('writes nothing for a read, or for a value the schema refuses', async () => {
    const before = (await auditRows()).length;
    await settingsCommand(db, ['get', SETTING_KEYS.siteIndexing]);
    await expect(settingsCommand(db, ['set', SETTING_KEYS.siteIndexing, '{"index":"yes"}'])).rejects.toThrow(/Invalid value/);
    await expect(settingsCommand(db, ['set', 'not.a.setting', '{}'])).rejects.toThrow(/usage/);
    expect(await auditRows()).toHaveLength(before);
    expect((await db.setting.findUniqueOrThrow({ where: { key: SETTING_KEYS.siteIndexing } })).value).toEqual({ index: true });
  });
});
