import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EnvModule } from './config/env';
import { HealthController } from './health/health.controller';
import { HomePageModule } from './home/home-page.controller';
import { LandingPagesModule } from './landing-pages/landing-pages.controller';
import { LeadsModule } from './leads/leads.controller';
import { PrismaModule } from './prisma/prisma.service';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    // In-memory limits suit a single API instance. Move storage to Redis before scaling out.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    LandingPagesModule,
    HomePageModule,
    LeadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
