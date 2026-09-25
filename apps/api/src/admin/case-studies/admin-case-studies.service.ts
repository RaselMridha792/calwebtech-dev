import {
  CASE_STUDY_ERRORS,
  caseStudyPath,
  seoSchema,
  workProjectContentSchema,
  type AdminCaseStudyDetail,
  type AdminCaseStudyList,
  type CaseStudyInput,
} from '@calwebtech/shared';
import { Prisma } from '@calwebtech/db';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { caseStudyReadiness } from '../../work/work.mapper';
import type { Actor } from '../leads/admin-leads.service';

/**
 * Editing case studies (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * The services editor's rules, and one of the work family's: a slug is unique, a published
 * address that moves or is removed leaves a 301, nothing is hard-deleted, every change is
 * audited, and a case study is published only when its page can render — three outcome
 * figures and an answer block (`caseStudyReadiness`), checked here and not in the screen.
 */

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR?.trim() ?? path.resolve(process.cwd(), 'static-content');

const INDEX_PATH = '/work/';

const RECORD_INCLUDE = {
  services: { select: { slug: true } },
  technologies: { select: { slug: true } },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof RECORD_INCLUDE }>;

@Injectable()
export class AdminCaseStudiesService {
  private snapshotSlugs: Set<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminCaseStudyList> {
    const db = this.prisma.client;
    const [rows, industries, services, platforms, snapshots] = await Promise.all([
      db.project.findMany({
        where: { deletedAt: null },
        orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          clientName: true,
          slug: true,
          status: true,
          featured: true,
          updatedAt: true,
          outcomeMetrics: true,
          answerBlock: true,
        },
      }),
      db.industry.findMany({
        where: { deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      db.service.findMany({
        where: { deletedAt: null },
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: { slug: true, title: true },
      }),
      db.technology.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { slug: true, name: true } }),
      this.snapshots(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        clientName: row.clientName,
        slug: row.slug,
        status: row.status,
        featured: row.featured,
        updatedAt: row.updatedAt.toISOString(),
        notReady: notReady(row),
        shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
      })),
      options: { industries, services, platforms },
    };
  }

  async detail(id: string): Promise<AdminCaseStudyDetail | null> {
    const row = await this.find(id);
    return row ? toDetail(row, await this.snapshots()) : null;
  }

  /** A new case study starts as a draft. */
  async create(input: CaseStudyInput, actor: Actor): Promise<AdminCaseStudyDetail> {
    await this.assertSlugFree(input.slug, null);
    const links = await this.links(input);
    const row = await this.prisma.client.project.create({
      data: {
        ...toData(input),
        status: 'DRAFT',
        services: { connect: links.services },
        technologies: { connect: links.platforms },
      },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'case_study.created',
      entityType: 'Project',
      entityId: row.id,
      after: { title: row.title, slug: row.slug },
      ip: actor.ip,
    });
    return this.requireDetail(row.id);
  }

  /** Saves the record and its links. A published slug that moves leaves a 301 behind. */
  async update(id: string, input: CaseStudyInput, actor: Actor): Promise<AdminCaseStudyDetail> {
    const before = await this.require(id);
    await this.assertSlugFree(input.slug, id);
    const links = await this.links(input);
    const slugMoved = input.slug !== before.slug;
    const wasLive = before.status === 'PUBLISHED';

    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.project.update({
        where: { id },
        data: { ...toData(input), services: { set: links.services }, technologies: { set: links.platforms } },
      }),
    ];
    if (slugMoved && wasLive) {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: caseStudyPath(before.slug),
            toPath: caseStudyPath(input.slug),
            statusCode: 301,
            reason: `Case study slug changed from ${before.slug} to ${input.slug}`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);
    await this.audit.record({
      userId: actor.id,
      action: 'case_study.updated',
      entityType: 'Project',
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: input.title, slug: input.slug, redirectCreated: slugMoved && wasLive },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /** Refused, with the reason, while the page could not render. */
  async publish(id: string, actor: Actor): Promise<AdminCaseStudyDetail> {
    const before = await this.require(id);
    const reason = notReady(before);
    if (reason) {
      throw new ConflictException({ error: CASE_STUDY_ERRORS.notReady, message: `This case study ${reason}.` });
    }
    return this.setStatus(before, 'PUBLISHED', 'case_study.published', actor);
  }

  async unpublish(id: string, actor: Actor): Promise<AdminCaseStudyDetail> {
    return this.setStatus(await this.require(id), 'DRAFT', 'case_study.unpublished', actor);
  }

  /** Soft delete, and a redirect to /work/ if it was live. */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const before = await this.require(id);
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.project.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } }),
    ];
    if (before.status === 'PUBLISHED') {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: caseStudyPath(before.slug),
            toPath: INDEX_PATH,
            statusCode: 301,
            reason: `Case study ${before.slug} was removed`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);
    await this.audit.record({
      userId: actor.id,
      action: 'case_study.deleted',
      entityType: 'Project',
      entityId: id,
      before: { title: before.title, slug: before.slug, status: before.status },
      ip: actor.ip,
    });
    return { deleted: true };
  }

  private async setStatus(
    before: ProjectRecord,
    status: 'PUBLISHED' | 'DRAFT',
    action: string,
    actor: Actor,
  ): Promise<AdminCaseStudyDetail> {
    await this.prisma.client.project.update({ where: { id: before.id }, data: { status } });
    await this.audit.record({
      userId: actor.id,
      action,
      entityType: 'Project',
      entityId: before.id,
      before: { status: before.status },
      after: { status },
      ip: actor.ip,
    });
    return this.requireDetail(before.id);
  }

  /**
   * The rows the input links to, by slug. An unknown slug is refused rather than dropped, so
   * a link somebody chose never silently disappears.
   */
  private async links(input: CaseStudyInput): Promise<{ services: { id: string }[]; platforms: { id: string }[] }> {
    const db = this.prisma.client;
    const [services, platforms, industry] = await Promise.all([
      db.service.findMany({ where: { slug: { in: input.services }, deletedAt: null }, select: { id: true, slug: true } }),
      db.technology.findMany({ where: { slug: { in: input.platforms } }, select: { id: true, slug: true } }),
      input.industryId ? db.industry.findFirst({ where: { id: input.industryId, deletedAt: null }, select: { id: true } }) : null,
    ]);
    const missing = [
      ...input.services.filter((slug) => !services.some((row) => row.slug === slug)).map((slug) => `service ${slug}`),
      ...input.platforms.filter((slug) => !platforms.some((row) => row.slug === slug)).map((slug) => `platform ${slug}`),
      ...(input.industryId && !industry ? ['the industry'] : []),
    ];
    if (missing.length > 0) {
      throw new ConflictException({
        error: CASE_STUDY_ERRORS.unknownLink,
        message: `There is no ${missing.join(', ')} to link to. Reload the page and choose again.`,
      });
    }
    return {
      services: services.map((row) => ({ id: row.id })),
      platforms: platforms.map((row) => ({ id: row.id })),
    };
  }

  /** Unique across every project, removed ones included, so no page inherits another's redirect. */
  private async assertSlugFree(slug: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.client.project.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { deletedAt: true },
    });
    if (clash) {
      throw new ConflictException({
        error: CASE_STUDY_ERRORS.duplicateSlug,
        message: clash.deletedAt
          ? `A removed case study already used /work/${slug}/. Choose another address.`
          : `Another case study already uses /work/${slug}/.`,
      });
    }
  }

  private find(id: string): Promise<ProjectRecord | null> {
    return this.prisma.client.project.findFirst({ where: { id, deletedAt: null }, include: RECORD_INCLUDE });
  }

  private async require(id: string): Promise<ProjectRecord> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireDetail(id: string): Promise<AdminCaseStudyDetail> {
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  private async snapshots(): Promise<Set<string>> {
    if (this.snapshotSlugs) return this.snapshotSlugs;
    try {
      const raw = await readFile(path.join(SNAPSHOT_DIR, 'work/index.json'), 'utf8');
      const parsed = JSON.parse(raw) as { caseStudies?: { slug?: string }[] };
      this.snapshotSlugs = new Set(
        (parsed.caseStudies ?? []).map((study) => study.slug).filter((slug): slug is string => Boolean(slug)),
      );
    } catch {
      this.snapshotSlugs = new Set();
    }
    return this.snapshotSlugs;
  }
}

/** What a case study still needs before it can be published, or null. */
function notReady(project: { outcomeMetrics: Prisma.JsonValue; answerBlock: string }): string | null {
  const readiness = caseStudyReadiness(project);
  return readiness.ready ? null : readiness.reason;
}

function toData(input: CaseStudyInput) {
  return {
    title: input.title,
    slug: input.slug,
    clientName: input.clientName,
    clientAlias: input.clientAlias,
    summary: input.summary,
    answerBlock: input.answerBlock,
    outcomeMetrics: input.metrics,
    industryId: input.industryId,
    location: input.location,
    segment: input.segment,
    duration: input.duration,
    year: input.year,
    liveUrl: input.liveUrl,
    featured: input.featured,
    coverImageUrl: input.cover?.src ?? null,
    coverImageAlt: input.cover?.alt ?? null,
    gallery: input.gallery,
    challenge: input.challenge,
    approach: input.approach,
    buildNotes: input.build,
    outcome: input.outcome,
    beforeImageUrl: input.beforeAfter?.before ?? null,
    afterImageUrl: input.beforeAfter?.after ?? null,
    beforeAfterMetrics: input.beforeAfter ? input.beforeAfter.metrics : Prisma.DbNull,
    content: { order: { services: input.services } },
    seo: input.seo,
  };
}

const metricsSchema = z.array(z.object({ value: z.string(), label: z.string() }));
const pairsSchema = z.array(z.object({ label: z.string(), before: z.string(), after: z.string() }));

/** The record in the editor's shape. Stored values the input would refuse are shown, not dropped. */
function toDetail(row: ProjectRecord, snapshots: Set<string>): AdminCaseStudyDetail {
  const order = workProjectContentSchema.safeParse(row.content ?? {});
  const named = order.success ? order.data.order.services : [];
  const linked = row.services.map((service) => service.slug);
  const services = [...named.filter((slug) => linked.includes(slug)), ...linked.filter((slug) => !named.includes(slug))];
  const seo = seoSchema.safeParse(row.seo ?? {});
  // A gallery written before images carried alt text holds bare addresses. They are shown
  // with the description empty, so saving asks for it rather than dropping the picture.
  const gallery = (Array.isArray(row.gallery) ? row.gallery : []).map((entry) =>
    typeof entry === 'string' ? { src: entry, alt: '' } : entry,
  );

  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    notReady: notReady(row),
    shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
    record: {
      title: row.title,
      slug: row.slug,
      clientName: row.clientName,
      clientAlias: row.clientAlias,
      summary: row.summary,
      answerBlock: row.answerBlock,
      metrics: metricsSchema.safeParse(row.outcomeMetrics).data ?? [],
      industryId: row.industryId,
      services,
      platforms: row.technologies.map((technology) => technology.slug),
      location: row.location,
      segment: row.segment,
      duration: row.duration,
      year: row.year,
      liveUrl: row.liveUrl,
      featured: row.featured,
      cover: row.coverImageUrl ? { src: row.coverImageUrl, alt: row.coverImageAlt ?? '' } : null,
      gallery,
      challenge: row.challenge,
      approach: row.approach,
      build: row.buildNotes,
      outcome: row.outcome,
      beforeAfter:
        row.beforeImageUrl && row.afterImageUrl
          ? {
              before: row.beforeImageUrl,
              after: row.afterImageUrl,
              metrics: pairsSchema.safeParse(row.beforeAfterMetrics ?? []).data ?? [],
            }
          : null,
      seo: seo.success ? seo.data : {},
    },
  };
}
