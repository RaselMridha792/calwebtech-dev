import { leadSubmissionSchema, type LeadReceived, type LeadSubmission } from '@calwebtech/shared';
import { Body, Controller, HttpCode, HttpStatus, Ip, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { API_ENV, type ApiEnv } from '../config/env';
import { EmailQueue } from '../queue/email-queue';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /**
   * Five submissions a minute per visitor IP. 202 when stored, 400 with field errors,
   * 403 `bot_check_failed` when Turnstile rejects the submission.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @Body(new ZodValidationPipe(leadSubmissionSchema)) body: LeadSubmission,
    // The web app forwards the visitor's address; `trust proxy` makes this that address.
    @Ip() visitorIp: string,
  ): Promise<LeadReceived> {
    return this.leads.create(body, visitorIp);
  }
}

@Module({
  controllers: [LeadsController],
  providers: [
    LeadsService,
    SettingsService,
    {
      provide: TurnstileService,
      useFactory: (env: ApiEnv) => new TurnstileService(env.TURNSTILE_SECRET ?? ''),
      inject: [API_ENV],
    },
    {
      provide: EmailQueue,
      useFactory: (env: ApiEnv) => new EmailQueue(env.REDIS_URL),
      inject: [API_ENV],
    },
  ],
})
export class LeadsModule {}
