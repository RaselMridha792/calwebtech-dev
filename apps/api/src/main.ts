import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

// Local development reads the repo-root .env. In containers the variables are
// already set and no file exists, so nothing is loaded.
for (const candidate of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  // The admin's session and CSRF cookies are read by AdminGuard (apps/api/src/auth).
  // Nothing is signed here: the session token is random and stored only as a hash, so a
  // signature would add a secret to keep without adding anything it does not already have.
  app.use(cookieParser());
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
}

void bootstrap();
