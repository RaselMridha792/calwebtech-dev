import { baseConfig } from '@calwebtech/config/eslint/base';
import { defineConfig } from 'eslint/config';

export default defineConfig([...baseConfig(import.meta.dirname)]);
