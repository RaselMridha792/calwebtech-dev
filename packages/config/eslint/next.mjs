import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { contractRules, sharedIgnores } from './base.mjs';
import { calwebtechPlugin } from './rules/teal-usage.mjs';

const RAW_HEX = 'Use a design token from packages/config/tailwind/theme.css, not a raw hex colour.';

/**
 * Lint config for apps/web.
 * @param {string} tsconfigRootDir directory of the consuming app
 */
export function nextConfig(tsconfigRootDir) {
  return defineConfig([
    sharedIgnores,
    ...nextVitals,
    ...nextTs,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      plugins: { calwebtech: calwebtechPlugin },
      rules: {
        ...contractRules,
        'calwebtech/teal-usage': 'error',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@calwebtech/db', '@calwebtech/db/*', '@prisma/*', 'pg'],
                message: 'The web app reads and writes through the API only.',
              },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          { selector: 'Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]', message: RAW_HEX },
          { selector: 'TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}\\]/]', message: RAW_HEX },
          { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: RAW_HEX },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  ]);
}
