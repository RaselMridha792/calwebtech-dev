import {
  STATIC_LEGAL_SLUGS,
  STATIC_THANK_YOU_TYPES,
  slugSchema,
  type StaticContactView,
  type StaticFaqView,
  type StaticLegalSlug,
  type StaticLegalView,
  type StaticNotFoundView,
  type StaticPricingView,
  type StaticProcessView,
  type StaticThankYouType,
  type StaticThankYouView,
} from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StaticPagesService } from './static.service';

const isLegalSlug = (slug: string): slug is StaticLegalSlug => (STATIC_LEGAL_SLUGS as readonly string[]).includes(slug);
const isThankYouType = (type: string): type is StaticThankYouType =>
  (STATIC_THANK_YOU_TYPES as readonly string[]).includes(type);

/**
 * The static page family's views (docs/10-site-pages.md). GET only and not rate limited:
 * every page render calls these from the web server's single address, and repeated calls
 * are served from the service's short cache.
 */
@Controller('pages')
@SkipThrottle()
export class StaticPagesController {
  constructor(private readonly pages: StaticPagesService) {}

  @Get('pricing')
  pricing(): Promise<StaticPricingView> {
    return this.pages.pricing();
  }

  @Get('process')
  process(): Promise<StaticProcessView> {
    return this.pages.process();
  }

  @Get('contact')
  contact(): Promise<StaticContactView> {
    return this.pages.contact();
  }

  @Get('faq')
  faq(): Promise<StaticFaqView> {
    return this.pages.faq();
  }

  @Get('thank-you/:type')
  async thankYou(@Param('type', new ZodValidationPipe(slugSchema)) type: string): Promise<StaticThankYouView> {
    // Unknown types never reach the database or the cache.
    if (!isThankYouType(type)) throw new NotFoundException();
    const page = await this.pages.thankYou(type);
    if (!page) throw new NotFoundException();
    return page;
  }

  @Get('legal/:slug')
  legal(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<StaticLegalView> {
    if (!isLegalSlug(slug)) throw new NotFoundException();
    return this.pages.legal(slug);
  }

  @Get('not-found')
  notFound(): Promise<StaticNotFoundView> {
    return this.pages.notFound();
  }
}

@Module({ controllers: [StaticPagesController], providers: [StaticPagesService] })
export class StaticPagesModule {}
