import {
  adminLeadQuerySchema,
  leadBulkSchema,
  leadNoteCreateSchema,
  leadPipelineUpdateSchema,
  type AdminLeadDetail,
  type AdminLeadFilterOptions,
  type AdminLeadList,
  type AdminLeadQuery,
  type LeadBulk,
  type LeadNoteCreate,
  type LeadPipelineUpdate,
} from '@calwebtech/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Ip,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminLeadsService, type Actor } from './admin-leads.service';

/**
 * The leads inbox (docs/12-admin-dashboard.md, module 2).
 *
 * Every route is behind `AdminGuard`, which refuses anything without a `@RequireModule`,
 * so adding a route here without declaring its module closes it rather than opening it.
 * Reads need `leads: read`, writes need `leads: full`, and the export needs the separate
 * `export` module a VIEWER does not reach.
 */
@Controller('admin/leads')
@UseGuards(AdminGuard)
export class AdminLeadsController {
  constructor(private readonly leads: AdminLeadsService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('leads', 'read')
  list(
    @Query(new ZodValidationPipe(adminLeadQuerySchema)) query: AdminLeadQuery,
    @Req() request: AdminRequest,
  ): Promise<AdminLeadList> {
    return this.leads.list(query, requireAuth(request).user.id);
  }

  /**
   * What the filter bar's selects offer. A literal path, so it is declared before `:id` or
   * it would be read as a lead with that id.
   */
  @Get('filter-options')
  @RequireModule('leads', 'read')
  filterOptions(): Promise<AdminLeadFilterOptions> {
    return this.leads.filterOptions();
  }

  /** The current filter as a CSV download. Also a literal path, for the same reason. */
  @Get('export')
  @RequireModule('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leads.csv"')
  exportCsv(
    @Query(new ZodValidationPipe(adminLeadQuerySchema)) query: AdminLeadQuery,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<string> {
    return this.leads.exportCsv(query, this.actor(request, ip));
  }

  /** One status or owner change applied to the listing's selection. */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @RequireModule('leads')
  bulk(
    @Body(new ZodValidationPipe(leadBulkSchema)) body: LeadBulk,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<{ updated: number }> {
    return this.leads.bulk(body, this.actor(request, ip));
  }

  @Get(':id')
  @RequireModule('leads', 'read')
  async detail(@Param('id') id: string): Promise<AdminLeadDetail> {
    const lead = await this.leads.detail(id);
    if (!lead) throw new NotFoundException();
    return lead;
  }

  /**
   * Status, owner and next action date save together, as one pipeline change. 409 when the
   * status moved under the panel since it was opened.
   */
  @Patch(':id/pipeline')
  @RequireModule('leads')
  updatePipeline(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(leadPipelineUpdateSchema)) body: LeadPipelineUpdate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminLeadDetail> {
    return this.leads.updatePipeline(id, body, this.actor(request, ip));
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('leads')
  addNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(leadNoteCreateSchema)) body: LeadNoteCreate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminLeadDetail> {
    return this.leads.addNote(id, body, this.actor(request, ip));
  }
}

@Module({
  // AuthModule provides the guard, the audit service and sessions.
  imports: [AuthModule],
  controllers: [AdminLeadsController],
  providers: [AdminLeadsService],
})
export class AdminLeadsModule {}
