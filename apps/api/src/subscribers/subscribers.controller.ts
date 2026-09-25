import {
  SUBSCRIBE_ERRORS,
  subscribeSubmissionSchema,
  type SubscribeResult,
  type SubscribeSubmission,
} from '@calwebtech/shared';
import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Injectable, Ip, Logger, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@calwebtech/db';
import { submissionGuardProvider } from '../antispam/antispam.provider';
import { SubmissionGuard } from '../antispam/submission-guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { refuseUnlessPlausible } from '../leads/leads.service';
import { API_ENV, type ApiEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TurnstileService } from '../turnstile/turnstile.service';

const SUBSCRIBED: SubscribeResult = { status: 'subscribed' };

/**
 * Subscribing from the website (docs/08-decisions.md, 53): where `Subscriber` rows come from.
 *
 * Three rules decide everything below.
 *
 * - **The answer is always the same.** New, already subscribed, unsubscribed, suppressed: the
 *   visitor is told they are subscribed. Otherwise a public form is a way to ask whether
 *   somebody else's address is on a list, or whether they once asked to be left alone.
 * - **Suppression is never lifted from here.** The form is unauthenticated and sends nothing to
 *   confirm the address, so anyone can type anyone's address into it. If that could re-enable
 *   an address that had unsubscribed, or bounced, or complained, a stranger could undo a
 *   person's request to be left alone. An unsubscribed or suppressed address is left exactly as
 *   it is; only the owner decides who may lift a suppression (decision 49).
 * - **Nothing already stored is overwritten.** A subscriber who exists keeps their original
 *   consent time, address and source page: the first consent is the record.
 */
@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly guard: SubmissionGuard,
  ) {}

  async subscribe(input: SubscribeSubmission, visitorIp: string | undefined): Promise<SubscribeResult> {
    // A filled honeypot is a bot. It is told it worked, so it learns nothing to adjust to.
    if (input.referenceCode) {
      this.logger.warn('Honeypot filled on the subscribe form; submission discarded');
      return SUBSCRIBED;
    }

    // A form sent faster than a person could is told to try again; a throwaway inbox or a
    // domain that cannot receive mail is named under the field (docs/08-decisions.md, 61).
    await refuseUnlessPlausible(this.guard, 'subscribe', input.email, input.formElapsedMs);

    const botCheck = await this.turnstile.verify(input.turnstileToken, visitorIp);
    if (botCheck === 'failed') throw new ForbiddenException({ error: SUBSCRIBE_ERRORS.botCheckFailed });

    // Over the address's limit: the same answer as always, and nothing written. Subscribing
    // twice changes nothing anyway, so there is nothing to tell.
    if (!(await this.guard.withinLimit('subscribe', input.email))) return SUBSCRIBED;

    const email = input.email;
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const existing = await tx.subscriber.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        });
        // Already here, in whatever state. Nothing to add, and nothing to undo.
        if (existing) return;

        // The same person as a lead or a booking, when they have been either: one Contact per address.
        const contact = await tx.contact.upsert({ where: { email }, create: { email }, update: {} });
        await tx.subscriber.create({
          data: {
            email,
            contactId: contact.id,
            sourcePage: input.sourcePage,
            consentAt: new Date(),
            consentIp: visitorIp ?? null,
          },
        });
      });
    } catch (error) {
      // Two people subscribing the same address in the same instant: the unique constraint
      // settles it, and the loser is exactly as subscribed as the winner.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return SUBSCRIBED;
      throw error;
    }
    return SUBSCRIBED;
  }
}

/**
 * Public. Five a minute per visitor address: the web server posts on the visitor's behalf and
 * forwards their address, as it does for a booking, and a subscription costs nobody anything
 * but a row, so this is a limit against a loop rather than a quota.
 */
@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribers: SubscribersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(
    @Body(new ZodValidationPipe(subscribeSubmissionSchema)) body: SubscribeSubmission,
    @Ip() visitorIp: string,
  ): Promise<SubscribeResult> {
    return this.subscribers.subscribe(body, visitorIp);
  }
}

@Module({
  controllers: [SubscribersController],
  providers: [
    SubscribersService,
    submissionGuardProvider,
    {
      provide: TurnstileService,
      useFactory: (env: ApiEnv) => new TurnstileService(env.TURNSTILE_SECRET ?? ''),
      inject: [API_ENV],
    },
  ],
})
export class SubscribersModule {}
