import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the built stack, served through the same edge proxy as the
 * Lighthouse gate (packages/perf/src/serve.mjs). Needs `pnpm build` and a migrated,
 * seeded database first.
 */
export default defineConfig({
  testDir: 'e2e',
  // One worker: the tests submit real leads and the API rate limits per IP.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'https://localhost:3443',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node ../../packages/perf/src/serve.mjs',
    url: 'https://localhost:3443/health/',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
  },
});
