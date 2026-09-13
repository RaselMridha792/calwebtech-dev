import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * - `passed`: Cloudflare confirmed the token.
 * - `failed`: Cloudflare rejected it, or there was none. The submission is refused.
 * - `unavailable`: no verdict, because Cloudflare could not be reached, our own secret is
 *   wrong, or no secret is configured (staging before the client's keys exist). The lead
 *   is kept and marked, so an outage never drops paid traffic.
 */
export type BotCheck = 'passed' | 'failed' | 'unavailable';

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).default([]),
});

/** Faults on our side, not the visitor's. */
const OUR_FAULT = new Set(['missing-input-secret', 'invalid-input-secret', 'internal-error']);

/** Verifies Turnstile tokens server-side. Tokens are single use and expire after 300 seconds. */
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(
    private readonly secret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {
    if (!secret) {
      this.logger.warn('No TURNSTILE_SECRET: submissions are stored without a bot check verdict');
    }
  }

  async verify(token: string | undefined, visitorIp: string | undefined): Promise<BotCheck> {
    // Without a secret nothing can be verified, token or not (APP_ENV staging or development).
    if (!this.secret) return 'unavailable';
    if (!token) return 'failed';

    let response: Response;
    try {
      response = await this.fetchImpl(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: this.secret, response: token, ...(visitorIp ? { remoteip: visitorIp } : {}) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error(`Turnstile could not be reached: ${String(error)}`);
      return 'unavailable';
    }
    if (!response.ok) {
      this.logger.error(`Turnstile answered HTTP ${String(response.status)}`);
      return 'unavailable';
    }

    const body = siteverifyResponseSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) {
      this.logger.error('Turnstile answered with an unexpected body');
      return 'unavailable';
    }
    if (body.data.success) return 'passed';

    const codes = body.data['error-codes'];
    if (codes.some((code) => OUR_FAULT.has(code))) {
      this.logger.error(`Turnstile could not verify because of our configuration: ${codes.join(', ')}`);
      return 'unavailable';
    }
    this.logger.warn(`Turnstile rejected a submission: ${codes.join(', ') || 'no reason given'}`);
    return 'failed';
  }
}
