import {
  caseStudyInputSchema,
  type AdminCaseStudyDetail,
  type AdminCaseStudyList,
  type CaseStudyInput,
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
import { AdminCaseStudiesService } from './admin-case-studies.service';

/**
 * Case studies in the admin (docs/14-remaining-work.md, task 4). Everything needs
 * `content: full` to change and `content: read` to look, as services do.
 */
@Controller('admin/case-studies')
@UseGuards(AdminGuard)
export class AdminCaseStudiesController {
  constructor(private readonly caseStudies: AdminCaseStudiesService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('content', 'read')
  list(): Promise<AdminCaseStudyList> {
    return this.caseStudies.list();
  }

  @Get(':id')
  @RequireModule('content', 'read')
  async detail(@Param('id') id: string): Promise<AdminCaseStudyDetail> {
    const caseStudy = await this.caseStudies.detail(id);
    if (!caseStudy) throw new NotFoundException();
    return caseStudy;
  }

  /** Always created as a draft. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('content')
  create(
    @Body(new ZodValidationPipe(caseStudyInputSchema)) body: CaseStudyInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminCaseStudyDetail> {
    return this.caseStudies.create(body, this.actor(request, ip));
  }

  /** 409 when the slug is taken. A published slug that moves leaves a 301 behind. */
  @Patch(':id')
  @RequireModule('content')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(caseStudyInputSchema)) body: CaseStudyInput,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminCaseStudyDetail> {
    return this.caseStudies.update(id, body, this.actor(request, ip));
  }

  /** 409 with the reason while the page could not render: fewer than three figures. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  publish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminCaseStudyDetail> {
    return this.caseStudies.publish(id, this.actor(request, ip));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequireModule('content')
  unpublish(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminCaseStudyDetail> {
    return this.caseStudies.unpublish(id, this.actor(request, ip));
  }

  @Delete(':id')
  @RequireModule('content')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<{ deleted: true }> {
    return this.caseStudies.remove(id, this.actor(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminCaseStudiesController],
  providers: [AdminCaseStudiesService],
})
export class AdminCaseStudiesModule {}
