import {
  INDUSTRY_ERRORS,
  industryPath,
  seoSchema,
  type AdminIndustryDetail,
  type AdminIndustryList,
  type IndustryInput,
} from '@calwebtech/shared';
import { Prisma } from '@calwebtech/db';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';

/**
 * Editing industries (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * The rules are the services editor's: a slug is unique, a published slug that moves leaves
 * a permanent redirect, nothing is hard-deleted, and every change is audited. They live here
 * rather than in the screen, because the screen can be bypassed and this cannot.
 */

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR?.trim() ?? path.resolve(process.cwd(), 'static-content');

const INDEX_PATH = '/industries/';

type IndustryRecord = Prisma.IndustryGetPayload<{ include: { faqs: true } }>;

@Injectable()
export class AdminIndustriesService {
  /** Read once: the snapshot is a build artefact and cannot change while the process runs. */
  private snapshotSlugs: Set<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminIndustryList> {
    const [rows, snapshots] = await Promise.all([
      this.prisma.client.industry.findMany({
        where: { deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true, status: true, order: true, updatedAt: true, content: true },
      }),
      this.snapshots(),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        order: row.order,
        updatedAt: row.updatedAt.toISOString(),
        hasContent: row.content !== null,
        shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
      })),
    };
  }

  async detail(id: string): Promise<AdminIndustryDetail | null> {
    const row = await this.find(id);
    return row ? toDetail(row, await this.snapshots()) : null;
  }

  /** A new industry starts as a draft, so creating one never puts an unfinished page live. */
  async create(input: IndustryInput, actor: Actor): Promise<AdminIndustryDetail> {
    await this.assertSlugFree(input.slug, null);
    const row = await this.prisma.client.industry.create({
      data: { ...this.toData(input), status: 'DRAFT', faqs: { create: faqRows(input) } },
    });
    await this.audit.record({
      userId: actor.id,
      action: 'industry.created',
      entityType: 'Industry',
      entityId: row.id,
      after: { name: row.name, slug: row.slug },
      ip: actor.ip,
    });
    return this.requireDetail(row.id);
  }

  /**
   * Saves the record and replaces its questions. When the slug of a published industry
   * changes, a permanent redirect is written in the same transaction (CLAUDE.md, SEO rules).
   */
  async update(id: string, input: IndustryInput, actor: Actor): Promise<AdminIndustryDetail> {
    const before = await this.require(id);
    await this.assertSlugFree(input.slug, id);
    const slugMoved = input.slug !== before.slug;
    const wasLive = before.status === 'PUBLISHED';

    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.faq.deleteMany({ where: { industryId: id } }),
      this.prisma.client.industry.update({
        where: { id },
        data: { ...this.toData(input), faqs: { create: faqRows(input) } },
      }),
    ];
    if (slugMoved && wasLive) {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: industryPath(before.slug),
            toPath: industryPath(input.slug),
            statusCode: 301,
            reason: `Industry slug changed from ${before.slug} to ${input.slug}`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);

    await this.audit.record({
      userId: actor.id,
      action: 'industry.updated',
      entityType: 'Industry',
      entityId: id,
      before: { name: before.name, slug: before.slug, faqs: before.faqs.length },
      after: { name: input.name, slug: input.slug, faqs: input.faqs.length, redirectCreated: slugMoved && wasLive },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  /** Live at once: industries have no publish time, only a status. */
  async publish(id: string, actor: Actor): Promise<AdminIndustryDetail> {
    return this.setStatus(id, 'PUBLISHED', 'industry.published', actor);
  }

  /** Back to draft. The page stops being served; the snapshot, if there is one, resumes. */
  async unpublish(id: string, actor: Actor): Promise<AdminIndustryDetail> {
    return this.setStatus(id, 'DRAFT', 'industry.unpublished', actor);
  }

  /**
   * Soft delete, and a redirect to the index if the industry was live, so its address does
   * not start answering 404 to everyone who already had it.
   */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const before = await this.require(id);
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.industry.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } }),
    ];
    if (before.status === 'PUBLISHED') {
      writes.push(
        this.prisma.client.redirect.create({
          data: {
            fromPath: industryPath(before.slug),
            toPath: INDEX_PATH,
            statusCode: 301,
            reason: `Industry ${before.slug} was removed`,
          },
        }),
      );
    }
    await this.prisma.client.$transaction(writes);
    await this.audit.record({
      userId: actor.id,
      action: 'industry.deleted',
      entityType: 'Industry',
      entityId: id,
      before: { name: before.name, slug: before.slug, status: before.status },
      ip: actor.ip,
    });
    return { deleted: true };
  }

  private async setStatus(
    id: string,
    status: 'PUBLISHED' | 'DRAFT',
    action: string,
    actor: Actor,
  ): Promise<AdminIndustryDetail> {
    const before = await this.require(id);
    await this.prisma.client.industry.update({ where: { id }, data: { status } });
    await this.audit.record({
      userId: actor.id,
      action,
      entityType: 'Industry',
      entityId: id,
      before: { status: before.status },
      after: { status },
      ip: actor.ip,
    });
    return this.requireDetail(id);
  }

  private toData(input: IndustryInput) {
    return {
      name: input.name,
      slug: input.slug,
      answerBlock: input.answerBlock,
      heroCopy: input.heroCopy,
      order: input.order,
      seo: input.seo,
      content: input.content ?? Prisma.DbNull,
    };
  }

  /**
   * A slug is unique across every industry, removed ones included: reusing a removed one's
   * slug would take over its redirect and send visitors somewhere unrelated.
   */
  private async assertSlugFree(slug: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.client.industry.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { deletedAt: true },
    });
    if (clash) {
      throw new ConflictException({
        error: INDUSTRY_ERRORS.duplicateSlug,
        message: clash.deletedAt
          ? `A removed industry already used /industries/${slug}/. Choose another address.`
          : `Another industry already uses /industries/${slug}/.`,
      });
    }
  }

  private find(id: string): Promise<IndustryRecord | null> {
    return this.prisma.client.industry.findFirst({
      where: { id, deletedAt: null },
      include: { faqs: { orderBy: { order: 'asc' } } },
    });
  }

  private async require(id: string): Promise<IndustryRecord> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async requireDetail(id: string): Promise<AdminIndustryDetail> {
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  /** Empty when the snapshots are not on disk, which only makes the flag read false. */
  private async snapshots(): Promise<Set<string>> {
    if (this.snapshotSlugs) return this.snapshotSlugs;
    try {
      const raw = await readFile(path.join(SNAPSHOT_DIR, 'industries/index.json'), 'utf8');
      const parsed = JSON.parse(raw) as { industries?: { slug?: string }[] };
      this.snapshotSlugs = new Set(
        (parsed.industries ?? []).map((industry) => industry.slug).filter((slug): slug is string => Boolean(slug)),
      );
    } catch {
      this.snapshotSlugs = new Set();
    }
    return this.snapshotSlugs;
  }
}

function faqRows(input: IndustryInput) {
  return input.faqs.map((faq, order) => ({ question: faq.question, answer: faq.answer, order }));
}

function toDetail(row: IndustryRecord, snapshots: Set<string>): AdminIndustryDetail {
  const seo = seoSchema.safeParse(row.seo ?? {});
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    answerBlock: row.answerBlock,
    heroCopy: row.heroCopy,
    order: row.order,
    seo: seo.success ? seo.data : {},
    content: row.content,
    faqs: row.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    shadowsSnapshot: snapshots.has(row.slug) && row.status !== 'PUBLISHED',
  };
}
