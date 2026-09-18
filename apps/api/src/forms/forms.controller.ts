import {
  formsProjectDraftSchema,
  type FormsAuditView,
  type FormsProjectDraft,
  type FormsProjectDraftResult,
  type FormsProjectView,
} from '@calwebtech/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Module, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FormsService } from './forms.service';

/**
 * The forms family's views (docs/10-site-pages.md). GET only and not rate limited: every
 * page render calls these from the web server's single address, and repeated calls are
 * served from the service's short cache.
 */
@Controller('pages')
@SkipThrottle()
export class FormsPagesController {
  constructor(private readonly pages: FormsService) {}

  @Get('start-a-project')
  startProject(): Promise<FormsProjectView> {
    return this.pages.startProject();
  }

  @Get('free-website-audit')
  freeWebsiteAudit(): Promise<FormsAuditView> {
    return this.pages.freeWebsiteAudit();
  }
}

/**
 * Progressive saving for the start a project brief. Unlike the page views this one writes,
 * so it is rate limited per visitor IP: a brief is saved once per step, and twenty a minute
 * is well above what a person filling one in can produce.
 *
 * Turnstile guards the final submit (`POST /leads`), not this: a token may be spent once,
 * and the widget would have to be reset on every step. A saved brief is one row per visitor,
 * carries the honeypot and stores nothing an unfinished form did not already show us.
 */
@Controller('forms')
export class FormsDraftController {
  constructor(private readonly forms: FormsService) {}

  @Post('project-draft')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  saveProjectDraft(
    @Body(new ZodValidationPipe(formsProjectDraftSchema)) body: FormsProjectDraft,
  ): Promise<FormsProjectDraftResult> {
    return this.forms.saveProjectDraft(body);
  }
}

@Module({ controllers: [FormsPagesController, FormsDraftController], providers: [FormsService] })
export class FormsModule {}
