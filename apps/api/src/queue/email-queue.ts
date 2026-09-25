import { EMAIL_QUEUE, emailJobId, emailJobSchema, type EmailJob } from '@calwebtech/shared';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const ADD_TIMEOUT_MS = 5_000;
const DAY_SECONDS = 24 * 60 * 60;

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
   * Adds all jobs or none. Ids are stable per lead and template, so adding the same job
   * twice queues it once. Payloads persist in Redis only briefly: a day once sent, a week
   * if every attempt failed.
   */
  async enqueue(jobs: readonly EmailJob[]): Promise<void> {
    await this.add(jobs.map((job) => ({ job, delay: 0 })));
  }

  /**
   * Adds each job to be sent at its time: a booking's reminders (docs/08-decisions.md, 60).
   * A time already past is not added, since a reminder after the fact reminds nobody.
   */
  async schedule(jobs: readonly { job: EmailJob; at: Date }[], now: Date = new Date()): Promise<void> {
    const due = jobs
      .map(({ job, at }) => ({ job, delay: at.getTime() - now.getTime() }))
      .filter((entry) => entry.delay > 0);
    if (due.length > 0) await this.add(due);
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

  private async add(entries: readonly { job: EmailJob; delay: number }[]): Promise<void> {
    const add = this.queue.addBulk(
      entries.map(({ job, delay }) => ({
        name: job.template,
        data: emailJobSchema.parse(job),
        opts: {
          jobId: emailJobId(job),
          ...(delay > 0 ? { delay } : {}),
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { age: DAY_SECONDS },
          removeOnFail: { age: 7 * DAY_SECONDS },
        },
      })),
    );
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
