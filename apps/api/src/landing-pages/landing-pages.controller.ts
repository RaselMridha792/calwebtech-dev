import { slugSchema, type LandingPageView } from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LandingPagesService } from './landing-pages.service';

@Controller('landing-pages')
export class LandingPagesController {
  constructor(private readonly landingPages: LandingPagesService) {}

  @Get(':slug')
  async findPublished(
    @Param('slug', new ZodValidationPipe(slugSchema)) slug: string,
  ): Promise<LandingPageView> {
    const page = await this.landingPages.findPublished(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

@Module({ controllers: [LandingPagesController], providers: [LandingPagesService] })
export class LandingPagesModule {}
