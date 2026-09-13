import { describe, expect, it } from 'vitest';
import { assertSeedAllowed } from './guard';

describe('assertSeedAllowed', () => {
  it('runs the launch seed on staging and in development only', () => {
    expect(() => {
      assertSeedAllowed('launch', 'staging');
    }).not.toThrow();
    expect(() => {
      assertSeedAllowed('launch', 'development');
    }).not.toThrow();
    for (const appEnv of ['production', 'PRODUCTION', 'prod', 'Staging', '', undefined]) {
      expect(() => {
        assertSeedAllowed('launch', appEnv);
      }, `APP_ENV=${String(appEnv)}`).toThrow(/Refusing/);
    }
  });

  it('runs the fixtures in development only', () => {
    expect(() => {
      assertSeedAllowed('fixtures', 'development');
    }).not.toThrow();
    for (const appEnv of ['staging', 'production', 'Development', '', undefined]) {
      expect(() => {
        assertSeedAllowed('fixtures', appEnv);
      }, `APP_ENV=${String(appEnv)}`).toThrow(/Refusing/);
    }
  });
});
