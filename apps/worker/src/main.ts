import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { EMAIL_QUEUE } from '@calwebtech/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadWorkerEnv } from './env';
import { createEmailJobProcessor } from './process-email-job';
import { prismaDeliveryStore } from './store';
import { logTransport, resendTransport } from './transport';

// Local development reads the repo-root .env. In containers the variables are already
// set and no file exists, so nothing is loaded.
for (const candidate of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

function log(line: string): void {
  console.log(`${new Date().toISOString()} worker ${line}`);
}

function main(): void {
  const env = loadWorkerEnv(process.env);
  if (!env.APP_ORIGIN) {
    log('warning: APP_ORIGIN is not set; emails that link back to a page are sent without those links');
  }
  if (env.NODE_ENV === 'production' && env.EMAIL_REDIRECT_TO) {
    log(`warning: EMAIL_REDIRECT_TO is set in production; every email goes to ${env.EMAIL_REDIRECT_TO}`);
  }

  const db = createPrismaClient(env.DATABASE_URL);
  // Workers block on Redis and must retry commands indefinitely while it reconnects.
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const transport =
    env.EMAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY
      ? resendTransport(env.RESEND_API_KEY)
      : logTransport(log);

  const worker = new Worker(
    EMAIL_QUEUE,
    createEmailJobProcessor({
      transport,
      store: prismaDeliveryStore(db),
      from: env.EMAIL_FROM,
      ...(env.EMAIL_REDIRECT_TO ? { redirectTo: env.EMAIL_REDIRECT_TO } : {}),
      ...(env.APP_ORIGIN ? { siteOrigin: env.APP_ORIGIN } : {}),
    }),
    { connection, concurrency: env.EMAIL_CONCURRENCY },
  );
  worker.on('completed', (job) => {
    log(`sent ${job.name} ${String(job.id)}`);
  });
  worker.on('failed', (job, error) => {
    log(`failed ${job?.name ?? 'unknown'} ${String(job?.id)} after ${String(job?.attemptsMade)} attempt(s): ${error.message}`);
  });

  const shutdown = async (signal: string) => {
    log(`${signal}: finishing active jobs`);
    await worker.close();
    await connection.quit();
    await db.$disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  log(`consuming "${EMAIL_QUEUE}" with the ${transport.name} transport`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
