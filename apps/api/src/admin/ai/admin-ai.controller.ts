import {
  aiConnectionCreateSchema,
  aiConnectionUpdateSchema,
  aiTestRequestSchema,
  type AdminAiView,
  type AiConnection,
  type AiConnectionCreate,
  type AiConnectionUpdate,
  type AiModelList,
  type AiTestRequest,
  type AiTestResult,
} from '@calwebtech/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Module,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import { requireAuth, type AdminRequest } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { Actor } from '../leads/admin-leads.service';
import { AdminAiService } from './admin-ai.service';

/**
 * AI connections (docs/08-decisions.md, 64). The owner's alone: whoever holds these keys
 * spends the business's money with them, so every route needs the `ai` module, which only
 * the owner reaches. A key is accepted on create and update and returned by nothing.
 */
@Controller('admin/ai')
@UseGuards(AdminGuard)
export class AdminAiController {
  constructor(private readonly ai: AdminAiService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('ai', 'read')
  view(): Promise<AdminAiView> {
    return this.ai.view();
  }

  @Post('connections')
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('ai')
  create(
    @Body(new ZodValidationPipe(aiConnectionCreateSchema)) body: AiConnectionCreate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AiConnection> {
    return this.ai.create(body, this.actor(request, ip));
  }

  @Patch('connections/:id')
  @RequireModule('ai')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(aiConnectionUpdateSchema)) body: AiConnectionUpdate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AiConnection> {
    return this.ai.update(id, body, this.actor(request, ip));
  }

  @Post('connections/:id/default')
  @HttpCode(HttpStatus.OK)
  @RequireModule('ai')
  makeDefault(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminAiView> {
    return this.ai.makeDefault(id, this.actor(request, ip));
  }

  @Delete('connections/:id')
  @RequireModule('ai')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminAiView> {
    return this.ai.remove(id, this.actor(request, ip));
  }

  /** Each test spends the owner's credit with the provider, so it is limited per minute. */
  @Post('connections/:id/test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @RequireModule('ai')
  test(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(aiTestRequestSchema)) body: AiTestRequest,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AiTestResult> {
    return this.ai.test(id, body, this.actor(request, ip));
  }

  /** A POST, not a GET: it opens the key and calls out, which a prefetch must never do. */
  @Post('connections/:id/models')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @RequireModule('ai')
  async models(@Param('id') id: string): Promise<AiModelList> {
    return { models: await this.ai.models(id) };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminAiController],
  providers: [AdminAiService],
  // For the features that will call `complete()` on the default connection.
  exports: [AdminAiService],
})
export class AdminAiModule {}
