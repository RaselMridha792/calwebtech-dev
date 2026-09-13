import { baseConfig } from '@calwebtech/config/eslint/base';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  ...baseConfig(import.meta.dirname),
  { ignores: ['.lighthouseci/**'] },
  { languageOptions: { globals: globals.node } },
]);
