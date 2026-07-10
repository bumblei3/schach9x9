import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.cjs',
      'commitlint.config.js',
      'tests/**',
      'e2e/**',
      'scripts/**',
      'public/service-worker.js',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        BOARD_SIZE: 'readonly',
        PHASES: 'readonly',
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      indent: 'off',
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'off',
      'arrow-spacing': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'eol-last': ['error', 'always'],
      'comma-dangle': ['error', 'only-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'service-worker.ts'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        BOARD_SIZE: 'readonly',
        PHASES: 'readonly',
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
);