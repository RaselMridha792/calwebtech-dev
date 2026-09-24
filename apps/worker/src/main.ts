import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { CAMPAIGN_QUEUE, CAMPAIGN_SWEEP_QUEUE, EMAIL_QUEUE, campaignSendJobId } from '@calwebtech/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createCampaignSendProcessor } from './campaign-send';
import { prismaCampaignSendStore, runCampaignSweep } from './campaign-sweep';
import { usableSigningSecret } from '@calwebtech/shared/unsubscribe-token';
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

  // ---- campaigns (Task 5.4)
  const DAY_SECONDS = 24 * 60 * 60;
  const campaignQueue = new Queue(CAMPAIGN_QUEUE, { connection });
  const sweepQueue = new Queue(CAMPAIGN_SWEEP_QUEUE, { connection });
  const campaignStore = prismaCampaignSendStore(db);
  const signingSecret = usableSigningSecret(env.AUTH_SECRET);
  const canSendCampaigns = Boolean(signingSecret && env.APP_ORIGIN);
  if (!canSendCampaigns) {
    log('warning: AUTH_SECRET (16 characters or more) or APP_ORIGIN is not set; campaigns are not started, because their emails could not carry an unsubscribe link');
  }

  const campaignWorker = new Worker(
    CAMPAIGN_QUEUE,
    async (job) => {
      if (!signingSecret || !env.APP_ORIGIN) throw new Error('AUTH_SECRET and APP_ORIGIN are required to send a campaign');
      return createCampaignSendProcessor({
        transport,
        store: campaignStore,
        from: env.EMAIL_FROM,
        siteOrigin: env.APP_ORIGIN,
        secret: signingSecret,
        ...(env.EMAIL_REDIRECT_TO ? { redirectTo: env.EMAIL_REDIRECT_TO } : {}),
      })(job);
    },
    // The limiter is per queue, across every worker process: the provider's rate is per account.
    { connection, concurrency: 2, limiter: { max: env.CAMPAIGN_SEND_PER_SECOND, duration: 1000 } },
  );
  campaignWorker.on('failed', (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    // Only a final failure marks the recipient: until then BullMQ retries it.
    if (job.attemptsMade >= attempts || error.name === 'UnrecoverableError') {
      const data: unknown = job.data;
      const recipientId =
        typeof data === 'object' && data !== null && 'recipientId' in data && typeof data.recipientId === 'string'
          ? data.recipientId
          : null;
      if (recipientId) void campaignStore.markNotSent(recipientId, error.message).catch(() => undefined);
    }
    log(`campaign send failed ${String(job.id)} after ${String(job.attemptsMade)} attempt(s): ${error.message}`);
  });

  const sweepWorker = new Worker(
    CAMPAIGN_SWEEP_QUEUE,
    async () =>
      runCampaignSweep({
        db,
        canSend: canSendCampaigns,
        log,
        enqueue: async (recipientIds) => {
          await campaignQueue.addBulk(
            recipientIds.map((recipientId) => ({
              name: 'send',
              data: { recipientId },
              opts: {
                jobId: campaignSendJobId(recipientId),
                attempts: 5,
                backoff: { type: 'exponential', delay: 30_000 },
                removeOnComplete: { age: DAY_SECONDS },
                removeOnFail: { age: 7 * DAY_SECONDS },
              },
            })),
          );
        },
      }),
    { connection, concurrency: 1 },
  );
  sweepWorker.on('failed', (_job, error) => {
    log(`campaign sweep failed: ${error.message}`);
  });
  // Every minute, and on start, so a campaign due while the worker was down starts at once.
  void sweepQueue
    .upsertJobScheduler('campaign-sweep', { every: 60_000, immediately: true }, { name: 'sweep', opts: { removeOnComplete: 50, removeOnFail: 50 } })
    .catch((error: unknown) => {
      log(`campaign sweep could not be scheduled: ${error instanceof Error ? error.message : String(error)}`);
    });

  const shutdown = async (signal: string) => {
    log(`${signal}: finishing active jobs`);
    await Promise.all([campaignWorker.close(), sweepWorker.close()]);
    await Promise.all([campaignQueue.close(), sweepQueue.close()]);
    await worker.close();
    await connection.quit();
    await db.$disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  log(`consuming "${EMAIL_QUEUE}" with the ${transport.name} transport`);
  log(`consuming "${CAMPAIGN_QUEUE}" at ${String(env.CAMPAIGN_SEND_PER_SECOND)} a second, sweeping every minute`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
