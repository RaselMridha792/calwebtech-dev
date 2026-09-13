import { createPrismaClient, type PrismaClient } from '@calwebtech/db';
import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { API_ENV, type ApiEnv } from '../config/env';

/** Owns the single Prisma client for the API process. */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.client = createPrismaClient(env.DATABASE_URL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
