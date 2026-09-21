import {
  SERVICE_ERRORS,
  servicePath,
  slugify,
  type AdminServiceDetail,
  type AdminServiceList,
  type AdminServiceRow,
  type ContentStatus,
  type ServiceInput,
} from '@calwebtech/shared';
import type { Prisma } from '@calwebtech/db';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';

/**
 * Editing services (docs/12-admin-dashboard.md, M4).
 *
 * The rules CLAUDE.md puts on every content type live here, not in the editor: a slug is
 * unique, changing a published one leaves a permanent redirect behind, and nothing is ever
 * hard-deleted. The screen can be reloaded, bypassed or out of date; this cannot.
 */

/**
 * The committed snapshots the public site falls back to. Knowing which slugs they hold is
 * what lets the editor say "this page still comes from the snapshot until you publish",
 * rather than leaving someone guessing why their draft is not live.
 */
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR?.trim() ?? path.resolve(process.cwd(), 'static-content');

const ROW_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  order: true,
  publishedAt: true,
  updatedAt: true,
  category: { select: { slug: true, name: true } },
} as const;

@Injectable()
export class AdminServicesService {
  /** Read once: the snapshot is a build artefact and cannot change while the process runs. */
  private snapshotSlugs: Set<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminServiceList> {
    const [rows, categories, snapshots] = await Promise.all([
      this.prisma.client.service.findMany({
        where: { deletedAt: null },
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: ROW_SELECT,
      }),
      this.prisma.client.serviceCategory.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: { id: true, slug: true, name: true },
      }),
      this.snapshots(),
    ]);
    return { items: rows.map((row) => toRow(row, snapshots)), categories };
  }

  async detail(id: string): Promise<AdminServiceDetail | null> {
    const row = await this.prisma.client.service.findFirst({ where: { id, deletedAt: null } });
    if (!row) return null;
    return toDetail(row, await this.snapshots());
  }

  /**
   * A new service starts as a draft, so creating one can never put an unfinished page on
   * the site. Without a slug, one is made from the title.
   */
  async create(input: ServiceInput, actor: Actor): Promise<AdminServiceDetail> {
    const slug = input.slug || slugify(input.title);
    await this.assertSlugFree(slug, null);

    const row = await this.prisma.client.service.create({
      data: { ...this.toData(input), slug, status: 'DRAFT' },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'service.created',
      entityType: 'Service',
      entityId: row.id,
      after: { title: row.title, slug: row.slug },
      ip: actor.ip,
    });
    return toDetail(row, await this.snapshots());
  }

  /**
   * Saves the record. When the slug of a **published** service changes, a permanent
   * redirect is written in the same transaction — CLAUDE.md's rule, and the reason is that
   * the old address is already in somebody's search index and somebody's bookmarks.
   *
   * A draft's slug changes freely: nothing has ever been served from it.
   */
  async update(id: string, input: ServiceInput, actor: Actor): Promise<AdminServiceDetail> {
    const before = await this.require(id);
    const slug = input.slug || slugify(input.title);
    await this.assertSlugFree(slug, id);

    const slugMoved = slug !== before.slug;
    const wasLive = before.status === 'PUBLISHED' || before.status === 'SCHEDULED';

    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.service.update({ where: { id }, data: { ...this.toData(input), slug } }),
    ];
    if (slugMoved && wasLive) {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: servicePath(before.slug),
            toPath: servicePath(slug),
            statusCode: 301,
            reason: `Service slug changed from ${before.slug} to ${slug}`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);

    await this.audit.record({
      userId: actor.id,
      action: 'service.updated',
      entityType: 'Service',
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: input.title, slug, redirectCreated: slugMoved && wasLive },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /**
   * Publishing takes an optional time. A time in the future is `SCHEDULED`, which the
   * public query treats as not yet live; now or in the past is `PUBLISHED`.
   */
  async publish(id: string, publishedAt: string | undefined, actor: Actor): Promise<AdminServiceDetail> {
    const before = await this.require(id);
    const when = publishedAt ? new Date(publishedAt) : new Date();
    const status: ContentStatus = when.getTime() > Date.now() ? 'SCHEDULED' : 'PUBLISHED';

    await this.prisma.client.service.update({ where: { id }, data: { status, publishedAt: when } });
    await this.audit.record({
      userId: actor.id,
      action: status === 'SCHEDULED' ? 'service.scheduled' : 'service.published',
      entityType: 'Service',
      entityId: id,
      before: { status: before.status, publishedAt: before.publishedAt?.toISOString() ?? null },
      after: { status, publishedAt: when.toISOString() },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /** Back to draft. The page stops being served; the snapshot, if there is one, resumes. */
  async unpublish(id: string, actor: Actor): Promise<AdminServiceDetail> {
    const before = await this.require(id);
    await this.prisma.client.service.update({ where: { id }, data: { status: 'DRAFT' } });
    await this.audit.record({
      userId: actor.id,
      action: 'service.unpublished',
      entityType: 'Service',
      entityId: id,
      before: { status: before.status },
      after: { status: 'DRAFT' },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /**
   * Soft delete, and a redirect if the service was live, so the address does not start
   * answering 404 to everyone who already had it. The row stays for the audit trail.
   */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const before = await this.require(id);
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.service.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } }),
    ];
    if (before.status === 'PUBLISHED') {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: servicePath(before.slug),
            toPath: '/services/',
            statusCode: 301,
            reason: `Service ${before.slug} was removed`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);

    await this.audit.record({
      userId: actor.id,
      action: 'service.deleted',
      entityType: 'Service',
      entityId: id,
      before: { title: before.title, slug: before.slug, status: before.status },
      ip: actor.ip,
    });
    return { deleted: true };
  }

  private toData(input: ServiceInput): Prisma.ServiceUncheckedUpdateInput & Prisma.ServiceUncheckedCreateInput {
    return {
      title: input.title,
      slug: input.slug,
      shortDescription: input.shortDescription,
      answerBlock: input.answerBlock,
      categoryId: input.categoryId,
      icon: input.icon,
      heroMediaUrl: input.heroMediaUrl,
      problemStatement: input.problemStatement,
      deliverables: input.deliverables,
      processSteps: input.processSteps,
      startingPriceBand: input.startingPriceBand,
      order: input.order,
      seo: input.seo,
    };
  }

  /**
   * A slug is unique across every service, deleted ones included: reusing the slug of a
   * removed service would take over its redirect and send visitors somewhere unrelated.
   */
  private async assertSlugFree(slug: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.client.service.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true, deletedAt: true },
    });
    if (clash) {
      throw new ConflictException({
        error: SERVICE_ERRORS.duplicateSlug,
        message: clash.deletedAt
          ? `A removed service already used /services/${slug}/. Choose another address.`
          : `Another service already uses /services/${slug}/.`,
      });
    }
  }

  private async require(id: string) {
    const row = await this.prisma.client.service.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireDetail(id: string): Promise<AdminServiceDetail> {
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  /** Empty when the snapshots are not on disk, which only makes the flag read false. */
  private async snapshots(): Promise<Set<string>> {
    if (this.snapshotSlugs) return this.snapshotSlugs;
    try {
      const raw = await readFile(path.join(SNAPSHOT_DIR, 'services/index.json'), 'utf8');
      const parsed = JSON.parse(raw) as { groups?: { services?: { slug?: string }[] }[] };
      const slugs = (parsed.groups ?? []).flatMap((group) =>
        (group.services ?? []).map((service) => service.slug).filter((slug): slug is string => Boolean(slug)),
      );
      this.snapshotSlugs = new Set(slugs);
    } catch {
      this.snapshotSlugs = new Set();
    }
    return this.snapshotSlugs;
  }
}

function toRow(
  row: {
    id: string;
    title: string;
    slug: string;
    status: string;
    order: number;
    publishedAt: Date | null;
    updatedAt: Date;
    category: { slug: string; name: string } | null;
  },
  snapshots: Set<string>,
): AdminServiceRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status as ContentStatus,
    category: row.category,
    order: row.order,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    // A published record wins over the snapshot; a draft does not, and the editor says so.
    shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
  };
}

function toDetail(
  row: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    answerBlock: string;
    categoryId: string | null;
    icon: string | null;
    heroMediaUrl: string | null;
    problemStatement: string | null;
    deliverables: unknown;
    processSteps: unknown;
    startingPriceBand: string | null;
    content: unknown;
    order: number;
    status: string;
    publishedAt: Date | null;
    updatedAt: Date;
    seo: unknown;
  },
  snapshots: Set<string>,
): AdminServiceDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.shortDescription,
    answerBlock: row.answerBlock,
    categoryId: row.categoryId,
    icon: row.icon,
    heroMediaUrl: row.heroMediaUrl,
    problemStatement: row.problemStatement,
    deliverables: Array.isArray(row.deliverables) ? (row.deliverables as string[]) : [],
    processSteps: Array.isArray(row.processSteps)
      ? (row.processSteps as AdminServiceDetail['processSteps'])
      : [],
    startingPriceBand: row.startingPriceBand,
    order: row.order,
    seo: (row.seo ?? {}) as AdminServiceDetail['seo'],
    status: row.status as ContentStatus,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    hasOwnContent: row.content !== null && row.content !== undefined,
    shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
  };
}
