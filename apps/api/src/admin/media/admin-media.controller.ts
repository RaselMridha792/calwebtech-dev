import {
  MEDIA_MAX_BYTES,
  adminMediaQuerySchema,
  mediaAltUpdateSchema,
  type AdminMediaAsset,
  type AdminMediaList,
  type AdminMediaQuery,
  type MediaAltUpdate,
} from '@calwebtech/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard, RequireModule } from '../../auth/admin.guard';
import type { AdminRequest } from '../../auth/admin-request';
import { requireAuth } from '../../auth/admin-request';
import { AuthModule } from '../../auth/auth.controller';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { Actor } from '../leads/admin-leads.service';
import { AdminMediaService } from './admin-media.service';

/** What multer hands over once the file is in memory. */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * The media library (docs/12-admin-dashboard.md, module 7).
 *
 * Uploads are held in memory rather than written to a temporary file: the limit is 12 MB,
 * sharp reads from a buffer anyway, and a temporary file left behind by a failed request is
 * one more thing to clean up. The files themselves are served by the static handler in
 * main.ts, not from here — an image should not pay for a router.
 */
@Controller('admin/media')
@UseGuards(AdminGuard)
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}

  private actor(request: AdminRequest, ip: string): Actor {
    return { id: requireAuth(request).user.id, ip };
  }

  @Get()
  @RequireModule('media', 'read')
  list(@Query(new ZodValidationPipe(adminMediaQuerySchema)) query: AdminMediaQuery): Promise<AdminMediaList> {
    return this.media.list(query);
  }

  @Get(':id')
  @RequireModule('media', 'read')
  async detail(@Param('id') id: string): Promise<AdminMediaAsset> {
    const asset = await this.media.detail(id);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  /**
   * `alt` travels as a form field beside the file, so the description and the image arrive
   * together and the library never holds an image nobody has described.
   */
  @Post()
  @RequireModule('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedImage | undefined,
    @Body('altText') altText: string | undefined,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminMediaAsset> {
    if (!file) throw new BadRequestException({ error: 'validation_failed', fieldErrors: { file: ['Choose a file'] } });
    return this.media.upload(file, altText ?? '', this.actor(request, ip));
  }

  @Patch(':id')
  @RequireModule('media')
  updateAlt(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(mediaAltUpdateSchema)) body: MediaAltUpdate,
    @Req() request: AdminRequest,
    @Ip() ip: string,
  ): Promise<AdminMediaAsset> {
    return this.media.updateAlt(id, body.altText, this.actor(request, ip));
  }

  /** 409 with the list of records still pointing at it, rather than a silent broken image. */
  @Delete(':id')
  @RequireModule('media')
  remove(@Param('id') id: string, @Req() request: AdminRequest, @Ip() ip: string): Promise<{ deleted: true }> {
    return this.media.remove(id, this.actor(request, ip));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminMediaController],
  providers: [AdminMediaService],
})
export class AdminMediaModule {}
