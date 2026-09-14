import {
  slugSchema,
  type GlossaryIndexView,
  type GlossaryTermView,
  type GuideDetailView,
  type GuidesIndexView,
} from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GuidesGlossaryService } from './guides-glossary.service';

/**
 * `/guides/` and `/guides/<slug>/`. Not rate limited: every render calls these from the web
 * server's single address, and repeated calls are served from the service's short cache.
 */
@Controller('pages/guides')
export class GuidesController {
  constructor(private readonly pages: GuidesGlossaryService) {}

  @Get()
  @SkipThrottle()
  findIndex(): Promise<GuidesIndexView> {
    return this.pages.findGuidesIndex();
  }

  /** 400 for a malformed slug, 404 when no such guide is published. */
  @Get(':slug')
  @SkipThrottle()
  async findBySlug(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<GuideDetailView> {
    const page = await this.pages.findGuide(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

/** `/glossary/` and `/glossary/<term>/`. */
@Controller('pages/glossary')
export class GlossaryController {
  constructor(private readonly pages: GuidesGlossaryService) {}

  @Get()
  @SkipThrottle()
  findIndex(): Promise<GlossaryIndexView> {
    return this.pages.findGlossaryIndex();
  }

  /** 400 for a malformed slug, 404 when no such term is published. */
  @Get(':slug')
  @SkipThrottle()
  async findBySlug(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<GlossaryTermView> {
    const page = await this.pages.findGlossaryTerm(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

@Module({ controllers: [GuidesController, GlossaryController], providers: [GuidesGlossaryService] })
export class GuidesGlossaryModule {}
