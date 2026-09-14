import type { SiteChromeView } from '@calwebtech/shared';
import { Controller, Get, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SiteChromeService } from './site-chrome.service';

@Controller('site')
export class SiteChromeController {
  constructor(private readonly chrome: SiteChromeService) {}

  /**
   * The header, menus, footer and closing band of every site page, and whether site pages
   * may be indexed. Not rate limited: every page render calls this from the web server's
   * single address, and repeated calls are served from the service's short cache.
   */
  @Get('chrome')
  @SkipThrottle()
  find(): Promise<SiteChromeView> {
    return this.chrome.find();
  }
}

@Module({ controllers: [SiteChromeController], providers: [SiteChromeService] })
export class SiteChromeModule {}
