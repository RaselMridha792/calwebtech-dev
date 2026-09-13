import { describe, expect, it } from 'vitest';
import { checkServerEnv } from './server-env';

const base = { API_INTERNAL_URL: 'http://staging-api:4000' };

describe('checkServerEnv', () => {
  it('stops production without a Turnstile site key, including when APP_ENV is unset', () => {
    for (const env of [base, { ...base, APP_ENV: 'production' }]) {
      const result = checkServerEnv(env);
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.error).toContain('TURNSTILE_SITE_KEY');
    }
  });

  it('lets staging and development start without one, with a warning', () => {
    for (const env of [{ ...base, APP_ENV: 'staging' }, { ...base, APP_ENV: 'development', TURNSTILE_SITE_KEY: '' }]) {
      const result = checkServerEnv(env);
      expect(result.ok).toBe(true);
      expect(result.ok ? result.warning : '').toContain('TURNSTILE_SITE_KEY');
    }
  });

  it('passes quietly when the key is set', () => {
    expect(checkServerEnv({ ...base, TURNSTILE_SITE_KEY: '1x00000000000000000000AA' })).toEqual({ ok: true });
  });

  it('stops production without the API URL, including when APP_ENV is unset', () => {
    for (const env of [{ TURNSTILE_SITE_KEY: 'key' }, { APP_ENV: 'production', TURNSTILE_SITE_KEY: 'key', API_INTERNAL_URL: '' }]) {
      const result = checkServerEnv(env);
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.error).toContain('API_INTERNAL_URL');
    }
  });

  it('lets staging start without the API, on the static snapshot, with a warning', () => {
    const result = checkServerEnv({ APP_ENV: 'staging', TURNSTILE_SITE_KEY: 'key' });
    expect(result.ok).toBe(true);
    expect(result.ok ? result.warning : '').toContain('static snapshot');
  });

  it('rejects an API URL that is not a URL', () => {
    expect(checkServerEnv({ APP_ENV: 'staging', API_INTERNAL_URL: 'not a url' }).ok).toBe(false);
  });
});
