import { INDUSTRY_SETTING_KEYS, type IndustriesIndexView, type IndustryDetailView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  industryCardSelect,
  industryDetailInclude,
  toIndustriesIndexView,
  toIndustryDetailView,
} from './industries.mapper';

/**
 * How long a built industry view is reused. Site pages render per request, so this bounds
 * database load; a published or edited industry is live within it, without a redeploy.
 */
export const INDUSTRIES_TTL_MS = 30_000;

@Injectable()
export class IndustriesService {
  private readonly logger = new Logger(IndustriesService.name);
  private readonly indexCache = new ViewCache<IndustriesIndexView>(INDUSTRIES_TTL_MS);
  private readonly detailCache = new ViewCache<IndustryDetailView | null>(INDUSTRIES_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  /** `/industries/`: its copy and every published industry, in order. */
  findIndex(): Promise<IndustriesIndexView> {
    return this.indexCache.get('index', () => this.buildIndex());
  }

  /** One published industry's page, or null when there is none with that slug. */
  findPublished(slug: string): Promise<IndustryDetailView | null> {
    return this.detailCache.get(slug, () => this.buildDetail(slug));
  }

  private async buildIndex(): Promise<IndustriesIndexView> {
    const db = this.prisma.client;
    const [setting, industries] = await Promise.all([
      db.setting.findUnique({ where: { key: INDUSTRY_SETTING_KEYS.index } }),
      db.industry.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: industryCardSelect,
      }),
    ]);

    try {
      return toIndustriesIndexView({ contentSetting: setting?.value ?? null, industries });
    } catch (error) {
      this.logger.error(
        `The industries index failed contract validation. Check the "${INDUSTRY_SETTING_KEYS.index}" setting and each published industry's heroCopy.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }

  private async buildDetail(slug: string): Promise<IndustryDetailView | null> {
    const industry = await this.prisma.client.industry.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: industryDetailInclude(new Date()),
    });
    if (!industry) return null;

    try {
      return toIndustryDetailView(industry);
    } catch (error) {
      this.logger.error(
        `Industry "${slug}" failed contract validation. Check its content, seo, answer block, FAQs and published projects.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
