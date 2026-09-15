import {
  INSIGHTS_COPY_SETTING_KEY,
  articleLinkedSlugs,
  type InsightsArticleView,
  type InsightsIndexView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { publishedAsOf } from '../common/published';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsightsContractError,
  articleReadiness,
  coverImageUrls,
  insightsPostInclude,
  insightsProjectInclude,
  insightsServiceSelect,
  toInsightsArticleView,
  toInsightsIndexView,
  type InsightsPostRecord,
} from './insights.mapper';

/**
 * How long a built view is reused. Site pages render per request, so this bounds database
 * load; a published article or changed `insights.copy` setting is live within it.
 */
export const INSIGHTS_TTL_MS = 30_000;

/** Upper bound on articles read for one view, so a long archive cannot make a page slow. */
const POST_LIMIT = 500;

/** Other articles read for the related strip on an article page. */
const RELATED_POOL = 60;

const POST_ORDER = [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly indexCache = new ViewCache<InsightsIndexView>(INSIGHTS_TTL_MS, 1);
  // One entry per slug, including the nulls a 404 leaves behind, so the default cap matters.
  private readonly articleCache = new ViewCache<InsightsArticleView | null>(INSIGHTS_TTL_MS, 500);

  constructor(private readonly prisma: PrismaService) {}

  findIndex(): Promise<InsightsIndexView> {
    return this.indexCache.get('index', () => this.buildIndex());
  }

  /** A published article, or null when there is none with this slug or it has no page. */
  findArticle(slug: string): Promise<InsightsArticleView | null> {
    return this.articleCache.get(slug, () => this.buildArticle(slug));
  }

  private copySetting() {
    return this.prisma.client.setting.findUnique({ where: { key: INSIGHTS_COPY_SETTING_KEY } });
  }

  private mediaFor(posts: readonly InsightsPostRecord[]) {
    const urls = coverImageUrls(posts);
    if (urls.length === 0) return Promise.resolve([]);
    return this.prisma.client.mediaAsset.findMany({
      where: { url: { in: urls }, deletedAt: null },
      select: { url: true, altText: true },
    });
  }

  private async buildIndex(): Promise<InsightsIndexView> {
    const db = this.prisma.client;
    const [copy, categories, posts] = await Promise.all([
      this.copySetting(),
      db.postCategory.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { slug: true, name: true } }),
      db.post.findMany({
        where: publishedAsOf(new Date()),
        include: insightsPostInclude,
        orderBy: POST_ORDER,
        take: POST_LIMIT,
      }),
    ]);
    const media = await this.mediaFor(posts);

    return this.mapped(() =>
      toInsightsIndexView({
        copySetting: copy?.value ?? null,
        categories,
        posts,
        media,
        onSkipped: (slug, reason) => {
          this.logger.warn(`Post "${slug}" is published but left off /insights/: it ${reason}.`);
        },
      }),
    );
  }

  private async buildArticle(slug: string): Promise<InsightsArticleView | null> {
    const db = this.prisma.client;
    const now = new Date();
    const post = await db.post.findFirst({ where: { slug, ...publishedAsOf(now) }, include: insightsPostInclude });
    if (!post) return null;

    // A topic page owns `/insights/<slug>/`, so an article with that slug has no page.
    const topic = await db.postCategory.findUnique({ where: { slug }, select: { slug: true } });
    if (topic) {
      this.logger.warn(`Post "${slug}" has the same slug as a topic page, which owns that URL.`);
      return null;
    }

    const readiness = articleReadiness(post);
    if (!readiness.ready) {
      this.logger.warn(`Post "${slug}" is published but has no article page: it ${readiness.reason}.`);
      return null;
    }

    const serviceSlugs = articleLinkedSlugs(readiness.body, '/services/');
    const caseStudySlug = articleLinkedSlugs(readiness.body, '/work/')[0];
    const [copy, services, project, others] = await Promise.all([
      this.copySetting(),
      serviceSlugs.length > 0
        ? db.service.findMany({
            where: { slug: { in: serviceSlugs }, deletedAt: null, ...publishedAsOf(now) },
            select: insightsServiceSelect,
          })
        : [],
      caseStudySlug === undefined
        ? null
        : db.project.findFirst({
            where: { slug: caseStudySlug, status: 'PUBLISHED', deletedAt: null },
            include: insightsProjectInclude,
          }),
      db.post.findMany({
        where: { ...publishedAsOf(now), slug: { not: slug } },
        include: insightsPostInclude,
        orderBy: POST_ORDER,
        take: RELATED_POOL,
      }),
    ]);
    const media = await this.mediaFor([post, ...others]);

    return this.mapped(() =>
      toInsightsArticleView({ copySetting: copy?.value ?? null, post, readiness, services, project, others, media }),
    );
  }

  /** Runs a mapper; a record or setting that breaks the contract is logged by name and answers 500. */
  private mapped<T>(build: () => T): T {
    try {
      return build();
    } catch (error) {
      const record = error instanceof InsightsContractError ? error.record : 'An insights view';
      this.logger.error(
        `${record} failed contract validation.`,
        error instanceof InsightsContractError ? error.cause : error,
      );
      throw new InternalServerErrorException();
    }
  }
}
