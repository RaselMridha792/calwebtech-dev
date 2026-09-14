import { COMPANY_CONTENT_SCHEMAS, COMPANY_FAQ_GROUPS, COMPANY_PAGES, COMPANY_SETTING_KEYS } from '@calwebtech/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../generated/prisma/client';
import {
  COMPANY_FIXTURE_FAQS,
  COMPANY_FIXTURE_TEAM_MEMBER,
  COMPANY_PLACEHOLDERS,
  companyFixtures,
  companySeed,
} from './company';
import { PAGE_FIXTURES, PAGE_SEEDS } from './index';

describe('company placeholder seed', () => {
  it('is registered with the launch seed', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds.map((seed) => seed.family)).toContain('company');
  });

  it('gives every company page copy that matches its contract and says it is a placeholder', () => {
    for (const page of COMPANY_PAGES) {
      const parsed = COMPANY_CONTENT_SCHEMAS[page].parse(COMPANY_PLACEHOLDERS[page]);
      expect(parsed.hero.title).toMatch(/^Placeholder/);
      expect(parsed.seo.title).toMatch(/^Placeholder/);
    }
  });

  it('creates missing settings and never overwrites one that exists', async () => {
    const existing = new Set([COMPANY_SETTING_KEYS.about]);
    const create = vi.fn(() => Promise.resolve({}));
    const db = {
      setting: {
        findUnique: vi.fn(({ where }: { where: { key: string } }) => Promise.resolve(existing.has(where.key) ? { id: 'x' } : null)),
        create,
      },
    } as unknown as PrismaClient;

    await companySeed.seed(db);

    const created = create.mock.calls.map((call: unknown[]) => (call[0] as { data: { key: string } }).data.key);
    expect(created).toEqual(COMPANY_PAGES.filter((page) => page !== 'about').map((page) => COMPANY_SETTING_KEYS[page]));
  });
});

describe('company end-to-end fixtures', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const fakeDb = () => {
    const faq = vi.fn(() => Promise.resolve({}));
    const teamMember = vi.fn(() => Promise.resolve({}));
    const db = { faq: { upsert: faq }, teamMember: { upsert: teamMember } } as unknown as PrismaClient;
    return { db, faq, teamMember };
  };

  it('is registered with the fixture seed, not the launch seed', async () => {
    const fixtures = await Promise.all(PAGE_FIXTURES.map((load) => load()));
    expect(fixtures).toContain(companyFixtures);
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    expect(seeds).not.toContain(companyFixtures);
  });

  it('labels every row as a test fixture', () => {
    for (const faq of COMPANY_FIXTURE_FAQS) {
      expect(faq.id).toMatch(/^e2e-fixture-/);
      expect(faq.question).toMatch(/^Test fixture/);
      expect(faq.answer).toMatch(/^Test fixture/);
    }
    expect(COMPANY_FIXTURE_TEAM_MEMBER.slug).toMatch(/^e2e-fixture-/);
    for (const text of [COMPANY_FIXTURE_TEAM_MEMBER.name, COMPANY_FIXTURE_TEAM_MEMBER.role, COMPANY_FIXTURE_TEAM_MEMBER.bio]) {
      expect(text).toMatch(/^Test fixture/);
    }
  });

  it('gives at least two questions to each page it covers, so the keyboard check has something to open', () => {
    for (const group of [COMPANY_FAQ_GROUPS.awards, COMPANY_FAQ_GROUPS.team]) {
      expect(COMPANY_FIXTURE_FAQS.filter((faq) => faq.group === group).length).toBeGreaterThanOrEqual(2);
    }
    const groups: readonly string[] = Object.values(COMPANY_FAQ_GROUPS);
    for (const faq of COMPANY_FIXTURE_FAQS) expect(groups).toContain(faq.group);
  });

  it('refuses to run outside development', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    const { db, faq, teamMember } = fakeDb();
    await expect(companyFixtures.seed(db)).rejects.toThrow(/Refusing/);
    expect(faq).not.toHaveBeenCalled();
    expect(teamMember).not.toHaveBeenCalled();
  });

  it('upserts by fixed id and slug, so a second run writes the same rows', async () => {
    vi.stubEnv('APP_ENV', 'development');
    const { db, faq, teamMember } = fakeDb();
    await companyFixtures.seed(db);
    await companyFixtures.seed(db);

    const faqKeys = faq.mock.calls.map((call: unknown[]) => (call[0] as { where: { id: string } }).where.id);
    const ids = COMPANY_FIXTURE_FAQS.map((row) => row.id);
    expect(faqKeys).toEqual([...ids, ...ids]);
    const memberKeys = teamMember.mock.calls.map((call: unknown[]) => (call[0] as { where: { slug: string } }).where.slug);
    expect(memberKeys).toEqual([COMPANY_FIXTURE_TEAM_MEMBER.slug, COMPANY_FIXTURE_TEAM_MEMBER.slug]);
  });
});
