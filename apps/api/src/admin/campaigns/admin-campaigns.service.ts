import { randomBytes } from 'node:crypto';
import type { Prisma } from '@calwebtech/db';
import { renderCampaign } from '@calwebtech/emails';
import { usableSigningSecret } from '@calwebtech/shared/unsubscribe-token';
import {
  CAMPAIGN_ERRORS,
  type AdminCampaign,
  type AdminCampaignList,
  type AdminCampaignQuery,
  type AdminUser,
  CAMPAIGN_REPORT_PAGE_SIZE,
  type CampaignContent,
  type CampaignReport,
  type CampaignReportQuery,
  type CampaignPreview,
  type CampaignPreviewRequest,
  type CampaignRecipient,
  type CampaignSchedule,
  type CampaignTestSend,
  type CampaignTestSent,
  type CampaignWrite,
  adminCampaignListSchema,
  adminCampaignSchema,
  campaignBodySchema,
  campaignContentSchema,
  campaignPreviewSchema,
  campaignReportSchema,
  campaignTestSentSchema,
  segmentRulesSchema,
} from '@calwebtech/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { API_ENV, type ApiEnv } from '../../config/env';
import { CampaignSweepQueue } from '../../queue/campaign-sweep-queue';
import { EmailQueue } from '../../queue/email-queue';
import { AdminAudienceService } from '../audience/admin-audience.service';
import { stateWhere, toReportRecipient } from './campaign-report';

const WITH_RELATIONS = {
  segment: { select: { id: true, name: true } },
  _count: { select: { recipients: true } },
} satisfies Prisma.CampaignInclude;

type CampaignRecord = Prisma.CampaignGetPayload<{ include: typeof WITH_RELATIONS }>;
interface Progress {
  sent: number;
  failed: number;
}

const NO_PROGRESS: Progress = { sent: 0, failed: 0 };

/** A send time this close to now, or earlier, is "now". Past that, a past time is a mistake. */
const NOW_TOLERANCE_MS = 60_000;

/** Fills the tokens when a preview has nobody real to fill them from. */
const PLACEHOLDER_RECIPIENT: CampaignRecipient = { name: 'Alex Morgan', email: 'alex@example.com' };

function toView(row: CampaignRecord, progress: Progress = NO_PROGRESS): AdminCampaign {
  return adminCampaignSchema.parse({
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    templateKey: row.templateKey,
    body: campaignBodySchema.parse(row.body),
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    segment: row.segment,
    recipientCount: row._count.recipients,
    progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function contentOf(campaign: AdminCampaign): CampaignContent {
  return campaignContentSchema.parse({
    subject: campaign.subject,
    preheader: campaign.preheader,
    templateKey: campaign.templateKey,
    body: campaign.body,
  });
}

/**
 * Campaigns in the dashboard (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * Only a draft can be edited or deleted. Once a campaign is scheduled its words are what
 * will be sent, and once it is sent they are the record of what was; neither should move
 * under the report that describes them.
 */
@Injectable()
export class AdminCampaignsService {
  private readonly logger = new Logger(AdminCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly audience: AdminAudienceService,
    private readonly emailQueue: EmailQueue,
    private readonly sweepQueue: CampaignSweepQueue,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async list(query: AdminCampaignQuery): Promise<AdminCampaignList> {
    const rows = await this.prisma.client.campaign.findMany({
      where: query.status ? { status: query.status } : {},
      include: WITH_RELATIONS,
      orderBy: { updatedAt: 'desc' },
    });
    const progress = await this.progressFor(rows.map((row) => row.id));
    return adminCampaignListSchema.parse({ items: rows.map((row) => toView(row, progress.get(row.id))) });
  }

  async find(id: string): Promise<AdminCampaign> {
    const row = await this.prisma.client.campaign.findUnique({ where: { id }, include: WITH_RELATIONS });
    if (!row) throw new NotFoundException();
    const progress = await this.progressFor([id]);
    return toView(row, progress.get(id));
  }

  /**
   * Schedules a draft, or sends it now when `sendAt` is null. The segment is not counted
   * here: the worker counts it when the campaign starts, which is the point of a segment.
   */
  async schedule(id: string, input: CampaignSchedule, actorId: string): Promise<AdminCampaign> {
    const campaign = await this.requireDraft(id);
    if (!campaign.segment) {
      throw new ConflictException({ error: CAMPAIGN_ERRORS.noSegment, message: 'Choose a segment before scheduling.' });
    }
    if (!usableSigningSecret(this.env.AUTH_SECRET)) {
      throw new ConflictException({
        error: CAMPAIGN_ERRORS.sendingUnavailable,
        message: 'Sending is not set up on this server: AUTH_SECRET is missing or shorter than 16 characters, so no unsubscribe link could be signed.',
      });
    }

    const now = Date.now();
    const sendAt = input.sendAt ? new Date(input.sendAt) : new Date(now);
    if (sendAt.getTime() < now - NOW_TOLERANCE_MS) {
      throw new BadRequestException({
        error: CAMPAIGN_ERRORS.inThePast,
        message: 'That time has already passed. Choose a later time, or send now.',
      });
    }

    await this.prisma.client.campaign.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: sendAt } });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'campaign.scheduled',
      entityType: 'Campaign',
      entityId: id,
      after: { sendAt: sendAt.toISOString(), segment: campaign.segment.name, now: input.sendAt === null },
    });
    if (sendAt.getTime() <= now + NOW_TOLERANCE_MS) await this.sweepQueue.sweepNow(`campaign ${id} sent now`);
    return this.find(id);
  }

  /** Back to a draft, as long as the worker has not started it. */
  async unschedule(id: string, actorId: string): Promise<AdminCampaign> {
    await this.find(id);
    const moved = await this.prisma.client.campaign.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: 'DRAFT', scheduledAt: null },
    });
    if (moved.count !== 1) {
      throw new ConflictException({
        error: CAMPAIGN_ERRORS.notScheduled,
        message: 'This campaign is not scheduled any more. It may already be sending.',
      });
    }
    await this.audit.recordQuietly({ userId: actorId, action: 'campaign.unscheduled', entityType: 'Campaign', entityId: id });
    return this.find(id);
  }

  /**
   * The campaign's report: who it reached and what they did, counted in people. Delivery
   * implies sending, an open implies delivery and a click implies an open, so each count
   * includes the ones past it; the recipient list shows each person once, at the furthest
   * thing that happened.
   */
  async report(id: string, query: CampaignReportQuery): Promise<CampaignReport> {
    const campaign = await this.find(id);
    const inCampaign = { campaignId: id };
    const count = (where: Prisma.CampaignRecipientWhereInput) =>
      this.prisma.client.campaignRecipient.count({ where: { ...inCampaign, ...where } });

    const started = await this.prisma.client.campaignRecipient.aggregate({
      where: inCampaign,
      _min: { sentAt: true },
    });
    const startedAt = started._min.sentAt;

    const [recipients, sent, notSent, delivered, opened, clicked, bounced, complained, unsubscribed] = await Promise.all([
      count({}),
      count({ sentAt: { not: null } }),
      count({ failedAt: { not: null } }),
      count({ OR: [{ deliveredAt: { not: null } }, { openedAt: { not: null } }, { clickedAt: { not: null } }] }),
      count({ OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }] }),
      count({ clickedAt: { not: null } }),
      count({ bouncedAt: { not: null } }),
      count({ complainedAt: { not: null } }),
      startedAt ? count({ sentAt: { not: null }, subscriber: { unsubscribedAt: { gte: startedAt } } }) : Promise.resolve(0),
    ]);

    const where: Prisma.CampaignRecipientWhereInput = { ...inCampaign, ...(query.state ? stateWhere(query.state) : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.campaignRecipient.findMany({
        where,
        include: { subscriber: { select: { name: true } } },
        orderBy: { email: 'asc' },
        skip: (query.page - 1) * CAMPAIGN_REPORT_PAGE_SIZE,
        take: CAMPAIGN_REPORT_PAGE_SIZE,
      }),
      this.prisma.client.campaignRecipient.count({ where }),
    ]);

    return campaignReportSchema.parse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        segment: campaign.segment?.name ?? null,
        startedAt: startedAt?.toISOString() ?? null,
        finishedAt: campaign.sentAt,
      },
      totals: { recipients, sent, notSent, delivered, opened, clicked, bounced, complained, unsubscribed },
      recipients: { items: rows.map(toReportRecipient), total, page: query.page, pageSize: CAMPAIGN_REPORT_PAGE_SIZE },
    });
  }

  /** Sent and not-sent counts per campaign, in two queries however many campaigns there are. */
  private async progressFor(ids: readonly string[]): Promise<Map<string, Progress>> {
    const result = new Map<string, Progress>();
    if (ids.length === 0) return result;
    const [sent, failed] = await Promise.all([
      this.prisma.client.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: [...ids] }, sentAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.client.campaignRecipient.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: [...ids] }, failedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    for (const id of ids) result.set(id, { sent: 0, failed: 0 });
    for (const row of sent) result.set(row.campaignId, { ...(result.get(row.campaignId) ?? NO_PROGRESS), sent: row._count._all });
    for (const row of failed) {
      result.set(row.campaignId, { ...(result.get(row.campaignId) ?? NO_PROGRESS), failed: row._count._all });
    }
    return result;
  }

  async create(input: CampaignWrite, actorId: string): Promise<AdminCampaign> {
    await this.assertSegment(input.segmentId ?? null);
    const row = await this.prisma.client.campaign.create({ data: this.data(input) });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'campaign.created',
      entityType: 'Campaign',
      entityId: row.id,
      after: { name: input.name, subject: input.subject, segmentId: input.segmentId ?? null },
    });
    return this.find(row.id);
  }

  async update(id: string, input: CampaignWrite, actorId: string): Promise<AdminCampaign> {
    const before = await this.requireDraft(id);
    await this.assertSegment(input.segmentId ?? null);
    await this.prisma.client.campaign.update({ where: { id }, data: this.data(input) });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'campaign.updated',
      entityType: 'Campaign',
      entityId: id,
      before: { name: before.name, subject: before.subject, segmentId: before.segment?.id ?? null },
      after: { name: input.name, subject: input.subject, segmentId: input.segmentId ?? null },
    });
    return this.find(id);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const before = await this.requireDraft(id);
    await this.prisma.client.campaign.delete({ where: { id } });
    await this.audit.recordQuietly({
      userId: actorId,
      action: 'campaign.deleted',
      entityType: 'Campaign',
      entityId: id,
      before: { name: before.name, subject: before.subject },
    });
  }

  /**
   * Renders content that may not be saved yet. With a segment, the newest person it reaches
   * fills the tokens, so "Hi {{firstName|there}}" reads the way it will in an inbox.
   */
  async preview(input: CampaignPreviewRequest): Promise<CampaignPreview> {
    const sample = await this.sampleRecipient(input.segmentId ?? null);
    const rendered = await renderCampaign({ content: input.content, recipient: sample, unsubscribeUrl: null });
    return campaignPreviewSchema.parse({ ...rendered, sample });
  }

  /**
   * Queues a test of the campaign as it is saved, to a handful of the team's addresses.
   * The tokens are filled from the person who asked, so they see their own name where a
   * subscriber will see theirs.
   */
  async sendTest(id: string, input: CampaignTestSend, user: AdminUser, ip: string): Promise<CampaignTestSent> {
    const campaign = await this.find(id);
    const testId = randomBytes(9).toString('base64url');

    try {
      await this.emailQueue.enqueue([
        {
          template: 'campaign-test',
          to: input.to,
          campaignId: id,
          testId,
          content: contentOf(campaign),
          recipient: { name: user.name, email: user.email },
        },
      ]);
    } catch (error) {
      this.logger.error(`Campaign test ${id}: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException({
        error: CAMPAIGN_ERRORS.queueUnavailable,
        message: 'The email queue is not reachable, so the test was not sent. Try again in a minute.',
      });
    }

    await this.audit.recordQuietly({
      userId: user.id,
      action: 'campaign.test_sent',
      entityType: 'Campaign',
      entityId: id,
      after: { to: input.to, subject: campaign.subject },
      ip,
    });
    return campaignTestSentSchema.parse({ to: input.to, queuedAt: new Date().toISOString() });
  }

  private data(input: CampaignWrite) {
    return {
      name: input.name,
      subject: input.subject,
      preheader: input.preheader ?? null,
      templateKey: input.templateKey,
      body: input.body,
      segmentId: input.segmentId ?? null,
    };
  }

  private async requireDraft(id: string): Promise<AdminCampaign> {
    const campaign = await this.find(id);
    if (campaign.status !== 'DRAFT') {
      throw new ConflictException({
        error: CAMPAIGN_ERRORS.locked,
        message: 'Only a draft can be changed. This campaign is already scheduled or sent.',
      });
    }
    return campaign;
  }

  private async assertSegment(segmentId: string | null): Promise<void> {
    if (!segmentId) return;
    const segment = await this.prisma.client.segment.findUnique({ where: { id: segmentId }, select: { id: true } });
    if (!segment) {
      throw new ConflictException({ error: CAMPAIGN_ERRORS.segmentUnknown, message: 'That segment no longer exists.' });
    }
  }

  private async sampleRecipient(segmentId: string | null): Promise<CampaignRecipient> {
    if (!segmentId) return PLACEHOLDER_RECIPIENT;
    const segment = await this.prisma.client.segment.findUnique({ where: { id: segmentId }, select: { rules: true } });
    if (!segment) return PLACEHOLDER_RECIPIENT;
    const where = await this.audience.audienceWhere(segmentRulesSchema.parse(segment.rules));
    const first = await this.prisma.client.subscriber.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { name: true, email: true },
    });
    return first ?? PLACEHOLDER_RECIPIENT;
  }
}
