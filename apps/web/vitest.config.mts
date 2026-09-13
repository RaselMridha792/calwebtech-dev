import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    // Playwright owns e2e/; Vitest runs unit tests only.
    exclude: ['e2e/**', 'node_modules/**', '.next/**', '.next-analyze/**'],
  },
});
