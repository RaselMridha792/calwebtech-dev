import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/** Used by the Docker health check. Unhealthy when the database is unreachable. */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await this.prisma.client.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
