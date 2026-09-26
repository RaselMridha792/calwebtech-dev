import {
  industryInputSchema,
  type AdminIndustryDetail,
  type AdminIndustryList,
  type IndustryInput,
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
import { AdminIndustriesService } from './admin-industries.service';

/**
 * Industries in the admin (docs/14-remaining-work.md, task 4). Everything needs
 * `content: full` to change and `content: read` to look, as services do.
 */
@Controller('admin/industries')
@UseGuards(AdminGuard)
export class AdminIndustriesController {
  constructor(private readonly industries: AdminIndustriesService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('content', 'read')
  list(): Promise<AdminIndustryList> {
    return this.industries.list();
  }

  @Get(':id')
  @RequireModule('content', 'read')
  async detail(@Param('id') id: string): Promise<AdminIndustryDetail> {
    const industry = await this.industries.detail(id);
    if (!industry) throw new NotFoundException();
    return industry;
  }

  /** Always created as a draft. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('content')
  create(
    @Body(new ZodValidationPipe(industryInputSchema)) body: IndustryInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminIndustryDetail> {
    return this.industries.create(body, this.actor(request, ip));
  }

  /** 409 when the slug is taken. A published slug that moves leaves a 301 behind. */
  @Patch(':id')
  @RequireModule('content')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(industryInputSchema)) body: IndustryInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminIndustryDetail> {
    return this.industries.update(id, body, this.actor(request, ip));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  publish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminIndustryDetail> {
    return this.industries.publish(id, this.actor(request, ip));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  unpublish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminIndustryDetail> {
    return this.industries.unpublish(id, this.actor(request, ip));
  }

  @Delete(':id')
  @RequireModule('content')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<{ deleted: true }> {
    return this.industries.remove(id, this.actor(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminIndustriesController],
  providers: [AdminIndustriesService],
})
export class AdminIndustriesModule {}
