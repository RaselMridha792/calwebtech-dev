import {
  pageCopyKeySchema,
  pageCopyUpdateSchema,
  type AdminPageCopyDetail,
  type AdminPageCopyList,
  type PageCopyKey,
} from '@calwebtech/shared';
import { Body, Controller, Get, Ip, Module, NotFoundException, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminPageCopyService } from './admin-page-copy.service';

/**
 * Page copy in the admin (docs/14-remaining-work.md, task 4). Reading needs `content: read`,
 * changing `content: full`, as every other content screen.
 */
@Controller('admin/page-copy')
@UseGuards(AdminGuard)
export class AdminPageCopyController {
  constructor(private readonly copy: AdminPageCopyService) {}

  @Get()
  @RequireModule('content', 'read')
  list(): Promise<AdminPageCopyList> {
    return this.copy.list();
  }

  @Get(':key')
  @RequireModule('content', 'read')
  detail(@Param('key') key: string): Promise<AdminPageCopyDetail> {
    return this.copy.detail(known(key));
  }

  /** 400 with each refused field's path when the page's schema would reject the copy. */
  @Put(':key')
  @RequireModule('content')
  update(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(pageCopyUpdateSchema)) body: { value?: unknown },
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminPageCopyDetail> {
    return this.copy.update(known(key), body.value, { id: requireAuth(request).user.id, ip });
  }
}

/** A key the screen does not edit is a 404, not a way to write any setting. */
function known(key: string): PageCopyKey {
  const parsed = pageCopyKeySchema.safeParse(key);
  if (!parsed.success) throw new NotFoundException();
  return parsed.data;
}

@Module({
  imports: [AuthModule],
  controllers: [AdminPageCopyController],
  providers: [AdminPageCopyService],
})
export class AdminPageCopyModule {}
