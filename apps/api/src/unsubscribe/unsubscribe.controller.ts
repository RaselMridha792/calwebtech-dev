import { maskEmail, unsubscribeViewSchema, type UnsubscribeView } from '@calwebtech/shared';
import { usableSigningSecret, verifyUnsubscribeToken } from '@calwebtech/shared/unsubscribe-token';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditService } from '../auth/audit.service';
import { AuthModule } from '../auth/auth.controller';
import { API_ENV, type ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unsubscribing from campaigns (Task 5.4).
 *
 * The link in a campaign's footer opens `/unsubscribe/<token>/` on the site, which reads and
 * confirms through here; the `List-Unsubscribe` header points a mail client's one-click
 * button straight at `POST /unsubscribe/<token>` (RFC 8058), which needs no page and no
 * cookie. The token is the only thing that can stop mail to an address, and it can do
 * nothing else.
 *
 * Unsubscribing marks the subscriber and puts the address on the suppression list, so no
 * later segment, campaign or import reaches it again. It is idempotent: a second click, or
 * a mail client that posts twice, changes nothing.
 */
@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private async subscriber(token: string) {
    const secret = usableSigningSecret(this.env.AUTH_SECRET);
    if (!secret) throw new ServiceUnavailableException({ error: 'unsubscribe_unavailable' });
    const subscriberId = verifyUnsubscribeToken(token, secret);
    const subscriber = subscriberId
      ? await this.prisma.client.subscriber.findUnique({
          where: { id: subscriberId },
          select: { id: true, email: true, unsubscribedAt: true },
        })
      : null;
    if (!subscriber) throw new NotFoundException({ error: 'unsubscribe_link_unknown' });
    return subscriber;
  }

  async view(token: string): Promise<UnsubscribeView> {
    const subscriber = await this.subscriber(token);
    return unsubscribeViewSchema.parse({ email: maskEmail(subscriber.email), unsubscribed: subscriber.unsubscribedAt !== null });
  }

  async unsubscribe(token: string): Promise<UnsubscribeView> {
    const subscriber = await this.subscriber(token);
    const email = subscriber.email.toLowerCase();

    await this.prisma.client.$transaction(async (tx) => {
      if (!subscriber.unsubscribedAt) {
        await tx.subscriber.update({ where: { id: subscriber.id }, data: { unsubscribedAt: new Date() } });
      }
      const suppressed = await tx.suppression.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!suppressed) await tx.suppression.create({ data: { email, reason: 'unsubscribe' } });
    });

    if (!subscriber.unsubscribedAt) {
      await this.audit.recordQuietly({
        userId: null,
        action: 'subscriber.unsubscribed',
        entityType: 'Subscriber',
        entityId: subscriber.id,
        after: { via: 'link' },
      });
    }
    return unsubscribeViewSchema.parse({ email: maskEmail(subscriber.email), unsubscribed: true });
  }
}

/**
 * Public, and deliberately outside the admin guard. The web server reads and posts on a
 * visitor's behalf from one address, as it does for the homepage, so the limit here is
 * generous; the token itself is what cannot be guessed.
 */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribes: UnsubscribeService) {}

  @Get(':token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  view(@Param('token') token: string): Promise<UnsubscribeView> {
    return this.unsubscribes.view(token);
  }

  /** Also the one-click target: a mail client posts `List-Unsubscribe=One-Click` here. */
  @Post(':token')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  unsubscribe(@Param('token') token: string): Promise<UnsubscribeView> {
    return this.unsubscribes.unsubscribe(token);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [UnsubscribeController],
  providers: [UnsubscribeService],
})
export class UnsubscribeModule {}
