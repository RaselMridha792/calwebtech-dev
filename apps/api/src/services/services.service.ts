import { SERVICES_SETTING_KEYS, type ServiceDetailView, type ServicesIndexView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import { serviceCardSelect, serviceDetailInclude, toServiceDetailView, toServicesIndexView } from './services.mapper';

/**
 * How long a built services view is reused. Every render asks for it, so this bounds
 * database load; a published, edited or unpublished service is live within it, with no deploy.
 */
export const SERVICES_VIEW_TTL_MS = 30_000;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private readonly indexCache = new ViewCache<ServicesIndexView>(SERVICES_VIEW_TTL_MS);
  private readonly detailCache = new ViewCache<ServiceDetailView | null>(SERVICES_VIEW_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  findIndex(): Promise<ServicesIndexView> {
    return this.indexCache.get('index', () => this.buildIndex());
  }

  /** A published service (or a scheduled one whose time has passed), or null. */
  findBySlug(slug: string): Promise<ServiceDetailView | null> {
    return this.detailCache.get(slug, () => this.buildDetail(slug));
  }

  private published() {
    return { ...publishedAsOf(new Date()), deletedAt: null };
  }

  private async buildIndex(): Promise<ServicesIndexView> {
    const db = this.prisma.client;
    const [setting, categories, services] = await Promise.all([
      db.setting.findUnique({ where: { key: SERVICES_SETTING_KEYS.index }, select: { value: true } }),
      db.serviceCategory.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: { id: true, slug: true, name: true, description: true },
      }),
      db.service.findMany({
        where: this.published(),
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: serviceCardSelect,
      }),
    ]);

    try {
      return toServicesIndexView({ contentSetting: setting?.value ?? null, categories, services });
    } catch (error) {
      this.logger.error(
        `The services index failed contract validation. Check the "${SERVICES_SETTING_KEYS.index}" setting and the published services.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }

  private async buildDetail(slug: string): Promise<ServiceDetailView | null> {
    const db = this.prisma.client;
    const service = await db.service.findFirst({
      where: { slug, ...this.published() },
      include: serviceDetailInclude,
    });
    if (!service) return null;

    const others = await db.service.findMany({
      where: { ...this.published(), id: { not: service.id } },
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      select: serviceCardSelect,
      take: 50,
    });

    try {
      return toServiceDetailView({ service, others });
    } catch (error) {
      this.logger.error(`Service "${slug}" (${service.id}) failed contract validation. Check its content, deliverables, process steps and SEO fields.`, error);
      throw new InternalServerErrorException();
    }
  }
}
