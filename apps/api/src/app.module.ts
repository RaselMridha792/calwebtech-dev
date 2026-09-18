import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EnvModule } from './config/env';
import { HealthController } from './health/health.controller';
import { HomePageModule } from './home/home-page.controller';
import { LandingPagesModule } from './landing-pages/landing-pages.controller';
import { LeadsModule } from './leads/leads.controller';
import { PrismaModule } from './prisma/prisma.service';
import { SiteChromeModule } from './site/site-chrome.controller';
// Site page families (docs/10-site-pages.md): one import each, below this line.
import { IndustriesModule } from './industries/industries.controller';
import { WorkModule } from './work/work.controller';
import { ServicesModule } from './services/services.controller';
import { CompanyModule } from './company/company.controller';
import { LocationsModule } from './locations/locations.controller';
import { StaticPagesModule } from './static/static.controller';
import { GuidesGlossaryModule } from './guides-glossary/guides-glossary.controller';
import { CalculatorPageModule } from './calculator/calculator.controller';
import { InsightsModule } from './insights/insights.controller';
import { FormsModule } from './forms/forms.controller';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    // In-memory limits suit a single API instance. Move storage to Redis before scaling out.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    LandingPagesModule,
    HomePageModule,
    LeadsModule,
    SiteChromeModule,
    // Site page families: one module each, below this line.
    IndustriesModule,
    WorkModule,
    ServicesModule,
    CompanyModule,
    LocationsModule,
    StaticPagesModule,
    GuidesGlossaryModule,
    CalculatorPageModule,
    InsightsModule,
    FormsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
