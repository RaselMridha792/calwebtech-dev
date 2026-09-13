import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Rules that encode the repo contract in CLAUDE.md. */
export const contractRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
};

export const sharedIgnores = globalIgnores([
  '**/dist/**',
  '**/.next/**',
  '**/.next-analyze/**',
  '**/.lighthouseci/**',
  '**/coverage/**',
  '**/generated/**',
  '**/next-env.d.ts',
]);

/**
 * Type-aware lint config for TypeScript packages.
 * @param {string} tsconfigRootDir directory of the consuming package
 */
export function baseConfig(tsconfigRootDir) {
  return defineConfig([
    sharedIgnores,
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: contractRules,
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  ]);
}
