import {
  COMPANY_ABOUT_AWARD_LIMIT,
  COMPANY_ABOUT_STATISTIC_LIMIT,
  COMPANY_ABOUT_TEAM_LIMIT,
  COMPANY_FAQ_GROUPS,
  COMPANY_SETTING_KEYS,
  SETTING_KEYS,
  type CompanyAboutView,
  type CompanyAwardsView,
  type CompanyPage,
  type CompanyPartnersView,
  type CompanyTeamView,
  type CompanyTechnologyView,
  type CompanyTestimonialsView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CONSENTED } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  companyTestimonialInclude,
  toCompanyAboutView,
  toCompanyAwardsView,
  toCompanyPartnersView,
  toCompanyTeamView,
  toCompanyTechnologyView,
  toCompanyTestimonialsView,
} from './company.mapper';

/**
 * How long a built company page is reused. Every render asks for it, so this bounds database
 * load; a changed setting or record is live within it, without a redeploy.
 */
export const COMPANY_PAGE_TTL_MS = 30_000;

const AWARD_ORDER = [{ order: 'asc' as const }, { year: 'desc' as const }];

/**
 * The company family's pages. Each page's copy is the `company.<page>` setting; without that
 * row the page is not published and resolves to null (404). Awards, partners, team members,
 * technologies, statistics and review sources have no publish state of their own, so every
 * row is public except inactive team members; testimonials need consent.
 */
@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);
  private readonly aboutCache = new ViewCache<CompanyAboutView | null>(COMPANY_PAGE_TTL_MS);
  private readonly teamCache = new ViewCache<CompanyTeamView | null>(COMPANY_PAGE_TTL_MS);
  private readonly testimonialsCache = new ViewCache<CompanyTestimonialsView | null>(COMPANY_PAGE_TTL_MS);
  private readonly awardsCache = new ViewCache<CompanyAwardsView | null>(COMPANY_PAGE_TTL_MS);
  private readonly partnersCache = new ViewCache<CompanyPartnersView | null>(COMPANY_PAGE_TTL_MS);
  private readonly technologyCache = new ViewCache<CompanyTechnologyView | null>(COMPANY_PAGE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  about(): Promise<CompanyAboutView | null> {
    return this.aboutCache.get('about', () =>
      this.build('about', async (contentSetting) => {
        const db = this.prisma.client;
        const [statistics, team, awards, partners, faqs] = await Promise.all([
          db.statistic.findMany({ orderBy: { order: 'asc' }, take: COMPANY_ABOUT_STATISTIC_LIMIT }),
          db.teamMember.findMany({ where: { active: true }, orderBy: { order: 'asc' }, take: COMPANY_ABOUT_TEAM_LIMIT }),
          db.award.findMany({ orderBy: AWARD_ORDER, take: COMPANY_ABOUT_AWARD_LIMIT }),
          db.partner.findMany({ orderBy: { order: 'asc' } }),
          this.faqs('about'),
        ]);
        return () => toCompanyAboutView({ contentSetting, statistics, team, awards, partners, faqs });
      }),
    );
  }

  team(): Promise<CompanyTeamView | null> {
    return this.teamCache.get('team', () =>
      this.build('team', async (contentSetting) => {
        const [members, faqs] = await Promise.all([
          this.prisma.client.teamMember.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
          this.faqs('team'),
        ]);
        return () => toCompanyTeamView({ contentSetting, members, faqs });
      }),
    );
  }

  testimonials(): Promise<CompanyTestimonialsView | null> {
    return this.testimonialsCache.get('testimonials', () =>
      this.build('testimonials', async (contentSetting) => {
        const db = this.prisma.client;
        const [proof, reviewSources, testimonials, faqs] = await Promise.all([
          db.setting.findUnique({ where: { key: SETTING_KEYS.proof } }),
          db.reviewSource.findMany(),
          db.testimonial.findMany({
            where: CONSENTED,
            include: companyTestimonialInclude,
            orderBy: [{ featured: 'desc' }, { date: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          }),
          this.faqs('testimonials'),
        ]);
        return () =>
          toCompanyTestimonialsView({ contentSetting, proofSetting: proof?.value ?? null, reviewSources, testimonials, faqs });
      }),
    );
  }

  awards(): Promise<CompanyAwardsView | null> {
    return this.awardsCache.get('awards', () =>
      this.build('awards', async (contentSetting) => {
        const db = this.prisma.client;
        const [awards, partners, faqs] = await Promise.all([
          db.award.findMany({ orderBy: [{ year: 'desc' }, { order: 'asc' }] }),
          db.partner.findMany({ orderBy: { order: 'asc' } }),
          this.faqs('awards'),
        ]);
        return () => toCompanyAwardsView({ contentSetting, awards, partners, faqs });
      }),
    );
  }

  partners(): Promise<CompanyPartnersView | null> {
    return this.partnersCache.get('partners', () =>
      this.build('partners', async (contentSetting) => {
        const [partners, faqs] = await Promise.all([
          this.prisma.client.partner.findMany({ orderBy: { order: 'asc' } }),
          this.faqs('partners'),
        ]);
        return () => toCompanyPartnersView({ contentSetting, partners, faqs });
      }),
    );
  }

  technology(): Promise<CompanyTechnologyView | null> {
    return this.technologyCache.get('technology', () =>
      this.build('technology', async (contentSetting) => {
        const [technologies, faqs] = await Promise.all([
          this.prisma.client.technology.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }, { name: 'asc' }] }),
          this.faqs('technology'),
        ]);
        return () => toCompanyTechnologyView({ contentSetting, technologies, faqs });
      }),
    );
  }

  private faqs(page: CompanyPage) {
    return this.prisma.client.faq.findMany({ where: { group: COMPANY_FAQ_GROUPS[page] }, orderBy: { order: 'asc' } });
  }

  /**
   * Loads the page's copy, then its records, then maps them. Null when the copy setting does
   * not exist. A contract failure is logged with the setting to check and answers 500.
   */
  private async build<View>(
    page: CompanyPage,
    load: (contentSetting: unknown) => Promise<() => View>,
  ): Promise<View | null> {
    const key = COMPANY_SETTING_KEYS[page];
    const setting = await this.prisma.client.setting.findUnique({ where: { key } });
    if (!setting) return null;
    const map = await load(setting.value);
    try {
      return map();
    } catch (error) {
      this.logger.error(
        `The ${page} page failed contract validation. Check the "${key}" setting and the records it lists.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
