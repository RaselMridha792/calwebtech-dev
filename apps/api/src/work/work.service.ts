import {
  WORK_COPY_SETTING_KEY,
  type WorkBeforeAndAfterView,
  type WorkCaseStudyView,
  type WorkIndexView,
} from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkContractError,
  caseStudyReadiness,
  toBeforeAndAfterView,
  toCaseStudyView,
  toWorkIndexView,
  WORK_COMPARISON_QUERY,
  workProjectInclude,
  workVideoTestimonialQuery,
} from './work.mapper';

/**
 * How long a built view is reused. Site pages render per request, so this bounds database
 * load; a published project or a changed `work.copy` setting is live within it.
 */
export const WORK_TTL_MS = 30_000;

/** Upper bound on projects read for one view, so a large archive cannot make a page slow. */
const PROJECT_LIMIT = 500;

const PUBLISHED_PROJECT = { status: 'PUBLISHED' as const, deletedAt: null };
const PROJECT_ORDER = [
  { featured: 'desc' as const },
  { year: { sort: 'desc' as const, nulls: 'last' as const } },
  { updatedAt: 'desc' as const },
];

@Injectable()
export class WorkService {
  private readonly logger = new Logger(WorkService.name);
  private readonly indexCache = new ViewCache<WorkIndexView>(WORK_TTL_MS);
  private readonly caseStudyCache = new ViewCache<WorkCaseStudyView | null>(WORK_TTL_MS);
  private readonly beforeAndAfterCache = new ViewCache<WorkBeforeAndAfterView>(WORK_TTL_MS, 1);

  constructor(private readonly prisma: PrismaService) {}

  findIndex(): Promise<WorkIndexView> {
    return this.indexCache.get('index', () => this.buildIndex());
  }

  /** A published case study, or null when there is none with this slug or it is not complete. */
  findCaseStudy(slug: string): Promise<WorkCaseStudyView | null> {
    return this.caseStudyCache.get(slug, () => this.buildCaseStudy(slug));
  }

  findBeforeAndAfter(): Promise<WorkBeforeAndAfterView> {
    return this.beforeAndAfterCache.get('before-and-after', () => this.buildBeforeAndAfter());
  }

  private copySetting() {
    return this.prisma.client.setting.findUnique({ where: { key: WORK_COPY_SETTING_KEY } });
  }

  private async buildIndex(): Promise<WorkIndexView> {
    const db = this.prisma.client;
    const [copy, projects, statistics, reviewSources] = await Promise.all([
      this.copySetting(),
      db.project.findMany({
        where: PUBLISHED_PROJECT,
        include: workProjectInclude(new Date()),
        orderBy: PROJECT_ORDER,
        take: PROJECT_LIMIT,
      }),
      db.statistic.findMany({ orderBy: { order: 'asc' }, take: 4 }),
      db.reviewSource.findMany(),
    ]);

    for (const project of projects) {
      const readiness = caseStudyReadiness(project);
      if (!readiness.ready) {
        this.logger.warn(`Project "${project.slug}" is published but left off /work/: it ${readiness.reason}.`);
      }
    }
    return this.mapped(() => toWorkIndexView({ copySetting: copy?.value ?? null, projects, statistics, reviewSources }));
  }

  private async buildCaseStudy(slug: string): Promise<WorkCaseStudyView | null> {
    const db = this.prisma.client;
    const include = workProjectInclude(new Date());
    const project = await db.project.findFirst({ where: { ...PUBLISHED_PROJECT, slug }, include });
    if (!project) return null;

    const readiness = caseStudyReadiness(project);
    if (!readiness.ready) {
      this.logger.warn(`Project "${slug}" is published but has no case study page: it ${readiness.reason}.`);
      return null;
    }

    const [copy, others, videoTestimonial] = await Promise.all([
      this.copySetting(),
      db.project.findMany({
        where: { ...PUBLISHED_PROJECT, slug: { not: slug } },
        include,
        orderBy: PROJECT_ORDER,
        take: 60,
      }),
      db.testimonial.findFirst(workVideoTestimonialQuery(project.id)),
    ]);
    return this.mapped(() => toCaseStudyView({ copySetting: copy?.value ?? null, project, others, videoTestimonial }));
  }

  private async buildBeforeAndAfter(): Promise<WorkBeforeAndAfterView> {
    const [copy, comparisons] = await Promise.all([
      this.copySetting(),
      this.prisma.client.comparison.findMany({ ...WORK_COMPARISON_QUERY, take: PROJECT_LIMIT }),
    ]);
    return this.mapped(() => toBeforeAndAfterView({ copySetting: copy?.value ?? null, comparisons }));
  }

  /** Runs a mapper; a record or setting that breaks the contract is logged by name and answers 500. */
  private mapped<T>(build: () => T): T {
    try {
      return build();
    } catch (error) {
      const record = error instanceof WorkContractError ? error.record : 'A work view';
      this.logger.error(`${record} failed contract validation.`, error instanceof WorkContractError ? error.cause : error);
      throw new InternalServerErrorException();
    }
  }
}
