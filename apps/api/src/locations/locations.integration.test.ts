import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@calwebtech/db';
import { PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import {
  LOCATIONS_SETTING_KEYS,
  SETTING_KEYS,
  locationDetailViewSchema,
  locationsIndexViewSchema,
  type LocationContentInput,
  type LocationsIndexContentInput,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from './locations.service';

// Needs a migrated Postgres: infra/docker-compose.yml with the dev overrides locally,
// services in CI. The test creates its own uniquely named locations, and the settings it
// needs only when they are missing, and removes everything it created afterwards.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));
const db = prisma.client;
const run = `${Date.now().toString(36)}-${String(process.pid)}`;
const slug = (name: string) => `it-location-${name}-${run}`;

const ANSWER =
  'Test City has a test office that builds test websites for businesses nearby. This second sentence completes the answer block for the integration test.';

const INDEX_CONTENT: LocationsIndexContentInput = {
  seo: { title: 'Test locations', description: 'Test description.' },
  title: 'Test locations',
  answerBlock: ANSWER,
  tiers: {
    TIER_1: { heading: 'Where is tier one?' },
    TIER_2: { heading: 'Where is tier two?' },
    TIER_3: { heading: 'Where is tier three?' },
  },
  empty: 'No test locations are published.',
};

const createdSettings: string[] = [];
const createdLocations: string[] = [];

async function ensureSetting(key: string, value: Prisma.InputJsonObject): Promise<void> {
  const existing = await db.setting.findUnique({ where: { key }, select: { id: true } });
  if (existing) return;
  await db.setting.create({ data: { key, value } });
  createdSettings.push(key);
}

function locationData(name: string, overrides: Partial<Prisma.LocationCreateInput> = {}): Prisma.LocationCreateInput {
  return {
    city: `Test ${name}`,
    slug: slug(name),
    state: 'TC',
    tier: 'TIER_2',
    answerBlock: ANSWER,
    serviceArea: 'Test service area statement.',
    localContext: 'First test paragraph.\n\nSecond test paragraph.',
    localIndustries: ['Test industry'],
    status: 'PUBLISHED',
    ...overrides,
  };
}

let service: LocationsService;

beforeAll(async () => {
  await ensureSetting(LOCATIONS_SETTING_KEYS.index, INDEX_CONTENT);
  await ensureSetting(SETTING_KEYS.contact, PLACEHOLDER_CONTACT);

  const nearby = await db.location.create({ data: locationData('nearby') });
  const draft = await db.location.create({ data: locationData('draft', { status: 'DRAFT' }) });
  createdLocations.push(nearby.id, draft.id);

  const content: LocationContentInput = {
    services: { heading: 'Which services fit?', items: [{ slug: slug('no-such-service'), body: 'Test body.' }] },
    caseStudies: { heading: 'What have we built?', projectSlugs: [slug('no-such-project')] },
    places: ['Test place'],
  };
  const main = await db.location.create({
    data: locationData('main', {
      tier: 'TIER_1',
      address: '1 Test Street\nTest City, TC 00000',
      phone: '(555) 010-0199',
      content,
      nearbyIds: [draft.id, nearby.id],
      faqs: {
        create: [
          { question: 'Is this the second question?', answer: 'Second answer.', order: 2 },
          { question: 'Is this the first question?', answer: 'First answer.', order: 1 },
        ],
      },
    }),
  });
  createdLocations.push(main.id);
  service = new LocationsService(prisma);
});

afterAll(async () => {
  await db.faq.deleteMany({ where: { locationId: { in: createdLocations } } });
  await db.location.deleteMany({ where: { id: { in: createdLocations } } });
  if (createdSettings.length > 0) await db.setting.deleteMany({ where: { key: { in: createdSettings } } });
  await prisma.onModuleDestroy();
});

describe('locations against the database', () => {
  it('builds a published city page with its FAQs in order, only published nearby links, and no unpublished proof', async () => {
    const view = locationDetailViewSchema.parse(await service.findPublished(slug('main')));
    expect(view.faq?.items.map((item) => item.question)).toEqual(['Is this the first question?', 'Is this the second question?']);
    expect(view.nearby?.items.map((item) => item.slug)).toEqual([slug('nearby')]);
    expect(view.nearby?.items.map((item) => item.slug)).not.toContain(slug('draft'));
    expect([view.services, view.caseStudies, view.testimonial]).toEqual([null, null, null]);
    expect(view.serviceAreaSection?.places).toEqual(['Test place']);
    expect(view.contact.phoneE164).toBe('+15550100199');
  });

  it('answers null for a draft or an unknown slug', async () => {
    expect(await service.findPublished(slug('draft'))).toBeNull();
    expect(await service.findPublished(slug('missing'))).toBeNull();
  });

  it('lists published locations by tier on the index, without drafts', async () => {
    const view = locationsIndexViewSchema.parse(await service.findIndex());
    const tiers = view.groups.map((group) => group.tier);
    expect([...tiers].sort()).toEqual(tiers);
    const slugs = view.groups.flatMap((group) => group.locations.map((location) => location.slug));
    expect(slugs).toContain(slug('main'));
    expect(slugs).toContain(slug('nearby'));
    expect(slugs).not.toContain(slug('draft'));
    const tierOf = (wanted: string) => view.groups.find((group) => group.locations.some((location) => location.slug === wanted))?.tier;
    expect([tierOf(slug('main')), tierOf(slug('nearby'))]).toEqual(['TIER_1', 'TIER_2']);
  });
});
