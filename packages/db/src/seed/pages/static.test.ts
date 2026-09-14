import { STATIC_LEGAL_SLUGS, STATIC_SETTING_KEYS } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { PAGE_SEEDS } from './index';
import { STATIC_ENQUIRY_TYPES, staticSeed } from './static';

interface Call {
  model: 'setting' | 'enquiryType';
  args: unknown;
}

/** A client that records writes; settings named in `existingKeys` already exist. */
function recordingClient(existingKeys: readonly string[] = []) {
  const calls: Call[] = [];
  const db = {
    setting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(existingKeys.includes(where.key) ? { id: where.key } : null),
      create: (args: unknown) => {
        calls.push({ model: 'setting', args });
        return Promise.resolve(args);
      },
    },
    enquiryType: {
      upsert: (args: unknown) => {
        calls.push({ model: 'enquiryType', args });
        return Promise.resolve(args);
      },
    },
  };
  const createdKeys = () =>
    calls.filter((call) => call.model === 'setting').map((call) => (call.args as { data: { key: string } }).data.key);
  return { db: db as unknown as PrismaClient, calls, createdKeys };
}

describe('static family placeholder seed', () => {
  it('is registered with the page seeds', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('static');
  });

  it('creates every page setting, validated, and routes enquiries to a documentation mailbox', async () => {
    const { db, calls, createdKeys } = recordingClient();
    await staticSeed.seed(db);
    expect(createdKeys().sort()).toEqual(
      [
        STATIC_SETTING_KEYS.pricing,
        STATIC_SETTING_KEYS.process,
        STATIC_SETTING_KEYS.contact,
        STATIC_SETTING_KEYS.faq,
        STATIC_SETTING_KEYS.thankYou,
        STATIC_SETTING_KEYS.notFound,
        ...STATIC_LEGAL_SLUGS.map((slug) => STATIC_SETTING_KEYS.legal[slug]),
      ].sort(),
    );
    expect(calls.filter((call) => call.model === 'enquiryType')).toHaveLength(STATIC_ENQUIRY_TYPES.length);
    for (const type of STATIC_ENQUIRY_TYPES) expect(type.mailbox.endsWith('@example.com')).toBe(true);
  });

  it('never overwrites a setting that already exists', async () => {
    const { db, createdKeys } = recordingClient([STATIC_SETTING_KEYS.pricing]);
    await staticSeed.seed(db);
    expect(createdKeys()).not.toContain(STATIC_SETTING_KEYS.pricing);
  });
});
