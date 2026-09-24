import { CAMPAIGN_SWEEP_QUEUE } from '@calwebtech/shared';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Asks the worker to sweep now, rather than at the next minute, when a campaign is sent
 * immediately. Best effort: if Redis is down the minute sweep still starts it.
 */
export class CampaignSweepQueue implements OnModuleDestroy {
  private readonly logger = new Logger(CampaignSweepQueue.name);
  private readonly connection: Redis;
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    this.connection.on('error', (error: Error) => {
      this.logger.error(`Redis: ${error.message}`);
    });
    this.queue = new Queue(CAMPAIGN_SWEEP_QUEUE, { connection: this.connection });
    this.queue.on('error', (error: Error) => {
      this.logger.error(`Campaign sweep queue: ${error.message}`);
    });
  }

  async sweepNow(reason: string): Promise<void> {
    try {
      await this.queue.add('sweep', { reason }, { removeOnComplete: 50, removeOnFail: 50 });
    } catch (error) {
      this.logger.warn(`Could not ask for a sweep (${reason}); the minute sweep will run it: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
