import type { Comparison, PrismaClient } from '@calwebtech/db';
import {
  COMPARISON_ERRORS,
  type AdminComparisonDetail,
  type AdminComparisonList,
  type ComparisonInput,
} from '@calwebtech/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { writeAudit } from '../../auth/audit-writer';
import { changedSections } from '../../common/changed-fields';
import { PrismaService } from '../../prisma/prisma.service';
import { WORK_COMPARISON_QUERY } from '../../work/work.mapper';
import type { Actor } from '../leads/admin-leads.service';

/**
 * `/before-and-after/` in the dashboard (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70).
 *
 * The rules of the other content editors: a new comparison is a draft, publishing is its own
 * step, nothing is hard-deleted, and every change is written with its audit entry in one
 * transaction. The input schema holds every bound the page holds, so a comparison saved here
 * is one the page can render. The homepage shows the first published comparison marked for
 * it; the list says which one that is.
 */

const LIST_ORDER = WORK_COMPARISON_QUERY.orderBy;

type Db = Pick<PrismaClient, 'comparison'>;

/** The comparison the homepage shows now: the first published one marked for it. */
async function homepageId(db: Db): Promise<string | null> {
  const row = await db.comparison.findFirst({
    where: { ...WORK_COMPARISON_QUERY.where, onHomepage: true },
    orderBy: LIST_ORDER,
    select: { id: true },
  });
  return row?.id ?? null;
}

/** The record in the editor's shape. */
function toRecord(row: Comparison): Record<string, unknown> {
  return {
    clientName: row.clientName,
    heading: row.heading,
    summary: row.summary,
    before: row.before,
    after: row.after,
    metrics: row.metrics,
    projectId: row.projectId,
    order: row.order,
    onHomepage: row.onHomepage,
  };
}

function toColumns(input: ComparisonInput) {
  return {
    clientName: input.clientName,
    heading: input.heading,
    summary: input.summary,
    before: input.before,
    after: input.after,
    metrics: input.metrics,
    projectId: input.projectId,
    order: input.order,
    onHomepage: input.onHomepage,
  };
}

@Injectable()
export class AdminComparisonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminComparisonList> {
    const db = this.prisma.client;
    const [rows, shown, caseStudies] = await Promise.all([
      db.comparison.findMany({
        where: { deletedAt: null },
        orderBy: LIST_ORDER,
        include: { project: { select: { id: true, clientName: true, slug: true } } },
      }),
      homepageId(db),
      db.project.findMany({
        where: { deletedAt: null },
        orderBy: [{ clientName: 'asc' }],
        select: { id: true, clientName: true, slug: true, status: true },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        clientName: row.clientName,
        heading: row.heading,
        status: row.status,
        order: row.order,
        onHomepage: row.onHomepage,
        shownOnHomepage: row.id === shown,
        caseStudy: row.project,
        updatedAt: row.updatedAt.toISOString(),
      })),
      caseStudies,
    };
  }

  async detail(id: string): Promise<AdminComparisonDetail | null> {
    const row = await this.find(id);
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      shownOnHomepage: (await homepageId(this.prisma.client)) === row.id,
      record: toRecord(row),
    };
  }

  /** A new comparison starts as a draft. */
  async create(input: ComparisonInput, actor: Actor): Promise<AdminComparisonDetail> {
    await this.assertLink(input.projectId);
    const row = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.comparison.create({ data: { ...toColumns(input), status: 'DRAFT' } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'comparison.created',
        entityType: 'Comparison',
        entityId: created.id,
        after: toRecord(created),
        ip: actor.ip,
      });
      return created;
    });
    return this.requireDetail(row.id);
  }

  /** Saves the words, pictures and figures. The log records the fields that changed. */
  async update(id: string, input: ComparisonInput, actor: Actor): Promise<AdminComparisonDetail> {
    const before = await this.require(id);
    await this.assertLink(input.projectId);
    await this.prisma.client.$transaction(async (tx) => {
      const after = await tx.comparison.update({ where: { id }, data: toColumns(input) });
      const previous = toRecord(before);
      const next = toRecord(after);
      const fields = changedSections(previous, next);
      await writeAudit(tx, {
        userId: actor.id,
        action: 'comparison.updated',
        entityType: 'Comparison',
        entityId: id,
        before: Object.fromEntries(fields.map((field) => [field, previous[field]])),
        after: { fields, ...Object.fromEntries(fields.map((field) => [field, next[field]])) },
        ip: actor.ip,
      });
    });
    return this.requireDetail(id);
  }

  publish(id: string, actor: Actor): Promise<AdminComparisonDetail> {
    return this.setStatus(id, 'PUBLISHED', 'comparison.published', actor);
  }

  unpublish(id: string, actor: Actor): Promise<AdminComparisonDetail> {
    return this.setStatus(id, 'DRAFT', 'comparison.unpublished', actor);
  }

  /** Kept, with everything it said, and shown nowhere. */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const before = await this.require(id);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.comparison.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'comparison.deleted',
        entityType: 'Comparison',
        entityId: id,
        before: { ...toRecord(before), status: before.status },
        ip: actor.ip,
      });
    });
    return { deleted: true };
  }

  private async setStatus(
    id: string,
    status: 'PUBLISHED' | 'DRAFT',
    action: string,
    actor: Actor,
  ): Promise<AdminComparisonDetail> {
    const before = await this.require(id);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.comparison.update({ where: { id }, data: { status } });
      await writeAudit(tx, {
        userId: actor.id,
        action,
        entityType: 'Comparison',
        entityId: id,
        before: { status: before.status },
        after: { status },
        ip: actor.ip,
      });
    });
    return this.requireDetail(id);
  }

  /** A case study somebody chose is refused when it is gone, rather than silently dropped. */
  private async assertLink(projectId: string | null): Promise<void> {
    if (!projectId) return;
    const project = await this.prisma.client.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
    if (!project) {
      throw new ConflictException({
        error: COMPARISON_ERRORS.unknownLink,
        message: 'That case study no longer exists. Reload the page and choose again.',
      });
    }
  }

  private find(id: string): Promise<Comparison | null> {
    return this.prisma.client.comparison.findFirst({ where: { id, deletedAt: null } });
  }

  private async require(id: string): Promise<Comparison> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireDetail(id: string): Promise<AdminComparisonDetail> {
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }
}
