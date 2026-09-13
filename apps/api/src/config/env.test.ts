import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const required = {
  DATABASE_URL: 'postgresql://calwebtech:secret@localhost:5432/calwebtech',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadEnv', () => {
  it('treats an unset APP_ENV as production, where the Turnstile secret is required', () => {
    expect(() => loadEnv(required)).toThrow(/TURNSTILE_SECRET/);
  });

  it('starts staging and development without a Turnstile secret', () => {
    expect(loadEnv({ ...required, APP_ENV: 'staging' }).TURNSTILE_SECRET).toBeUndefined();
    expect(loadEnv({ ...required, APP_ENV: 'development', TURNSTILE_SECRET: '' }).TURNSTILE_SECRET).toBeUndefined();
  });

  it('accepts production with a secret, and treats a blank one as missing', () => {
    expect(loadEnv({ ...required, APP_ENV: 'production', TURNSTILE_SECRET: 'secret' }).APP_ENV).toBe('production');
    expect(() => loadEnv({ ...required, APP_ENV: 'production', TURNSTILE_SECRET: '   ' })).toThrow(/TURNSTILE_SECRET/);
  });

  it('rejects an APP_ENV it does not know', () => {
    expect(() => loadEnv({ ...required, APP_ENV: 'prod', TURNSTILE_SECRET: 'secret' })).toThrow(/APP_ENV/);
  });
});
