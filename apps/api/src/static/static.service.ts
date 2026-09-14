import {
  SETTING_KEYS,
  STATIC_PRICING_FAQ_GROUP,
  STATIC_PROCESS_FAQ_GROUP,
  STATIC_SETTING_KEYS,
  type StaticContactView,
  type StaticFaqView,
  type StaticLegalSlug,
  type StaticLegalView,
  type StaticNotFoundView,
  type StaticPricingView,
  type StaticProcessView,
  type StaticThankYouType,
  type StaticThankYouView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  staticFaqGroupKeys,
  toStaticContactView,
  toStaticFaqView,
  toStaticLegalView,
  toStaticNotFoundView,
  toStaticPricingView,
  toStaticProcessView,
  toStaticThankYouView,
} from './static.mapper';

/** How long a built view is reused; a changed setting or record is live within it. */
export const STATIC_PAGE_TTL_MS = 30_000;

/**
 * Questions that belong to the site rather than to a service, industry, location or
 * campaign page. Those are shown on their own pages.
 */
const SITE_WIDE_FAQ = { serviceId: null, industryId: null, locationId: null, landingPageId: null };

@Injectable()
export class StaticPagesService {
  private readonly logger = new Logger(StaticPagesService.name);
  private readonly pricingCache = new ViewCache<StaticPricingView>(STATIC_PAGE_TTL_MS);
  private readonly processCache = new ViewCache<StaticProcessView>(STATIC_PAGE_TTL_MS);
  private readonly contactCache = new ViewCache<StaticContactView>(STATIC_PAGE_TTL_MS);
  private readonly faqCache = new ViewCache<StaticFaqView>(STATIC_PAGE_TTL_MS);
  private readonly thankYouCache = new ViewCache<StaticThankYouView | null>(STATIC_PAGE_TTL_MS, 10);
  private readonly legalCache = new ViewCache<StaticLegalView>(STATIC_PAGE_TTL_MS, 10);
  private readonly notFoundCache = new ViewCache<StaticNotFoundView>(STATIC_PAGE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  pricing(): Promise<StaticPricingView> {
    return this.pricingCache.get('pricing', async () => {
      const db = this.prisma.client;
      const [setting, tiers, faqs] = await Promise.all([
        this.setting(STATIC_SETTING_KEYS.pricing),
        db.pricingTier.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
        db.faq.findMany({ where: { ...SITE_WIDE_FAQ, group: STATIC_PRICING_FAQ_GROUP }, orderBy: { order: 'asc' } }),
      ]);
      return this.validated('pricing page', [STATIC_SETTING_KEYS.pricing], () =>
        toStaticPricingView({ contentSetting: setting, tiers, faqs }),
      );
    });
  }

  process(): Promise<StaticProcessView> {
    return this.processCache.get('process', async () => {
      const db = this.prisma.client;
      const [setting, steps, faqs] = await Promise.all([
        this.setting(STATIC_SETTING_KEYS.process),
        db.processStep.findMany({ orderBy: { order: 'asc' } }),
        db.faq.findMany({ where: { ...SITE_WIDE_FAQ, group: STATIC_PROCESS_FAQ_GROUP }, orderBy: { order: 'asc' } }),
      ]);
      return this.validated('process page', [STATIC_SETTING_KEYS.process], () =>
        toStaticProcessView({ contentSetting: setting, steps, faqs }),
      );
    });
  }

  contact(): Promise<StaticContactView> {
    return this.contactCache.get('contact', async () => {
      const db = this.prisma.client;
      const [setting, contactSetting, locations, enquiryTypes] = await Promise.all([
        this.setting(STATIC_SETTING_KEYS.contact),
        this.setting(SETTING_KEYS.contact),
        db.location.findMany({
          where: { status: 'PUBLISHED', address: { not: null } },
          orderBy: [{ tier: 'asc' }, { city: 'asc' }],
          select: { city: true, address: true },
          take: 6,
        }),
        db.enquiryType.findMany({ orderBy: { order: 'asc' }, select: { slug: true, name: true } }),
      ]);
      return this.validated('contact page', [STATIC_SETTING_KEYS.contact, SETTING_KEYS.contact], () =>
        toStaticContactView({ contentSetting: setting, contactSetting, locations, enquiryTypes }),
      );
    });
  }

  faq(): Promise<StaticFaqView> {
    return this.faqCache.get('faq', async () => {
      const setting = await this.setting(STATIC_SETTING_KEYS.faq);
      const faqs = await this.prisma.client.faq.findMany({
        where: { ...SITE_WIDE_FAQ, group: { in: staticFaqGroupKeys(setting) } },
        orderBy: { order: 'asc' },
      });
      return this.validated('FAQ page', [STATIC_SETTING_KEYS.faq], () => toStaticFaqView({ contentSetting: setting, faqs }));
    });
  }

  /** Null when the copy has no page for the type. */
  thankYou(type: StaticThankYouType): Promise<StaticThankYouView | null> {
    return this.thankYouCache.get(type, async () => {
      const [setting, contactSetting] = await Promise.all([
        this.setting(STATIC_SETTING_KEYS.thankYou),
        this.setting(SETTING_KEYS.contact),
      ]);
      return this.validated(`thank-you page "${type}"`, [STATIC_SETTING_KEYS.thankYou, SETTING_KEYS.contact], () =>
        toStaticThankYouView({ type, contentSetting: setting, contactSetting }),
      );
    });
  }

  legal(slug: StaticLegalSlug): Promise<StaticLegalView> {
    const key = STATIC_SETTING_KEYS.legal[slug];
    return this.legalCache.get(slug, async () => {
      const [setting, contactSetting] = await Promise.all([this.setting(key), this.setting(SETTING_KEYS.contact)]);
      return this.validated(`legal page "${slug}"`, [key, SETTING_KEYS.contact], () =>
        toStaticLegalView({ slug, contentSetting: setting, contactSetting }),
      );
    });
  }

  notFound(): Promise<StaticNotFoundView> {
    return this.notFoundCache.get('not-found', async () => {
      const [setting, contactSetting] = await Promise.all([
        this.setting(STATIC_SETTING_KEYS.notFound),
        this.setting(SETTING_KEYS.contact),
      ]);
      return this.validated('not-found page', [STATIC_SETTING_KEYS.notFound, SETTING_KEYS.contact], () =>
        toStaticNotFoundView({ contentSetting: setting, contactSetting }),
      );
    });
  }

  private async setting(key: string): Promise<unknown> {
    const row = await this.prisma.client.setting.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  }

  /** Runs a mapper; a contract failure is logged with the settings to check and answers 500. */
  private validated<T>(page: string, keys: readonly string[], build: () => T): T {
    try {
      return build();
    } catch (error) {
      this.logger.error(
        `The ${page} failed contract validation. Check the ${keys.map((key) => `"${key}"`).join(' and ')} settings.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
