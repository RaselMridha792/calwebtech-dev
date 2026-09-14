import type {
  CompanyAboutView,
  CompanyAwardsView,
  CompanyPartnersView,
  CompanyTeamView,
  CompanyTechnologyView,
  CompanyTestimonialsView,
} from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CompanyService } from './company.service';

/** The view, or 404 when the page's copy setting does not exist. */
async function published<View>(view: Promise<View | null>): Promise<View> {
  const found = await view;
  if (found === null) throw new NotFoundException();
  return found;
}

/**
 * The company family's pages (docs/10-site-pages.md). GET only and not rate limited: every
 * render calls these from the web server's single address, and repeated calls are served from
 * the service's short cache.
 */
@Controller('pages')
@SkipThrottle()
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get('about')
  about(): Promise<CompanyAboutView> {
    return published(this.company.about());
  }

  @Get('team')
  team(): Promise<CompanyTeamView> {
    return published(this.company.team());
  }

  @Get('testimonials')
  testimonials(): Promise<CompanyTestimonialsView> {
    return published(this.company.testimonials());
  }

  @Get('awards')
  awards(): Promise<CompanyAwardsView> {
    return published(this.company.awards());
  }

  @Get('partners')
  partners(): Promise<CompanyPartnersView> {
    return published(this.company.partners());
  }

  @Get('technology')
  technology(): Promise<CompanyTechnologyView> {
    return published(this.company.technology());
  }
}

@Module({ controllers: [CompanyController], providers: [CompanyService] })
export class CompanyModule {}
