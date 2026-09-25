import { promises as dns } from 'node:dns';

/**
 * Whether an address's domain can receive email at all (docs/08-decisions.md, 61): the typo
 * check behind "dana@gmial.con". It asks DNS for the domain's mail servers, and for its
 * address records when it names none, as a sending server would (RFC 5321, 5.1).
 *
 * It answers "no" only when DNS says the domain does not exist or has neither; a timeout, a
 * refused query or any other failure answers "unknown", which lets the address through. A
 * slow resolver must never cost a real enquiry. A domain that publishes a null MX exists, so
 * it passes: the check is for addresses that were mistyped, not for policing providers.
 */
export type Deliverability = 'yes' | 'no' | 'unknown';

export interface MailResolver {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

/** The answers DNS gives for a name with no such records, or no such name. */
const NO_RECORDS = new Set(['ENOTFOUND', 'ENODATA']);

function code(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

export class DnsDomainChecker {
  private readonly cache = new Map<string, { value: Deliverability; expires: number }>();

  constructor(
    private readonly resolver: MailResolver = dns,
    private readonly timeoutMs = 2_500,
    /** A domain's answer is kept this long; an unknown one is not kept at all. */
    private readonly ttlMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async check(domain: string): Promise<Deliverability> {
    const key = domain.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.value;
    const value = await this.lookup(key);
    if (value !== 'unknown') {
      // Bounded, so a flood of invented domains cannot grow the process without limit.
      if (this.cache.size >= 5_000) this.cache.clear();
      this.cache.set(key, { value, expires: this.now() + this.ttlMs });
    }
    return value;
  }

  private async lookup(domain: string): Promise<Deliverability> {
    const mx = await this.ask(() => this.resolver.resolveMx(domain));
    if (mx === 'failed') return 'unknown';
    if (mx.length > 0) return 'yes';

    // No mail servers named: mail goes to the domain's own address, if it has one.
    const [v4, v6] = await Promise.all([
      this.ask(() => this.resolver.resolve4(domain)),
      this.ask(() => this.resolver.resolve6(domain)),
    ]);
    if ((v4 !== 'failed' && v4.length > 0) || (v6 !== 'failed' && v6.length > 0)) return 'yes';
    if (v4 === 'failed' || v6 === 'failed') return 'unknown';
    return 'no';
  }

  /** The records, an empty list when DNS says there are none, or `failed` for anything else. */
  private async ask<T>(query: () => Promise<T[]>): Promise<T[] | 'failed'> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'failed'>((resolve) => {
      timer = setTimeout(() => {
        resolve('failed');
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        query().catch((error: unknown) => (NO_RECORDS.has(code(error) ?? '') ? [] : ('failed' as const))),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
