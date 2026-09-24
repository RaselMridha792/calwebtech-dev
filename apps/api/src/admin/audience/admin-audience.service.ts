import { type Prisma, audienceWhere, eligibleWhere, segmentWhere, suppressedEmails } from '@calwebtech/db';
import {
  AUDIENCE_ERRORS,
  type AdminSegment,
  type AdminSegmentList,
  type AdminSubscriber,
  type AdminSubscriberList,
  type AdminSubscriberQuery,
  type AdminSuppressionList,
  type AdminSuppressionQuery,
  type SegmentPreview,
  type SegmentRules,
  type SegmentWrite,
  type SubscriberStatus,
  type SubscriberTagsUpdate,
  type Suppression,
  type SuppressionCreate,
  adminSegmentListSchema,
  adminSegmentSchema,
  adminSubscriberListSchema,
  adminSubscriberSchema,
  adminSuppressionListSchema,
  segmentPreviewSchema,
  segmentRulesSchema,
  suppressionSchema,
} from '@calwebtech/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const WITH_TAGS = { tags: { select: { tagName: true }, orderBy: { tagName: 'asc' } } } satisfies Prisma.SubscriberInclude;
type SubscriberRecord = Prisma.SubscriberGetPayload<{ include: typeof WITH_TAGS }>;
type SuppressionRecord = { reason: string; createdAt: Date };

const PREVIEW_SAMPLE = 5;

function statusOf(subscriber: SubscriberRecord, suppression: SuppressionRecord | undefined): SubscriberStatus {
  if (suppression) return 'suppressed';
  return subscriber.unsubscribedAt ? 'unsubscribed' : 'active';
}

function toSubscriberView(subscriber: SubscriberRecord, suppression: SuppressionRecord | undefined): AdminSubscriber {
  return {
    id: subscriber.id,
    email: subscriber.email,
    name: subscriber.name,
    sourcePage: subscriber.sourcePage,
    consentAt: subscriber.consentAt.toISOString(),
    unsubscribedAt: subscriber.unsubscribedAt?.toISOString() ?? null,
    lastEngagedAt: subscriber.lastEngagedAt?.toISOString() ?? null,
    createdAt: subscriber.createdAt.toISOString(),
    tags: subscriber.tags.map((tag) => tag.tagName),
    status: statusOf(subscriber, suppression),
    suppression: suppression ? { reason: suppression.reason, createdAt: suppression.createdAt.toISOString() } : null,
  };
}

function toSuppressionView(row: { id: string; email: string; reason: string; createdAt: Date }): Suppression {
  return { id: row.id, email: row.email, reason: row.reason, createdAt: row.createdAt.toISOString() };
}

/**
 * Subscribers, their tags, segments and the suppression list (docs/12-admin-dashboard.md,
 * module 4).
 *
 * Every count and every audience goes through `audienceWhere`, which puts the suppression
 * list and unsubscribes on top of the segment's own rules. The campaign send resolves its
 * recipients through the same method, so the number an admin sees here is the number the
 * send reaches, less whoever unsubscribes in between.
 */
@Injectable()
export class AdminAudienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ audience

  /**
   * The suppression list as addresses. Read in full: it is the one list that must never be
   * approximated, and at this business's scale it is thousands of rows, not millions.
   */
  private suppressedEmails(): Promise<string[]> {
    return suppressedEmails(this.prisma.client);
  }

  /** Who a rule set reaches right now, with suppression and unsubscribes taken out. */
  audienceWhere(rules: SegmentRules, now = new Date()): Promise<Prisma.SubscriberWhereInput> {
    return audienceWhere(this.prisma.client, rules, now);
  }

  async preview(rules: SegmentRules): Promise<SegmentPreview> {
    const now = new Date();
    const suppressed = await this.suppressedEmails();
    const eligible = eligibleWhere(suppressed);
    const where = { AND: [eligible, segmentWhere(rules, now)] };

    const [count, total, sample] = await Promise.all([
      this.prisma.client.subscriber.count({ where }),
      this.prisma.client.subscriber.count({ where: eligible }),
      this.prisma.client.subscriber.findMany({
        where,
        select: { email: true, name: true },
        orderBy: { createdAt: 'desc' },
        take: PREVIEW_SAMPLE,
      }),
    ]);
    return segmentPreviewSchema.parse({ count, eligible: total, sample });
  }

  // ------------------------------------------------------------ subscribers

  async listSubscribers(query: AdminSubscriberQuery): Promise<AdminSubscriberList> {
    const suppressed = await this.suppressedEmails();
    const inSuppression: Prisma.SubscriberWhereInput = { email: { in: suppressed, mode: 'insensitive' } };

    const byStatus: Record<SubscriberStatus, Prisma.SubscriberWhereInput> = {
      active: eligibleWhere(suppressed),
      unsubscribed: { AND: [{ unsubscribedAt: { not: null } }, { NOT: inSuppression }] },
      suppressed: inSuppression,
    };

    const where: Prisma.SubscriberWhereInput = {
      AND: [
        query.status ? byStatus[query.status] : {},
        query.tag ? { tags: { some: { tagName: query.tag } } } : {},
        query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const [items, total, tags] = await Promise.all([
      this.prisma.client.subscriber.findMany({
        where,
        include: WITH_TAGS,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.subscriber.count({ where }),
      this.prisma.client.subscriberTag.groupBy({
        by: ['tagName'],
        _count: { _all: true },
        orderBy: { tagName: 'asc' },
      }),
    ]);

    const suppressions = await this.suppressionsFor(items.map((item) => item.email));
    return adminSubscriberListSchema.parse({
      items: items.map((item) => toSubscriberView(item, suppressions.get(item.email.toLowerCase()))),
      total,
      page: query.page,
      pageSize: query.pageSize,
      tags: tags.map((tag) => ({ name: tag.tagName, count: tag._count._all })),
    });
  }

  async findSubscriber(id: string): Promise<AdminSubscriber> {
    const subscriber = await this.prisma.client.subscriber.findUnique({ where: { id }, include: WITH_TAGS });
    if (!subscriber) throw new NotFoundException();
    const suppressions = await this.suppressionsFor([subscriber.email]);
    return adminSubscriberSchema.parse(toSubscriberView(subscriber, suppressions.get(subscriber.email.toLowerCase())));
  }

  /** Replaces the tags in one go: the screen shows the whole set, and saves the whole set. */
  async setTags(id: string, input: SubscriberTagsUpdate, actorId: string): Promise<AdminSubscriber> {
    const before = await this.findSubscriber(id);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.subscriberTag.deleteMany({ where: { subscriberId: id } });
      if (input.tags.length > 0) {
        await tx.subscriberTag.createMany({ data: input.tags.map((tagName) => ({ subscriberId: id, tagName })) });
      }
    });

    await this.audit.recordQuietly({
      userId: actorId,
      action: 'subscriber.tags_changed',
      entityType: 'Subscriber',
      entityId: id,
      before: { tags: before.tags },
      after: { tags: input.tags },
    });
    return this.findSubscriber(id);
  }

  /** Suppression rows for a page of addresses, keyed by the lower-cased address. */
  private async suppressionsFor(emails: readonly string[]): Promise<Map<string, SuppressionRecord>> {
    if (emails.length === 0) return new Map();
    const rows = await this.prisma.client.suppression.findMany({
      where: { email: { in: [...emails], mode: 'insensitive' } },
      select: { email: true, reason: true, createdAt: true },
    });
    return new Map(rows.map((row) => [row.email.toLowerCase(), { reason: row.reason, createdAt: row.createdAt }]));
  }

  // ------------------------------------------------------------ suppression

  async listSuppressions(query: AdminSuppressionQuery): Promise<AdminSuppressionList> {
    const where: Prisma.SuppressionWhereInput = {
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.suppression.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.suppression.count({ where }),
    ]);
    return adminSuppressionListSchema.parse({
      items: items.map(toSuppressionView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * Adds an address by hand. An address already on the list keeps the reason it has: an
   * unsubscribe or a bounce says more about it than "added by hand" does.
   */
  async addSuppression(input: SuppressionCreate, actorId: string): Promise<Suppression> {
    const existing = await this.prisma.client.suppression.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
    });
    if (existing) return suppressionSchema.parse(toSuppressionView(existing));

    const row = await this.prisma.client.suppression.create({ data: { email: input.email, reason: 'manual' } });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'suppression.added',
      entityType: 'Suppression',
      entityId: row.id,
      after: { email: row.email, reason: row.reason },
    });
    return suppressionSchema.parse(toSuppressionView(row));
  }

  // ------------------------------------------------------------ segments

  async listSegments(): Promise<AdminSegmentList> {
    const rows = await this.prisma.client.segment.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { campaigns: true } } },
    });
    const suppressed = await this.suppressedEmails();
    const now = new Date();
    const items = await Promise.all(rows.map((row) => this.toSegmentView(row, suppressed, now)));
    return adminSegmentListSchema.parse({ items });
  }

  async findSegment(id: string): Promise<AdminSegment> {
    const row = await this.prisma.client.segment.findUnique({
      where: { id },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!row) throw new NotFoundException();
    return this.toSegmentView(row, await this.suppressedEmails(), new Date());
  }

  async createSegment(input: SegmentWrite, actorId: string): Promise<AdminSegment> {
    const row = await this.prisma.client.segment.create({
      data: { name: input.name, description: input.description ?? null, rules: input.rules },
    });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'segment.created',
      entityType: 'Segment',
      entityId: row.id,
      after: { name: input.name, rules: input.rules },
    });
    return this.findSegment(row.id);
  }

  async updateSegment(id: string, input: SegmentWrite, actorId: string): Promise<AdminSegment> {
    const before = await this.findSegment(id);
    await this.prisma.client.segment.update({
      where: { id },
      data: { name: input.name, description: input.description ?? null, rules: input.rules },
    });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'segment.updated',
      entityType: 'Segment',
      entityId: id,
      before: { name: before.name, rules: before.rules },
      after: { name: input.name, rules: input.rules },
    });
    return this.findSegment(id);
  }

  /**
   * A segment a campaign points at stays: the campaign's report says who it was sent to by
   * way of the segment, and a sent campaign whose audience has vanished cannot say that.
   */
  async deleteSegment(id: string, actorId: string): Promise<void> {
    const before = await this.findSegment(id);
    if (before.campaignCount > 0) {
      throw new ConflictException({
        error: AUDIENCE_ERRORS.segmentInUse,
        message: `${String(before.campaignCount)} ${before.campaignCount === 1 ? 'campaign uses' : 'campaigns use'} this segment, so it cannot be deleted.`,
      });
    }
    await this.prisma.client.segment.delete({ where: { id } });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'segment.deleted',
      entityType: 'Segment',
      entityId: id,
      before: { name: before.name, rules: before.rules },
    });
  }

  private async toSegmentView(
    row: {
      id: string;
      name: string;
      description: string | null;
      rules: Prisma.JsonValue;
      createdAt: Date;
      updatedAt: Date;
      _count: { campaigns: number };
    },
    suppressed: readonly string[],
    now: Date,
  ): Promise<AdminSegment> {
    const rules = segmentRulesSchema.parse(row.rules);
    const count = await this.prisma.client.subscriber.count({
      where: { AND: [eligibleWhere(suppressed), segmentWhere(rules, now)] },
    });
    return adminSegmentSchema.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      rules,
      count,
      campaignCount: row._count.campaigns,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
}
