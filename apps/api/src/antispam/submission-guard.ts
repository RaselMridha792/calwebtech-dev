import { createHash } from 'node:crypto';
import {
  EMAIL_LIMITS,
  FORM_MINIMUM_MS,
  emailDomain,
  isDisposableDomain,
  type AntispamForm,
} from '@calwebtech/shared';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { DnsDomainChecker } from './email-domains';

/**
 * The checks every public form passes besides Turnstile and the honeypot
 * (docs/14-remaining-work.md, task 6; docs/08-decisions.md, 61), in two steps:
 *
 * - `precheck`, before the bot check: was the form open long enough for a person to fill it,
 *   and can the address's domain receive email at all, and is it a throwaway inbox;
 * - `count`, after it: how many times this address has been sent from this form recently.
 *
 * Counting after the bot check means a script cannot spend a real person's allowance without
 * passing Turnstile each time. Every failure of the machinery itself lets the submission
 * through: a check that loses a real enquiry costs more than the spam it stops.
 */
export type Precheck = 'pass' | 'too_fast' | 'disposable' | 'no_mail';

export interface EmailCounter {
  /** Adds one and returns the count in the current window, or null when it cannot count. */
  increment(key: string, windowSeconds: number): Promise<number | null>;
}

/** Counts in Redis, one key per form and address that expires with its window. */
export class RedisEmailCounter implements EmailCounter {
  private readonly logger = new Logger(RedisEmailCounter.name);
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: false });
    this.redis.on('error', (error: Error) => {
      this.logger.error(`Redis: ${error.message}`);
    });
  }

  async increment(key: string, windowSeconds: number): Promise<number | null> {
    try {
      const results = await this.redis.multi().incr(key).expire(key, windowSeconds, 'NX').exec();
      const count = results?.[0]?.[1];
      return typeof count === 'number' ? count : null;
    } catch (error) {
      this.logger.warn(`Could not count a submission, so it is let through: ${String(error)}`);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export class SubmissionGuard {
  constructor(
    private readonly counter: EmailCounter | null,
    private readonly domains: Pick<DnsDomainChecker, 'check'> | null,
  ) {}

  /** A guard that checks nothing, for tests of the services it sits in front of. */
  static off(): SubmissionGuard {
    return new SubmissionGuard(null, null);
  }

  async precheck(form: AntispamForm, email: string, elapsedMs: number | undefined): Promise<Precheck> {
    // Without the figure, a page loaded before it existed; the other checks still apply.
    if (elapsedMs !== undefined && elapsedMs < FORM_MINIMUM_MS[form]) return 'too_fast';
    const domain = emailDomain(email);
    if (isDisposableDomain(domain)) return 'disposable';
    if (this.domains && (await this.domains.check(domain)) === 'no') return 'no_mail';
    return 'pass';
  }

  /** True while the address is within its form's limit, and whenever it cannot be counted. */
  async withinLimit(form: AntispamForm, email: string): Promise<boolean> {
    if (!this.counter) return true;
    const limit = EMAIL_LIMITS[form];
    // Hashed, so Redis holds no address.
    const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
    const count = await this.counter.increment(`antispam:${form}:${digest}`, limit.windowSeconds);
    return count === null || count <= limit.max;
  }
}
