import { SETTING_KEYS, type SiteChromeView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { homeProjectInclude } from '../home/home-page.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { toSiteChromeView } from './site-chrome.mapper';

/**
 * How long a built chrome is reused. Every site page render asks for it, so this bounds
 * database load; a changed menu, contact detail or `site.indexing` is live within it.
 */
export const SITE_CHROME_TTL_MS = 30_000;

const SETTING_ROWS = [SETTING_KEYS.homeContent, SETTING_KEYS.contact, SETTING_KEYS.proof, SETTING_KEYS.siteIndexing];

@Injectable()
export class SiteChromeService {
  private readonly logger = new Logger(SiteChromeService.name);
  private readonly cache = new ViewCache<SiteChromeView>(SITE_CHROME_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  find(): Promise<SiteChromeView> {
    return this.cache.get('chrome', () => this.build());
  }

  private async build(): Promise<SiteChromeView> {
    const db = this.prisma.client;
    const publishedService = { ...publishedAsOf(new Date()), deletedAt: null };

    const [settings, reviewSources, categories, services, industries, projects, locations] = await Promise.all([
      db.setting.findMany({ where: { key: { in: SETTING_ROWS } } }),
      db.reviewSource.findMany(),
      db.serviceCategory.findMany({
        orderBy: { order: 'asc' },
        select: {
          name: true,
          services: { where: publishedService, orderBy: { order: 'asc' }, select: { slug: true, title: true } },
        },
      }),
      db.service.findMany({ where: publishedService, orderBy: { order: 'asc' }, select: { slug: true, title: true } }),
      db.industry.findMany({ where: { status: 'PUBLISHED' }, orderBy: { order: 'asc' }, select: { slug: true, name: true } }),
      // More than are shown, so projects without outcome figures can be skipped.
      db.project.findMany({
        where: { status: 'PUBLISHED', deletedAt: null, featured: true },
        include: homeProjectInclude,
        orderBy: [{ year: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: 12,
      }),
      db.location.findMany({
        where: { status: 'PUBLISHED', address: { not: null } },
        orderBy: [{ tier: 'asc' }, { city: 'asc' }],
        select: { city: true, address: true },
        take: 2,
      }),
    ]);
    const setting = (key: string) => settings.find((row) => row.key === key)?.value ?? null;

    try {
      return toSiteChromeView({
        contentSetting: setting(SETTING_KEYS.homeContent),
        contactSetting: setting(SETTING_KEYS.contact),
        proofSetting: setting(SETTING_KEYS.proof),
        indexingSetting: setting(SETTING_KEYS.siteIndexing),
        reviewSources,
        categories,
        services,
        industries,
        projects,
        locations,
      });
    } catch (error) {
      this.logger.error(
        `The site chrome failed contract validation. Check the "${SETTING_KEYS.homeContent}" and "${SETTING_KEYS.contact}" settings.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
