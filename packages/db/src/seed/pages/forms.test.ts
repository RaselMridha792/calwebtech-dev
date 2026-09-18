import { FORMS_SETTING_KEYS } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import { formsSeed } from './forms';
import { PAGE_SEEDS } from './index';

/** A client that records writes; settings named in `existingKeys` already exist. */
function recordingClient(existingKeys: readonly string[] = []) {
  const created: { key: string; value: unknown }[] = [];
  const db = {
    setting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(existingKeys.includes(where.key) ? { id: where.key } : null),
      create: ({ data }: { data: { key: string; value: unknown } }) => {
        created.push(data);
        return Promise.resolve(data);
      },
    },
  };
  return { db: db as unknown as PrismaClient, created };
}

describe('forms family placeholder seed', () => {
  it('is registered with the page seeds', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('forms');
  });

  it('creates the copy both pages need to render at all', async () => {
    const { db, created } = recordingClient();
    await formsSeed.seed(db);
    expect(created.map((row) => row.key).sort()).toEqual(
      [FORMS_SETTING_KEYS.startProject, FORMS_SETTING_KEYS.freeWebsiteAudit].sort(),
    );
  });

  it('never overwrites copy that already exists', async () => {
    const { db, created } = recordingClient([FORMS_SETTING_KEYS.startProject]);
    await formsSeed.seed(db);
    expect(created.map((row) => row.key)).toEqual([FORMS_SETTING_KEYS.freeWebsiteAudit]);
  });

  it('promises no reply time and publishes no questions, so the pages show their empty states', () => {
    const copy = JSON.stringify(formsSeed.content);
    expect(copy).not.toMatch(/\b(one|two|three|four|\d+)\s+(business\s+)?(hours?|days?|weeks?)\b/i);
    expect(copy).toMatch(/Placeholder/);
  });
});
