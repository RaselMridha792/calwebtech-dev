import {
  EMAIL_JOB_OPTIONS,
  EMAIL_QUEUE,
  emailJobId,
  emailJobSchema,
  emailOutboxQueueEntry,
  type EmailJob,
} from '@calwebtech/shared';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const ADD_TIMEOUT_MS = 5_000;

/** Adds email jobs for the worker (apps/worker). The API only produces; it never sends. */
export class EmailQueue implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueue.name);
  private readonly connection: Redis;
  private readonly queue: Queue;

  constructor(redisUrl: string, name: string = EMAIL_QUEUE) {
    // Fail fast while Redis is down: the lead is already stored, and the visitor's request
    // must not hang waiting for a reconnect.
    this.connection = new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    this.connection.on('error', (error: Error) => {
      this.logger.error(`Redis: ${error.message}`);
    });
    this.queue = new Queue(name, { connection: this.connection });
    this.queue.on('error', (error: Error) => {
      this.logger.error(`Email queue: ${error.message}`);
    });
  }

  /**
   * Adds outbox rows as jobs, each at its time: at once, or a reminder's delay
   * (docs/08-decisions.md, 71). The job id is the row's, so a row the worker's sweep has
   * already queued is not queued twice.
   */
  async enqueueOutbox(rows: readonly { id: string; template: string; sendAt: Date }[], now: Date = new Date()): Promise<void> {
    if (rows.length === 0) return;
    await this.withinTimeout(this.queue.addBulk(rows.map((row) => emailOutboxQueueEntry(row, now))));
  }

  /**
   * Adds jobs that carry their own payload: a campaign's test send, which is the team's
   * request and not a lead's or a booking's email, so it has no outbox row. Ids are stable,
   * so adding the same job twice queues it once.
   */
  async enqueue(jobs: readonly EmailJob[]): Promise<void> {
    await this.withinTimeout(
      this.queue.addBulk(
        jobs.map((job) => ({
          name: job.template,
          data: emailJobSchema.parse(job),
          opts: { ...EMAIL_JOB_OPTIONS, jobId: emailJobId(job) },
        })),
      ),
    );
  }

  /**
   * Takes jobs that have not been sent off the queue, by id. A job being sent at that moment
   * cannot be taken back, which is why the worker also checks a reminder before sending it.
   * Returns how many were removed.
   */
  async remove(jobIds: readonly string[]): Promise<number> {
    let removed = 0;
    for (const id of jobIds) {
      try {
        removed += await this.queue.remove(id);
      } catch (error) {
        this.logger.warn(`Email job ${id} could not be removed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return removed;
  }

  private async withinTimeout(add: Promise<unknown>): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Redis did not accept the email jobs within ${String(ADD_TIMEOUT_MS)}ms`));
      }, ADD_TIMEOUT_MS);
    });
    try {
      await Promise.race([add, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    // BullMQ leaves a connection it was given open.
    await this.connection.quit();
  }
}
