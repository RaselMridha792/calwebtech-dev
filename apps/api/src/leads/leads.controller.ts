import { leadSubmissionSchema, type LeadReceived, type LeadSubmission } from '@calwebtech/shared';
import { Body, Controller, HttpCode, HttpStatus, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Five submissions a minute per visitor IP. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @Body(new ZodValidationPipe(leadSubmissionSchema)) body: LeadSubmission,
  ): Promise<LeadReceived> {
    return this.leads.create(body);
  }
}

@Module({ controllers: [LeadsController], providers: [LeadsService] })
export class LeadsModule {}
