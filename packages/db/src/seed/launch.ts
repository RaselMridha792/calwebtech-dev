import {
  HOME_PROBLEM_ROUTER_FAQ_GROUP,
  SETTING_KEYS,
  homePageContentSchema,
  homepageIndexingSchema,
  landingPageContentSchema,
  leadNotificationRecipientsSchema,
  siteContactSchema,
  siteProofSchema,
} from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  HOME_CONTENT,
  HOME_INDUSTRIES,
  HOME_PROBLEM_ROUTER,
  HOME_SERVICE_GROUPS,
  HOME_SERVICES,
  LANDING_CONTENT,
  LANDING_FAQS,
  LANDING_SEO,
  LANDING_SLUG,
  PLACEHOLDER_CONTACT,
  PLACEHOLDER_PROOF,
  PRICING_TIERS,
  PROCESS_STEPS,
} from './content';
import { assertSeedAllowed } from './guard';

/**
 * Proof-shaped rows written by earlier versions of this seed, copied from the reference
 * mockups. They are removed by these known keys only, never by wiping a table.
 */
const EARLIER_SEED = {
  reviewPlatforms: ['Google', 'Clutch', 'DesignRush', 'GoodFirms'],
  clientLogos: ['NORTHMARK', 'Verona Home', 'HALLOWAY', 'Bridgeline', 'Cascadia Health', 'Truvia Labs', 'Meridian Parts'],
  projectSlugs: ['northmark-supply', 'truvia-labs', 'halloway-group'],
  teamSlugs: ['sawkat-hasan', 'rasel-mridha', 'priya-raman', 'dana-whitfield'],
  partners: ['Shopify', 'Google', 'Vercel', 'Cloudflare'],
  technologySlugs: ['nextjs', 'react', 'typescript', 'wordpress', 'shopify', 'postgresql', 'docker', 'react-native'],
  industrySlugs: ['saas'],
  contactPhone: '+18005550188',
  npsScore: 9.6,
};

function hasField(value: unknown, field: string, expected: unknown): boolean {
  return typeof value === 'object' && value !== null && field in value && (value as Record<string, unknown>)[field] === expected;
}

async function removeEarlierProof(db: PrismaClient): Promise<void> {
  await db.reviewSource.deleteMany({ where: { platform: { in: EARLIER_SEED.reviewPlatforms } } });
  await db.clientLogo.deleteMany({ where: { name: { in: EARLIER_SEED.clientLogos } } });
  await db.testimonial.deleteMany({ where: { source: 'placeholder' } });
  await db.project.deleteMany({ where: { slug: { in: EARLIER_SEED.projectSlugs } } });
  await db.teamMember.deleteMany({ where: { slug: { in: EARLIER_SEED.teamSlugs } } });
  await db.partner.deleteMany({ where: { name: { in: EARLIER_SEED.partners } } });
  await db.technology.deleteMany({ where: { slug: { in: EARLIER_SEED.technologySlugs } } });
  await db.industry.deleteMany({ where: { slug: { in: EARLIER_SEED.industrySlugs } } });
}

/**
 * Creates a setting once. An existing value is replaced only when `isEarlierSeed` says it
 * came from an earlier seed, so anything a person set since survives every re-seed.
 */
async function seedSetting(
  db: PrismaClient,
  key: string,
  value: Prisma.InputJsonValue,
  isEarlierSeed: (current: unknown) => boolean = () => false,
): Promise<void> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) {
    await db.setting.create({ data: { key, value } });
  } else if (isEarlierSeed(row.value)) {
    await db.setting.update({ where: { key }, data: { value } });
  }
}

async function seedSettings(db: PrismaClient): Promise<void> {
  await seedSetting(db, SETTING_KEYS.contact, siteContactSchema.parse(PLACEHOLDER_CONTACT), (current) =>
    hasField(current, 'phoneE164', EARLIER_SEED.contactPhone),
  );
  await seedSetting(db, SETTING_KEYS.proof, siteProofSchema.parse(PLACEHOLDER_PROOF), (current) =>
    hasField(current, 'npsScore', EARLIER_SEED.npsScore),
  );
  // Resend's test inbox until the client confirms an address.
  await seedSetting(
    db,
    SETTING_KEYS.leadNotificationRecipients,
    leadNotificationRecipientsSchema.parse({ emails: ['delivered+leads@resend.dev'] }),
  );
  // Out of search until real content replaces the placeholders.
  await seedSetting(db, SETTING_KEYS.homepageIndexing, homepageIndexingSchema.parse({ index: false }));
}

async function seedProcessAndPricing(db: PrismaClient): Promise<void> {
  await db.processStep.deleteMany();
  await db.processStep.createMany({ data: PROCESS_STEPS.map((step, order) => ({ ...step, order })) });
  await db.pricingTier.deleteMany();
  await db.pricingTier.createMany({ data: PRICING_TIERS.map((tier, order) => ({ ...tier, order })) });
}

async function seedLandingPage(db: PrismaClient): Promise<{ id: string; slug: string }> {
  const content = landingPageContentSchema.parse(LANDING_CONTENT) as Prisma.InputJsonObject;
  const data = {
    name: 'B2B website campaign (placeholder)',
    status: 'PUBLISHED' as const,
    noindex: true,
    publishedAt: new Date(),
    content,
    seo: LANDING_SEO,
  };
  const none = { set: [] };
  const page = await db.landingPage.upsert({
    where: { slug: LANDING_SLUG },
    create: { slug: LANDING_SLUG, ...data },
    update: {
      ...data,
      results: none,
      testimonials: none,
      team: none,
      partners: none,
      technologies: none,
      beforeAfterProject: { disconnect: true },
    },
    select: { id: true, slug: true },
  });

  await db.faq.deleteMany({ where: { landingPageId: page.id } });
  await db.faq.createMany({
    data: LANDING_FAQS.map((faq, order) => ({ ...faq, order, group: 'landing', landingPageId: page.id })),
  });
  return page;
}

/**
 * Homepage copy and the content types it lists: generic service and industry names with
 * placeholder descriptions, and problem-router questions. Proof types get nothing.
 */
async function seedHomepage(db: PrismaClient): Promise<void> {
  const content = homePageContentSchema.parse(HOME_CONTENT) as Prisma.InputJsonObject;
  await db.setting.upsert({
    where: { key: SETTING_KEYS.homeContent },
    create: { key: SETTING_KEYS.homeContent, value: content },
    update: { value: content },
  });

  const groups = new Map<string, string>();
  for (const [order, group] of HOME_SERVICE_GROUPS.entries()) {
    const row = await db.serviceCategory.upsert({
      where: { slug: group.slug },
      create: { ...group, order },
      update: { name: group.name, order },
      select: { id: true },
    });
    groups.set(group.slug, row.id);
  }

  const publishedAt = new Date();
  for (const [order, { group, ...service }] of HOME_SERVICES.entries()) {
    const data = { ...service, order, status: 'PUBLISHED' as const, publishedAt, categoryId: groups.get(group) ?? null };
    await db.service.upsert({ where: { slug: service.slug }, create: data, update: data });
  }

  for (const [order, industry] of HOME_INDUSTRIES.entries()) {
    const data = { ...industry, order, status: 'PUBLISHED' as const };
    await db.industry.upsert({ where: { slug: industry.slug }, create: data, update: data });
  }

  await db.faq.deleteMany({ where: { group: HOME_PROBLEM_ROUTER_FAQ_GROUP } });
  await db.faq.createMany({
    data: HOME_PROBLEM_ROUTER.map((faq, order) => ({ ...faq, order, group: HOME_PROBLEM_ROUTER_FAQ_GROUP })),
  });
}

/**
 * The launch seed: placeholder content that is safe on a reachable URL (content.ts).
 * `pnpm db:seed` locally and in CI; `node dist/seed.js` from the API image on staging.
 */
export async function seedLaunchContent(db: PrismaClient): Promise<{ landingPageSlug: string }> {
  assertSeedAllowed('launch');
  await removeEarlierProof(db);
  await seedSettings(db);
  await seedProcessAndPricing(db);
  await seedHomepage(db);
  const page = await seedLandingPage(db);
  return { landingPageSlug: page.slug };
}
