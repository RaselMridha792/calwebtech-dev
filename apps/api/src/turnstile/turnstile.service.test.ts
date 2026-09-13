import { describe, expect, it } from 'vitest';
import { TURNSTILE_VERIFY_URL, TurnstileService } from './turnstile.service';

type Answer = Response | Error;

/** A stand-in for Cloudflare that records each call. */
function cloudflare(answer: Answer) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    calls.push({ url, body });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('TurnstileService', () => {
  it('passes a confirmed token and sends the secret, token and visitor IP', async () => {
    const { calls, fetchImpl } = cloudflare(json({ success: true, 'error-codes': [] }));
    const result = await new TurnstileService('secret', fetchImpl).verify('token', '203.0.113.7');
    expect(result).toBe('passed');
    expect(calls).toEqual([
      { url: TURNSTILE_VERIFY_URL, body: { secret: 'secret', response: 'token', remoteip: '203.0.113.7' } },
    ]);
  });

  it('fails a rejected token', async () => {
    const { fetchImpl } = cloudflare(json({ success: false, 'error-codes': ['invalid-input-response'] }));
    expect(await new TurnstileService('secret', fetchImpl).verify('token', undefined)).toBe('failed');
  });

  it('fails a reused or expired token', async () => {
    const { fetchImpl } = cloudflare(json({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    expect(await new TurnstileService('secret', fetchImpl).verify('token', undefined)).toBe('failed');
  });

  it('fails a missing token without asking Cloudflare', async () => {
    const { calls, fetchImpl } = cloudflare(json({ success: true }));
    expect(await new TurnstileService('secret', fetchImpl).verify(undefined, undefined)).toBe('failed');
    expect(calls).toHaveLength(0);
  });

  it('has no verdict when Cloudflare is unreachable or erroring', async () => {
    expect(await new TurnstileService('s', cloudflare(new Error('ECONNRESET')).fetchImpl).verify('t', undefined)).toBe(
      'unavailable',
    );
    expect(await new TurnstileService('s', cloudflare(json({}, 503)).fetchImpl).verify('t', undefined)).toBe('unavailable');
  });

  it('has no verdict when our own secret is wrong, rather than blaming the visitor', async () => {
    const { fetchImpl } = cloudflare(json({ success: false, 'error-codes': ['invalid-input-secret'] }));
    expect(await new TurnstileService('wrong', fetchImpl).verify('token', undefined)).toBe('unavailable');
  });
});
