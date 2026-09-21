import {
  serviceInputSchema,
  servicePublishSchema,
  type AdminServiceDetail,
  type AdminServiceList,
  type ServiceInput,
  type ServicePublish,
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
import { AdminServicesService } from './admin-services.service';

/**
 * Services in the admin (docs/12-admin-dashboard.md, M4) — the milestone that lets a
 * non-developer publish a service page, which `CLAUDE.md` calls the bar for the task being
 * done at all.
 *
 * Everything here needs `content: full`, so an EDITOR reaches it and a SALES role does not.
 */
@Controller('admin/services')
@UseGuards(AdminGuard)
export class AdminServicesController {
  constructor(private readonly services: AdminServicesService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('content', 'read')
  list(): Promise<AdminServiceList> {
    return this.services.list();
  }

  @Get(':id')
  @RequireModule('content', 'read')
  async detail(@Param('id') id: string): Promise<AdminServiceDetail> {
    const service = await this.services.detail(id);
    if (!service) throw new NotFoundException();
    return service;
  }

  /** Always created as a draft, so a half-written page can never reach the site. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('content')
  create(
    @Body(new ZodValidationPipe(serviceInputSchema)) body: ServiceInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminServiceDetail> {
    return this.services.create(body, this.actor(request, ip));
  }

  /** 409 when the slug is taken. A published slug that moves leaves a 301 behind. */
  @Patch(':id')
  @RequireModule('content')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(serviceInputSchema)) body: ServiceInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminServiceDetail> {
    return this.services.update(id, body, this.actor(request, ip));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  publish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(servicePublishSchema)) body: ServicePublish,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminServiceDetail> {
    return this.services.publish(id, body.publishedAt, this.actor(request, ip));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  unpublish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminServiceDetail> {
    return this.services.unpublish(id, this.actor(request, ip));
  }

  @Delete(':id')
  @RequireModule('content')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<{ deleted: true }> {
    return this.services.remove(id, this.actor(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminServicesController],
  providers: [AdminServicesService],
})
export class AdminServicesModule {}
