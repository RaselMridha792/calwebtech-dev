import { slugSchema, type LocationDetailView, type LocationsIndexView } from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LocationsService } from './locations.service';

/**
 * `/locations/` and the city pages (docs/10-site-pages.md). Not rate limited: every render
 * comes from the web server's single address, and the service caches each view.
 */
@Controller('pages/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @SkipThrottle()
  findIndex(): Promise<LocationsIndexView> {
    return this.locations.findIndex();
  }

  @Get(':slug')
  @SkipThrottle()
  async findPublished(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<LocationDetailView> {
    const page = await this.locations.findPublished(slug);
    if (!page) throw new NotFoundException();
    return page;
  }
}

@Module({ controllers: [LocationsController], providers: [LocationsService] })
export class LocationsModule {}
