import {
  comparisonInputSchema,
  type AdminComparisonDetail,
  type AdminComparisonList,
  type ComparisonInput,
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
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { Actor } from '../leads/admin-leads.service';
import { AdminComparisonsService } from './admin-comparisons.service';

/**
 * `/before-and-after/`'s comparisons in the admin (decision 70). Everything needs
 * `content: full` to change and `content: read` to look, as the other content editors do.
 */
@Controller('admin/comparisons')
@UseGuards(AdminGuard)
export class AdminComparisonsController {
  constructor(private readonly comparisons: AdminComparisonsService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('content', 'read')
  list(): Promise<AdminComparisonList> {
    return this.comparisons.list();
  }

  @Get(':id')
  @RequireModule('content', 'read')
  async detail(@Param('id') id: string): Promise<AdminComparisonDetail> {
    const comparison = await this.comparisons.detail(id);
    if (!comparison) throw new NotFoundException();
    return comparison;
  }

  /** Always created as a draft. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('content')
  create(
    @Body(new ZodValidationPipe(comparisonInputSchema)) body: ComparisonInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminComparisonDetail> {
    return this.comparisons.create(body, this.actor(request, ip));
  }

  /** 409 when the chosen case study is gone. */
  @Patch(':id')
  @RequireModule('content')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(comparisonInputSchema)) body: ComparisonInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminComparisonDetail> {
    return this.comparisons.update(id, body, this.actor(request, ip));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  publish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminComparisonDetail> {
    return this.comparisons.publish(id, this.actor(request, ip));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  unpublish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminComparisonDetail> {
    return this.comparisons.unpublish(id, this.actor(request, ip));
  }

  @Delete(':id')
  @RequireModule('content')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<{ deleted: true }> {
    return this.comparisons.remove(id, this.actor(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminComparisonsController],
  providers: [AdminComparisonsService],
})
export class AdminComparisonsModule {}
