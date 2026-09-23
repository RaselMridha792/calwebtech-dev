import {
  type AdminCampaign,
  type AdminCampaignList,
  type AdminCampaignQuery,
  type CampaignPreview,
  type CampaignPreviewRequest,
  type CampaignTestSend,
  type CampaignTestSent,
  type CampaignWrite,
  adminCampaignQuerySchema,
  campaignPreviewRequestSchema,
  campaignTestSendSchema,
  campaignWriteSchema,
} from '@calwebtech/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { API_ENV, type ApiEnv } from '../../config/env';
import { EmailQueue } from '../../queue/email-queue';
import { AdminAudienceModule } from '../audience/admin-audience.controller';
import { AdminCampaignsService } from './admin-campaigns.service';

/**
 * Campaigns (docs/12-admin-dashboard.md, module 5; Task 5.4): the list, the composer's
 * reads and writes, the preview and the test send.
 */
@Controller('admin/campaigns')
@UseGuards(AdminGuard)
export class AdminCampaignsController {
  constructor(private readonly campaigns: AdminCampaignsService) {}

  @Get()
  @RequireModule('campaigns', 'read')
  list(@Query(new ZodValidationPipe(adminCampaignQuerySchema)) query: AdminCampaignQuery): Promise<AdminCampaignList> {
    return this.campaigns.list(query);
  }

  /** Renders, writes nothing: reading access is enough. Declared above `:id`. */
  @Post('preview')
  @HttpCode(200)
  @RequireModule('campaigns', 'read')
  preview(@Body(new ZodValidationPipe(campaignPreviewRequestSchema)) body: CampaignPreviewRequest): Promise<CampaignPreview> {
    return this.campaigns.preview(body);
  }

  @Get(':id')
  @RequireModule('campaigns', 'read')
  detail(@Param('id') id: string): Promise<AdminCampaign> {
    return this.campaigns.find(id);
  }

  @Post()
  @RequireModule('campaigns')
  create(
    @Body(new ZodValidationPipe(campaignWriteSchema)) body: CampaignWrite,
    @Req() request: AdminRequest,
  ): Promise<AdminCampaign> {
    return this.campaigns.create(body, requireAuth(request).user.id);
  }

  @Patch(':id')
  @RequireModule('campaigns')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(campaignWriteSchema)) body: CampaignWrite,
    @Req() request: AdminRequest,
  ): Promise<AdminCampaign> {
    return this.campaigns.update(id, body, requireAuth(request).user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireModule('campaigns')
  remove(@Param('id') id: string, @Req() request: AdminRequest): Promise<void> {
    return this.campaigns.remove(id, requireAuth(request).user.id);
  }

  /** A few tests a minute is plenty for a person checking a layout, and caps a mistake. */
  @Post(':id/test')
  @HttpCode(202)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @RequireModule('campaigns')
  sendTest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(campaignTestSendSchema)) body: CampaignTestSend,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<CampaignTestSent> {
    return this.campaigns.sendTest(id, body, requireAuth(request).user, ip);
  }
}

@Module({
  imports: [AuthModule, AdminAudienceModule],
  controllers: [AdminCampaignsController],
  providers: [
    AdminCampaignsService,
    {
      provide: EmailQueue,
      useFactory: (env: ApiEnv) => new EmailQueue(env.REDIS_URL),
      inject: [API_ENV],
    },
  ],
})
export class AdminCampaignsModule {}
