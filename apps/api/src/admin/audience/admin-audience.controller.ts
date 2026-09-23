import {
  type AdminSegment,
  type AdminSegmentList,
  type AdminSubscriber,
  type AdminSubscriberList,
  type AdminSubscriberQuery,
  type AdminSuppressionList,
  type AdminSuppressionQuery,
  type SegmentPreview,
  type SegmentPreviewRequest,
  type SegmentWrite,
  type SubscriberTagsUpdate,
  type Suppression,
  type SuppressionCreate,
  adminSubscriberQuerySchema,
  adminSuppressionQuerySchema,
  segmentPreviewRequestSchema,
  segmentWriteSchema,
  subscriberTagsUpdateSchema,
  suppressionCreateSchema,
} from '@calwebtech/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminAudienceService } from './admin-audience.service';

/**
 * Subscribers and their tags (docs/12-admin-dashboard.md, module 4).
 *
 * There is no create and no delete. A subscriber is somebody who gave consent on the site,
 * so the dashboard cannot invent one; and deleting one would lose the record that they
 * consented, and when.
 */
@Controller('admin/subscribers')
@UseGuards(AdminGuard)
export class AdminSubscribersController {
  constructor(private readonly audience: AdminAudienceService) {}

  @Get()
  @RequireModule('subscribers', 'read')
  list(@Query(new ZodValidationPipe(adminSubscriberQuerySchema)) query: AdminSubscriberQuery): Promise<AdminSubscriberList> {
    return this.audience.listSubscribers(query);
  }

  @Get(':id')
  @RequireModule('subscribers', 'read')
  detail(@Param('id') id: string): Promise<AdminSubscriber> {
    return this.audience.findSubscriber(id);
  }

  @Put(':id/tags')
  @RequireModule('subscribers')
  setTags(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(subscriberTagsUpdateSchema)) body: SubscriberTagsUpdate,
    @Req() request: AdminRequest,
  ): Promise<AdminSubscriber> {
    return this.audience.setTags(id, body, requireAuth(request).user.id);
  }
}

/** Segments: saved rule sets, counted live and evaluated again at send time. */
@Controller('admin/segments')
@UseGuards(AdminGuard)
export class AdminSegmentsController {
  constructor(private readonly audience: AdminAudienceService) {}

  @Get()
  @RequireModule('subscribers', 'read')
  list(): Promise<AdminSegmentList> {
    return this.audience.listSegments();
  }

  /**
   * The live count while a segment is being built. A POST because the rule set is a body,
   * but it writes nothing, so reading access is enough.
   */
  @Post('preview')
  @HttpCode(200)
  @RequireModule('subscribers', 'read')
  preview(@Body(new ZodValidationPipe(segmentPreviewRequestSchema)) body: SegmentPreviewRequest): Promise<SegmentPreview> {
    return this.audience.preview(body.rules);
  }

  @Get(':id')
  @RequireModule('subscribers', 'read')
  detail(@Param('id') id: string): Promise<AdminSegment> {
    return this.audience.findSegment(id);
  }

  @Post()
  @RequireModule('subscribers')
  create(
    @Body(new ZodValidationPipe(segmentWriteSchema)) body: SegmentWrite,
    @Req() request: AdminRequest,
  ): Promise<AdminSegment> {
    return this.audience.createSegment(body, requireAuth(request).user.id);
  }

  @Patch(':id')
  @RequireModule('subscribers')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(segmentWriteSchema)) body: SegmentWrite,
    @Req() request: AdminRequest,
  ): Promise<AdminSegment> {
    return this.audience.updateSegment(id, body, requireAuth(request).user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireModule('subscribers')
  remove(@Param('id') id: string, @Req() request: AdminRequest): Promise<void> {
    return this.audience.deleteSegment(id, requireAuth(request).user.id);
  }
}

/**
 * The suppression list. Addresses can be added by hand; none can be removed from here,
 * because the list is the promise that an unsubscribe is kept.
 */
@Controller('admin/suppressions')
@UseGuards(AdminGuard)
export class AdminSuppressionsController {
  constructor(private readonly audience: AdminAudienceService) {}

  @Get()
  @RequireModule('subscribers', 'read')
  list(@Query(new ZodValidationPipe(adminSuppressionQuerySchema)) query: AdminSuppressionQuery): Promise<AdminSuppressionList> {
    return this.audience.listSuppressions(query);
  }

  @Post()
  @RequireModule('subscribers')
  add(
    @Body(new ZodValidationPipe(suppressionCreateSchema)) body: SuppressionCreate,
    @Req() request: AdminRequest,
  ): Promise<Suppression> {
    return this.audience.addSuppression(body, requireAuth(request).user.id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminSubscribersController, AdminSegmentsController, AdminSuppressionsController],
  providers: [AdminAudienceService],
  exports: [AdminAudienceService],
})
export class AdminAudienceModule {}
