import { slugSchema, type IndustriesIndexView, type IndustryDetailView } from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IndustriesService } from './industries.service';

/**
 * Public views of `/industries/` and `/industries/<slug>/` (docs/10-site-pages.md). Not rate
 * limited: every render calls these from the web server's single address, and repeated
 * calls are served from the service's short cache.
 */
@Controller('pages/industries')
export class IndustriesController {
  constructor(private readonly industries: IndustriesService) {}

  @Get()
  @SkipThrottle()
  findIndex(): Promise<IndustriesIndexView> {
    return this.industries.findIndex();
  }

  @Get(':slug')
  @SkipThrottle()
  async findPublished(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<IndustryDetailView> {
    const page = await this.industries.findPublished(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

@Module({ controllers: [IndustriesController], providers: [IndustriesService] })
export class IndustriesModule {}
