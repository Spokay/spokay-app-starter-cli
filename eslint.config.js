// ESLint v9 flat config. This package is ESM Node code, not browser code: TypeScript
// sources under `src/` and `test/`, plus this config file itself.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVars = ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }];

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-test/**', 'coverage/**', '.claude/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: { 'no-unused-vars': unusedVars },
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': unusedVars,
    },
  },
);
