import { type Prisma, type PrismaClient, audienceWhere } from '@calwebtech/db';
import { campaignContentSchema, segmentRulesSchema } from '@calwebtech/shared';
import type { CampaignSendStore, RecipientToSend } from './campaign-send';

const CHUNK = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export interface SweepOptions {
  db: PrismaClient;
  /** Adds one send job per recipient id. Ids already queued are ignored by the queue. */
  enqueue: (recipientIds: readonly string[]) => Promise<void>;
  /** False when a campaign could not carry a working unsubscribe link. */
  canSend: boolean;
  log: (line: string) => void;
  now?: Date;
}

export interface SweepResult {
  started: string[];
  queued: number;
  finished: string[];
}

/**
 * The campaign sweep (Task 5.4), run every minute and whenever a campaign is sent now.
 *
 * 1. **Start** every scheduled campaign that is due. The status moves from SCHEDULED to
 *    SENDING in one conditional update, so two sweeps at once start it once. The segment is
 *    evaluated here, at send time, and each person it reaches gets a delivery row.
 * 2. **Queue** every recipient of a sending campaign not yet sent to. The rows are written
 *    before the jobs, so if the process dies in between, the next sweep queues them: a
 *    campaign never loses recipients the way a lead can lose its emails (the outbox note in
 *    docs/08-decisions.md, Open). Queueing an id that is already waiting does nothing.
 * 3. **Finish** a sending campaign with nobody left to send to: SENT if anyone received it,
 *    FAILED if nobody did.
 */
export async function runCampaignSweep({ db, enqueue, canSend, log, now = new Date() }: SweepOptions): Promise<SweepResult> {
  const result: SweepResult = { started: [], queued: 0, finished: [] };

  const due = await db.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    select: { id: true, name: true, segment: { select: { rules: true } } },
    orderBy: { scheduledAt: 'asc' },
  });
  if (due.length > 0 && !canSend) {
    log(`${String(due.length)} campaign(s) due but not started: set AUTH_SECRET and APP_ORIGIN so each email carries an unsubscribe link`);
  }

  for (const campaign of canSend ? due : []) {
    const claimed = await db.campaign.updateMany({
      where: { id: campaign.id, status: 'SCHEDULED' },
      data: { status: 'SENDING' },
    });
    if (claimed.count !== 1) continue;

    if (!campaign.segment) {
      await db.campaign.update({ where: { id: campaign.id }, data: { status: 'FAILED', sentAt: now } });
      await audit(db, 'campaign.failed', campaign.id, { reason: 'no segment' });
      log(`campaign ${campaign.id} failed: it has no segment`);
      continue;
    }

    const where = await audienceWhere(db, segmentRulesSchema.parse(campaign.segment.rules), now);
    const audience = await db.subscriber.findMany({ where, select: { id: true, email: true } });
    for (const part of chunks(audience, CHUNK)) {
      await db.campaignRecipient.createMany({
        data: part.map((subscriber) => ({ campaignId: campaign.id, subscriberId: subscriber.id, email: subscriber.email })),
        skipDuplicates: true,
      });
    }
    await audit(db, 'campaign.dispatched', campaign.id, { name: campaign.name, recipients: audience.length });
    log(`campaign ${campaign.id} started for ${String(audience.length)} recipient(s)`);
    result.started.push(campaign.id);
  }

  const sending = await db.campaign.findMany({ where: { status: 'SENDING' }, select: { id: true } });
  for (const campaign of sending) {
    const pending = await db.campaignRecipient.findMany({
      where: { campaignId: campaign.id, sentAt: null, failedAt: null },
      select: { id: true },
    });
    if (pending.length > 0) {
      for (const part of chunks(pending, CHUNK)) await enqueue(part.map((row) => row.id));
      result.queued += pending.length;
      continue;
    }

    const sent = await db.campaignRecipient.count({ where: { campaignId: campaign.id, sentAt: { not: null } } });
    const failed = await db.campaignRecipient.count({ where: { campaignId: campaign.id, failedAt: { not: null } } });
    const status = sent > 0 || failed === 0 ? 'SENT' : 'FAILED';
    await db.campaign.update({ where: { id: campaign.id }, data: { status, sentAt: now } });
    await audit(db, status === 'SENT' ? 'campaign.sent' : 'campaign.failed', campaign.id, { sent, failed });
    log(`campaign ${campaign.id} finished: ${String(sent)} sent, ${String(failed)} not sent`);
    result.finished.push(campaign.id);
  }

  return result;
}

/** The worker has no signed-in user; these entries record what the system did and when. */
async function audit(db: PrismaClient, action: string, campaignId: string, after: Prisma.InputJsonObject): Promise<void> {
  try {
    await db.auditLog.create({ data: { userId: null, action, entityType: 'Campaign', entityId: campaignId, after } });
  } catch (error) {
    console.error(`audit ${action} ${campaignId}:`, error);
  }
}

/** The send processor's view of the database. */
export function prismaCampaignSendStore(db: PrismaClient): CampaignSendStore {
  return {
    async recipient(recipientId): Promise<RecipientToSend | null> {
      const row = await db.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: {
          subscriber: { select: { name: true, unsubscribedAt: true } },
          campaign: { select: { subject: true, preheader: true, templateKey: true, body: true } },
        },
      });
      if (!row) return null;
      const suppression = await db.suppression.findFirst({
        where: { email: { equals: row.email, mode: 'insensitive' } },
        select: { id: true },
      });
      return {
        id: row.id,
        email: row.email,
        subscriberId: row.subscriberId,
        sentAt: row.sentAt,
        failedAt: row.failedAt,
        name: row.subscriber?.name ?? null,
        unsubscribedAt: row.subscriber?.unsubscribedAt ?? null,
        suppressed: suppression !== null,
        content: campaignContentSchema.parse(row.campaign),
      };
    },
    async markSent(recipientId, providerId) {
      await db.campaignRecipient.update({ where: { id: recipientId }, data: { sentAt: new Date(), providerId } });
    },
    async markNotSent(recipientId, reason) {
      await db.campaignRecipient.update({
        where: { id: recipientId },
        data: { failedAt: new Date(), error: reason.slice(0, 500) },
      });
    },
  };
}
