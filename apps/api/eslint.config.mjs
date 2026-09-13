import { baseConfig } from '@calwebtech/config/eslint/base';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...baseConfig(import.meta.dirname),
  {
    rules: {
      // Nest resolves constructor dependencies from emitted decorator metadata, so
      // injected classes must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
]);
