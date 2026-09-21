import {
  adminAuditQuerySchema,
  adminSettingKeySchema,
  settingUpdateSchema,
  teamCreateSchema,
  teamRoleUpdateSchema,
  type AdminAuditList,
  type AdminAuditQuery,
  type AdminSettingsView,
  type AdminTeamView,
  type SettingUpdate,
  type TeamCreate,
  type TeamCreated,
  type TeamRoleUpdate,
} from '@calwebtech/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Module,
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
import type { Actor } from '../leads/admin-leads.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminTeamService } from './admin-team.service';

/**
 * Settings, the audit log, and team and roles (docs/12-admin-dashboard.md, M2): the three
 * screens that let the site be operated without SSH.
 *
 * All three are owner-only, which `AdminGuard` enforces from the shared permission matrix
 * rather than from anything written here.
 */
function actorOf(request: AdminRequest, ip: string): Actor {
  return { id: requireAuth(request).user.id, ip };
}

@Controller('admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  @RequireModule('settings', 'read')
  list(): Promise<AdminSettingsView> {
    return this.settings.list();
  }

  /** The key is a dotted name such as `site.contact`, and must be one the screen may set. */
  @Patch(':key')
  @RequireModule('settings')
  update(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(settingUpdateSchema)) body: SettingUpdate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminSettingsView> {
    const parsed = adminSettingKeySchema.safeParse(key);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'validation_failed', fieldErrors: { key: ['Not a setting this screen may change'] } });
    }
    return this.settings.update(parsed.data, body.value, actorOf(request, ip));
  }
}

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  /** Read-only: there is no route here that writes or removes an entry, deliberately. */
  @Get()
  @RequireModule('auditLog', 'read')
  list(@Query(new ZodValidationPipe(adminAuditQuerySchema)) query: AdminAuditQuery): Promise<AdminAuditList> {
    return this.audit.list(query);
  }
}

@Controller('admin/team')
@UseGuards(AdminGuard)
export class AdminTeamController {
  constructor(private readonly team: AdminTeamService) {}

  @Get()
  @RequireModule('team', 'read')
  list(@Req() request: AdminRequest): Promise<AdminTeamView> {
    return this.team.list(requireAuth(request).user.id);
  }

  /** 201 with a first password, shown once. 409 when the address already has an account. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireModule('team')
  create(
    @Body(new ZodValidationPipe(teamCreateSchema)) body: TeamCreate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<TeamCreated> {
    return this.team.create(body, actorOf(request, ip));
  }

  @Patch(':id/role')
  @RequireModule('team')
  changeRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(teamRoleUpdateSchema)) body: TeamRoleUpdate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminTeamView> {
    return this.team.changeRole(id, body.role, actorOf(request, ip));
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @RequireModule('team')
  disable(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminTeamView> {
    return this.team.disable(id, actorOf(request, ip));
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @RequireModule('team')
  enable(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminTeamView> {
    return this.team.enable(id, actorOf(request, ip));
  }

  /** Signs someone out everywhere without touching their account. */
  @Post(':id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @RequireModule('team')
  revokeSessions(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<AdminTeamView> {
    return this.team.revokeSessions(id, actorOf(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminSettingsController, AdminAuditController, AdminTeamController],
  providers: [AdminSettingsService, AdminAuditService, AdminTeamService],
})
export class AdminOpsModule {}
