import { describe, expect, it } from 'vitest';
import { TURNSTILE_TEST } from './turnstile-test-keys';
import { TurnstileService } from './turnstile.service';

describe('Turnstile siteverify with Cloudflare test keys', () => {
  it('passes the dummy token with the always-pass secret', async () => {
    const service = new TurnstileService(TURNSTILE_TEST.alwaysPassesSecret, fetch, 15_000);
    expect(await service.verify(TURNSTILE_TEST.dummyToken, undefined)).toBe('passed');
  });

  it('rejects the dummy token with the always-fail secret', async () => {
    const service = new TurnstileService(TURNSTILE_TEST.alwaysFailsSecret, fetch, 15_000);
    expect(await service.verify(TURNSTILE_TEST.dummyToken, undefined)).toBe('failed');
  });
});
