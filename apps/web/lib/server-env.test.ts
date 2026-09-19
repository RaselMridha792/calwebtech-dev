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

describe('CONTENT_SOURCE (decision 43)', () => {
  const production = { ...base, APP_ENV: 'production', TURNSTILE_SITE_KEY: 'key' };

  it('accepts snapshot content in production and says so once at startup', () => {
    const result = checkServerEnv({ ...production, CONTENT_SOURCE: 'snapshot' });
    expect(result.ok).toBe(true);
    expect(result.ok ? result.warning : '').toContain('CONTENT_SOURCE=snapshot');
  });

  it('stays quiet for the default, and treats a blank value as the default', () => {
    expect(checkServerEnv({ ...production, CONTENT_SOURCE: 'api' })).toEqual({ ok: true });
    expect(checkServerEnv({ ...production, CONTENT_SOURCE: '' })).toEqual({ ok: true });
  });

  it('still needs the API in production: snapshot content does not store a lead', () => {
    const result = checkServerEnv({ APP_ENV: 'production', TURNSTILE_SITE_KEY: 'key', CONTENT_SOURCE: 'snapshot' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('API_INTERNAL_URL');
  });

  it('refuses a source it does not know, so a typo cannot silently mean the API', () => {
    const result = checkServerEnv({ ...production, CONTENT_SOURCE: 'snapshots' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('CONTENT_SOURCE');
  });
});
