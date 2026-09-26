import type { AdminOverview } from '@calwebtech/shared';
import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import { requireAuth, type AdminRequest } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { SettingsService } from '../../settings/settings.service';
import { AdminOverviewService } from './admin-overview.service';

/**
 * The dashboard's first screen (docs/12-admin-dashboard.md, screen 1). Every role reaches
 * it; what it carries is decided per section by the same matrix as every other route.
 */
@Controller('admin/overview')
@UseGuards(AdminGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  @RequireModule('overview', 'read')
  read(@Req() request: AdminRequest): Promise<AdminOverview> {
    return this.overview.overview(requireAuth(request).user.role);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService, SettingsService],
})
export class AdminOverviewModule {}
