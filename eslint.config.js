// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Flat ESLint config for the Operant monorepo.
 *
 * The framework-boundary rules below are not stylistic — they mechanically
 * enforce a hard project constraint: the RL core and simulation host must stay
 * decoupled from React/Three.js (see CLAUDE.md, "RL and narration are
 * decoupled" and the camera/renderer separation note). A reviewer trying to
 * `import` React into the RL engine gets a lint error, not just a code-review
 * comment.
 */

/** Imports that must never appear in framework-agnostic code (the RL core & server). */
const FRAMEWORK_IMPORT_RESTRICTIONS = {
  patterns: [
    {
      group: ['react', 'react-dom', 'react-dom/*', 'three', 'three/*', '@react-three/*'],
      message:
        'Framework-agnostic code (RL core / simulation host) must not depend on React or Three.js. The 3D scene is a rendering layer on top of plain 2D grid logic — keep the boundary clean (see CLAUDE.md).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/*.config.{js,ts,cjs,mjs}'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The RL core stays pure: no framework deps at all.
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', FRAMEWORK_IMPORT_RESTRICTIONS],
    },
  },

  // The simulation host is server-only: no React/Three either.
  {
    files: ['apps/server/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-imports': ['error', FRAMEWORK_IMPORT_RESTRICTIONS],
    },
  },

  // The client is the one place React/Three are allowed.
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Test files may use node globals for setup.
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  prettier,
);
