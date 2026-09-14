import {
  GUIDES_GLOSSARY_SETTING_KEYS,
  type GlossaryIndexView,
  type GlossaryTermView,
  type GuideDetailView,
  type GuidesIndexView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  glossaryCardSelect,
  glossaryDetailInclude,
  guideCardSelect,
  guideDetailSelect,
  toGlossaryIndexView,
  toGlossaryTermView,
  toGuideDetailView,
  toGuidesIndexView,
} from './guides-glossary.mapper';

/** How long a built view is reused, as elsewhere in the site pages (docs/10-site-pages.md). */
export const GUIDES_GLOSSARY_VIEW_TTL_MS = 30_000;

/** Guides and glossary terms carry only `status`, so published means PUBLISHED. */
const PUBLISHED = { status: 'PUBLISHED' as const };

@Injectable()
export class GuidesGlossaryService {
  private readonly logger = new Logger(GuidesGlossaryService.name);
  private readonly guidesIndexCache = new ViewCache<GuidesIndexView>(GUIDES_GLOSSARY_VIEW_TTL_MS);
  private readonly guideCache = new ViewCache<GuideDetailView | null>(GUIDES_GLOSSARY_VIEW_TTL_MS);
  private readonly glossaryIndexCache = new ViewCache<GlossaryIndexView>(GUIDES_GLOSSARY_VIEW_TTL_MS);
  private readonly termCache = new ViewCache<GlossaryTermView | null>(GUIDES_GLOSSARY_VIEW_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  findGuidesIndex(): Promise<GuidesIndexView> {
    return this.guidesIndexCache.get('index', () => this.buildGuidesIndex());
  }

  findGuide(slug: string): Promise<GuideDetailView | null> {
    return this.guideCache.get(slug, () => this.buildGuide(slug));
  }

  findGlossaryIndex(): Promise<GlossaryIndexView> {
    return this.glossaryIndexCache.get('index', () => this.buildGlossaryIndex());
  }

  findGlossaryTerm(slug: string): Promise<GlossaryTermView | null> {
    return this.termCache.get(slug, () => this.buildGlossaryTerm(slug));
  }

  private async buildGuidesIndex(): Promise<GuidesIndexView> {
    const db = this.prisma.client;
    const [setting, guides] = await Promise.all([
      db.setting.findUnique({ where: { key: GUIDES_GLOSSARY_SETTING_KEYS.guides }, select: { value: true } }),
      db.guide.findMany({ where: PUBLISHED, orderBy: { title: 'asc' }, select: guideCardSelect }),
    ]);
    try {
      return toGuidesIndexView({ contentSetting: setting?.value ?? null, guides });
    } catch (error) {
      this.logger.error(
        `The guides index failed contract validation. Check the "${GUIDES_GLOSSARY_SETTING_KEYS.guides}" setting and the published guides.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }

  private async buildGuide(slug: string): Promise<GuideDetailView | null> {
    const db = this.prisma.client;
    const guide = await db.guide.findFirst({ where: { slug, ...PUBLISHED }, select: guideDetailSelect });
    if (!guide) return null;

    const [others, terms, services] = await Promise.all([
      db.guide.findMany({ where: { ...PUBLISHED, id: { not: guide.id } }, orderBy: { title: 'asc' }, select: guideCardSelect, take: 20 }),
      db.glossaryTerm.findMany({ where: PUBLISHED, orderBy: { term: 'asc' }, select: glossaryCardSelect, take: 200 }),
      db.service.findMany({
        where: { deletedAt: null, ...publishedAsOf(new Date()) },
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: { slug: true, title: true, shortDescription: true },
        take: 50,
      }),
    ]);

    try {
      return toGuideDetailView({ guide, others, terms, services });
    } catch (error) {
      this.logger.error(`Guide "${slug}" (${guide.id}) failed contract validation. Check its summary, file URL and SEO fields.`, error);
      throw new InternalServerErrorException();
    }
  }

  private async buildGlossaryIndex(): Promise<GlossaryIndexView> {
    const db = this.prisma.client;
    const [setting, terms] = await Promise.all([
      db.setting.findUnique({ where: { key: GUIDES_GLOSSARY_SETTING_KEYS.glossary }, select: { value: true } }),
      db.glossaryTerm.findMany({ where: PUBLISHED, orderBy: { term: 'asc' }, select: glossaryCardSelect, take: 500 }),
    ]);
    try {
      return toGlossaryIndexView({ contentSetting: setting?.value ?? null, terms });
    } catch (error) {
      this.logger.error(
        `The glossary index failed contract validation. Check the "${GUIDES_GLOSSARY_SETTING_KEYS.glossary}" setting and the published terms.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }

  private async buildGlossaryTerm(slug: string): Promise<GlossaryTermView | null> {
    const db = this.prisma.client;
    const term = await db.glossaryTerm.findFirst({ where: { slug, ...PUBLISHED }, include: glossaryDetailInclude });
    if (!term) return null;

    const others = await db.glossaryTerm.findMany({
      where: { ...PUBLISHED, id: { not: term.id }, relatedServiceId: term.relatedServiceId },
      orderBy: { term: 'asc' },
      select: glossaryCardSelect,
      take: 50,
    });

    try {
      return toGlossaryTermView({ term, others });
    } catch (error) {
      this.logger.error(`Glossary term "${slug}" (${term.id}) failed contract validation. Check its definition, body and SEO fields.`, error);
      throw new InternalServerErrorException();
    }
  }
}
