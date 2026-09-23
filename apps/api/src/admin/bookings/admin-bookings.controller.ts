import {
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminBookingUpdate,
  adminBookingQuerySchema,
  adminBookingUpdateSchema,
} from '@calwebtech/shared';
import { Body, Controller, Get, Module, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminBookingsService } from './admin-bookings.service';

/**
 * Bookings in the dashboard (docs/12-admin-dashboard.md).
 *
 * Reading needs `bookings: read`, so a sales role sees the calendar; changing where a
 * call stands needs write on the same module. Nothing here can create or delete a
 * booking: those belong to the visitor who made it and to the cancel link they hold.
 */
@Controller('admin/bookings')
@UseGuards(AdminGuard)
export class AdminBookingsController {
  constructor(private readonly bookings: AdminBookingsService) {}

  @Get()
  @RequireModule('bookings', 'read')
  list(@Query(new ZodValidationPipe(adminBookingQuerySchema)) query: AdminBookingQuery): Promise<AdminBookingList> {
    return this.bookings.list(query);
  }

  @Get(':id')
  @RequireModule('bookings', 'read')
  detail(@Param('id') id: string): Promise<AdminBookingDetail> {
    return this.bookings.find(id);
  }

  @Patch(':id')
  @RequireModule('bookings')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminBookingUpdateSchema)) body: AdminBookingUpdate,
    @Req() request: AdminRequest,
  ): Promise<AdminBookingDetail> {
    return this.bookings.update(id, body, requireAuth(request).user.id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminBookingsController],
  providers: [AdminBookingsService],
})
export class AdminBookingsModule {}
