import { randomBytes } from 'node:crypto';
import type { Prisma } from '@calwebtech/db';
import { renderCampaign } from '@calwebtech/emails';
import {
  CAMPAIGN_ERRORS,
  type AdminCampaign,
  type AdminCampaignList,
  type AdminCampaignQuery,
  type AdminUser,
  type CampaignContent,
  type CampaignPreview,
  type CampaignPreviewRequest,
  type CampaignRecipient,
  type CampaignTestSend,
  type CampaignTestSent,
  type CampaignWrite,
  adminCampaignListSchema,
  adminCampaignSchema,
  campaignBodySchema,
  campaignContentSchema,
  campaignPreviewSchema,
  campaignTestSentSchema,
  segmentRulesSchema,
} from '@calwebtech/shared';
import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailQueue } from '../../queue/email-queue';
import { AdminAudienceService } from '../audience/admin-audience.service';

const WITH_RELATIONS = {
  segment: { select: { id: true, name: true } },
  _count: { select: { recipients: true } },
} satisfies Prisma.CampaignInclude;

type CampaignRecord = Prisma.CampaignGetPayload<{ include: typeof WITH_RELATIONS }>;

/** Fills the tokens when a preview has nobody real to fill them from. */
const PLACEHOLDER_RECIPIENT: CampaignRecipient = { name: 'Alex Morgan', email: 'alex@example.com' };

function toView(row: CampaignRecord): AdminCampaign {
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
  ) {}

  async list(query: AdminCampaignQuery): Promise<AdminCampaignList> {
    const rows = await this.prisma.client.campaign.findMany({
      where: query.status ? { status: query.status } : {},
      include: WITH_RELATIONS,
      orderBy: { updatedAt: 'desc' },
    });
    return adminCampaignListSchema.parse({ items: rows.map(toView) });
  }

  async find(id: string): Promise<AdminCampaign> {
    const row = await this.prisma.client.campaign.findUnique({ where: { id }, include: WITH_RELATIONS });
    if (!row) throw new NotFoundException();
    return toView(row);
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
