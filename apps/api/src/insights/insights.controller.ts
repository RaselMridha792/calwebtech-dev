import { slugSchema, type InsightsArticleView, type InsightsIndexView } from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InsightsService } from './insights.service';

/**
 * `/insights/` and `/insights/<slug>/`. Topic pages are built from the index view, which
 * carries every topic and every published article, so a topic needs no endpoint of its own.
 * Not rate limited: every render calls these from the web server's one address, and
 * repeated calls are served from the service's short cache.
 */
@Controller('pages/insights')
@SkipThrottle()
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  findIndex(): Promise<InsightsIndexView> {
    return this.insights.findIndex();
  }

  /** 400 for a malformed slug, 404 when no article is published at it. */
  @Get(':slug')
  async findArticle(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<InsightsArticleView> {
    const article = await this.insights.findArticle(slug);
    if (!article) throw new NotFoundException();
    return article;
  }
}

@Module({ controllers: [InsightsController], providers: [InsightsService] })
export class InsightsModule {}
