import { slugSchema, type ServiceDetailView, type ServicesIndexView } from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServicesService } from './services.service';

/**
 * `/services/` and `/services/<slug>/`. Not rate limited: every render calls these from the
 * web server's single address, and repeated calls are served from the service's short cache.
 */
@Controller('pages/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @SkipThrottle()
  findIndex(): Promise<ServicesIndexView> {
    return this.services.findIndex();
  }

  /** 400 for a malformed slug, 404 when no such service is published. */
  @Get(':slug')
  @SkipThrottle()
  async findBySlug(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<ServiceDetailView> {
    const page = await this.services.findBySlug(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

@Module({ controllers: [ServicesController], providers: [ServicesService] })
export class ServicesModule {}
