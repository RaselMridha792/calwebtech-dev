import { LOCATIONS_SETTING_KEYS, SETTING_KEYS, type LocationDetailView, type LocationsIndexView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  locationDetailInclude,
  locationProjectInclude,
  locationReferences,
  toLocationDetailView,
  toLocationsIndexView,
} from './locations.mapper';

/** How long a built view is reused; a changed location, FAQ or setting is live within it. */
export const LOCATIONS_TTL_MS = 30_000;

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly indexCache = new ViewCache<LocationsIndexView>(LOCATIONS_TTL_MS);
  private readonly detailCache = new ViewCache<LocationDetailView | null>(LOCATIONS_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  findIndex(): Promise<LocationsIndexView> {
    return this.indexCache.get('index', () => this.buildIndex());
  }

  /** A published location's page, or null when there is none with this slug. */
  findPublished(slug: string): Promise<LocationDetailView | null> {
    return this.detailCache.get(slug, () => this.buildDetail(slug));
  }

  private async buildIndex(): Promise<LocationsIndexView> {
    const db = this.prisma.client;
    const [setting, locations] = await Promise.all([
      db.setting.findUnique({ where: { key: LOCATIONS_SETTING_KEYS.index } }),
      db.location.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ tier: 'asc' }, { city: 'asc' }] }),
    ]);
    try {
      return toLocationsIndexView({ contentSetting: setting?.value ?? null, locations });
    } catch (error) {
      this.logger.error(
        `The locations index failed contract validation. Check the "${LOCATIONS_SETTING_KEYS.index}" setting.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }

  private async buildDetail(slug: string): Promise<LocationDetailView | null> {
    const db = this.prisma.client;
    const location = await db.location.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: locationDetailInclude,
    });
    if (!location) return null;

    try {
      const references = locationReferences(location);
      const [contact, services, projects, nearby] = await Promise.all([
        db.setting.findUnique({ where: { key: SETTING_KEYS.contact } }),
        references.serviceSlugs.length > 0
          ? db.service.findMany({
              where: { slug: { in: references.serviceSlugs }, ...publishedAsOf(new Date()), deletedAt: null },
              select: { slug: true, title: true },
            })
          : [],
        references.projectSlugs.length > 0
          ? db.project.findMany({
              where: { slug: { in: references.projectSlugs }, status: 'PUBLISHED', deletedAt: null },
              include: locationProjectInclude,
            })
          : [],
        references.nearbyIds.length > 0
          ? db.location.findMany({
              where: { id: { in: references.nearbyIds }, status: 'PUBLISHED' },
              select: { id: true, slug: true, city: true, state: true, serviceArea: true },
            })
          : [],
      ]);
      return toLocationDetailView({ location, contactSetting: contact?.value ?? null, services, projects, nearby });
    } catch (error) {
      this.logger.error(
        `Location "${slug}" failed contract validation. Check its content, local context and FAQs, and the "${SETTING_KEYS.contact}" setting.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
