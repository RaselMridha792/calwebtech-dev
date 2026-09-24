import type { Prisma } from '@calwebtech/db';
import { EMAIL_EVENT_TYPES, resendWebhookEventSchema, type EmailEventType } from '@calwebtech/shared';
import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Module,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { API_ENV, type ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { verifySignature } from './svix-signature';

const PROVIDER = 'resend';

function isKnownType(type: string): type is keyof typeof EMAIL_EVENT_TYPES {
  return type in EMAIL_EVENT_TYPES;
}

export interface WebhookOutcome {
  status: 'processed' | 'duplicate' | 'ignored';
}

/**
 * Resend's delivery events, written back against our own records (Task 5.4;
 * docs/01-architecture.md, "Delivery webhooks write back against the lead or campaign").
 *
 * Every signed request is stored in `WebhookLog` first, as it arrived, so an event that
 * fails to apply is still there to replay. Applying one:
 *
 * - writes an `EmailEvent`, for every email we sent, campaign or not;
 * - stamps the campaign recipient's `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt` or
 *   `complainedAt`, first time only, so a repeated event changes nothing;
 * - moves an address to the suppression list on a permanent bounce (`hard_bounce`) or a spam
 *   complaint (`complaint`), whichever email it was, so no campaign reaches it again;
 * - sets the subscriber's `lastEngagedAt` on an open or a click, which is what the segment
 *   builder's "last engaged" rule reads.
 *
 * Resend retries a request that does not answer 2xx, with the same `svix-id`, so a message
 * already stored is acknowledged and not applied twice.
 */
@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async receive(messageId: string, raw: unknown): Promise<WebhookOutcome> {
    const seen = await this.prisma.client.webhookLog.findFirst({
      where: { provider: PROVIDER, payload: { path: ['svixId'], equals: messageId } },
      select: { id: true },
    });
    if (seen) return { status: 'duplicate' };

    const parsed = resendWebhookEventSchema.safeParse(raw);
    const eventType = parsed.success ? parsed.data.type : 'unreadable';
    const log = await this.prisma.client.webhookLog.create({
      data: {
        provider: PROVIDER,
        eventType,
        payload: { svixId: messageId, event: raw ?? {} },
      },
    });

    if (!parsed.success) {
      await this.finish(log.id, 'The payload did not match the expected shape');
      return { status: 'ignored' };
    }
    if (!isKnownType(parsed.data.type)) {
      await this.finish(log.id, null);
      return { status: 'ignored' };
    }

    try {
      await this.apply(EMAIL_EVENT_TYPES[parsed.data.type], parsed.data, raw);
      await this.finish(log.id, null);
      return { status: 'processed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook ${messageId} (${eventType}): ${message}`);
      await this.finish(log.id, message);
      // Answer 2xx anyway: the event is stored and can be replayed, and a retry of the same
      // message would be refused as a duplicate.
      return { status: 'ignored' };
    }
  }

  private async apply(
    type: EmailEventType,
    event: { created_at: string; data: { email_id?: string; to?: string | string[]; bounce?: { type?: string } } },
    raw: unknown,
  ): Promise<void> {
    const occurredAt = Number.isNaN(Date.parse(event.created_at)) ? new Date() : new Date(event.created_at);
    const providerId = event.data.email_id ?? null;
    const to = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;

    const recipient = providerId
      ? await this.prisma.client.campaignRecipient.findFirst({
          where: { providerId },
          select: { id: true, email: true, subscriberId: true },
        })
      : null;
    const email = (recipient?.email ?? to ?? '').toLowerCase();
    if (!email) return;

    await this.prisma.client.emailEvent.create({
      data: { providerId, email, type, payload: raw ?? {}, occurredAt },
    });

    if (recipient) {
      const column = {
        delivered: 'deliveredAt',
        opened: 'openedAt',
        clicked: 'clickedAt',
        bounced: 'bouncedAt',
        complained: 'complainedAt',
      } as const satisfies Record<EmailEventType, keyof Prisma.CampaignRecipientUpdateInput>;
      await this.prisma.client.campaignRecipient.updateMany({
        where: { id: recipient.id, [column[type]]: null },
        data: { [column[type]]: occurredAt },
      });
    }

    if (type === 'opened' || type === 'clicked') {
      await this.prisma.client.subscriber.updateMany({
        where: {
          email: { equals: email, mode: 'insensitive' },
          OR: [{ lastEngagedAt: null }, { lastEngagedAt: { lt: occurredAt } }],
        },
        data: { lastEngagedAt: occurredAt },
      });
    }

    const transient = type === 'bounced' && event.data.bounce?.type?.toLowerCase() === 'transient';
    if ((type === 'bounced' && !transient) || type === 'complained') {
      await this.suppress(email, type === 'bounced' ? 'hard_bounce' : 'complaint');
    }
  }

  private async suppress(email: string, reason: 'hard_bounce' | 'complaint'): Promise<void> {
    const existing = await this.prisma.client.suppression.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!existing) await this.prisma.client.suppression.create({ data: { email, reason } });
  }

  private async finish(logId: string, error: string | null): Promise<void> {
    await this.prisma.client.webhookLog.update({
      where: { id: logId },
      data: { processed: error === null, error: error?.slice(0, 1000) ?? null },
    });
  }
}

/**
 * `POST /webhooks/resend`, public and signed. Reached at `/api/webhooks/resend` on the site
 * origin; that is the address to give Resend. Nothing is read or written until the signature
 * checks out against `RESEND_WEBHOOK_SECRET`.
 */
@Controller('webhooks')
export class ResendWebhookController {
  constructor(
    private readonly webhooks: ResendWebhookService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Post('resend')
  @HttpCode(200)
  // Resend delivers in bursts after a large send; the signature is the real gate.
  @Throttle({ default: { limit: 1200, ttl: 60_000 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') id: string | undefined,
    @Headers('svix-timestamp') timestamp: string | undefined,
    @Headers('svix-signature') signature: string | undefined,
  ): Promise<WebhookOutcome> {
    const secret = this.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException({ error: 'webhook_not_configured' });
    const body = request.rawBody;
    if (!body || !id || !verifySignature(secret, { id, timestamp, signature, body })) {
      throw new UnauthorizedException({ error: 'bad_signature' });
    }
    const payload: unknown = request.body;
    return this.webhooks.receive(id, payload);
  }
}

@Module({
  controllers: [ResendWebhookController],
  providers: [ResendWebhookService],
})
export class WebhooksModule {}
