import type { HomePageView } from '@calwebtech/shared';
import { Controller, Get, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HomePageService } from './home-page.service';

@Controller('pages')
export class HomePageController {
  constructor(private readonly homePage: HomePageService) {}

  /**
   * Not rate limited: every homepage render calls this from the web server's single
   * address. Repeated calls are served from the service's short cache, not the database.
   */
  @Get('home')
  @SkipThrottle()
  find(): Promise<HomePageView> {
    return this.homePage.find();
  }
}

@Module({ controllers: [HomePageController], providers: [HomePageService] })
export class HomePageModule {}
